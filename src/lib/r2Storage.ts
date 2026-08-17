/**
 * Cloudflare R2 storage adapter.
 *
 * Production runtime uses the native Cloudflare R2 binding so the Worker
 * bundle does not need the AWS SDK. Node maintenance scripts can still fall
 * back to the S3-compatible implementation through a non-bundled dynamic
 * import.
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { logOperationalEvent, summarizeError } from './observability/operationalLog';

type UploadToR2Input = {
  key: string;
  body: BodyInit | ArrayBufferView | ReadableStream;
  contentType: string;
  cacheControl?: string;
};

type ListR2ObjectsInput = {
  prefix: string;
};

export type R2ListedObject = {
  key: string;
  size: number;
  uploaded?: Date;
};

type R2TokenPayload = {
  key: string;
  contentType: string;
  cacheControl: string;
  exp: number;
  maxSize: number;
};

type R2LikeObject = {
  body?: ReadableStream | null;
  size?: number;
  etag?: string;
  uploaded?: Date;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
};

type S3LikeObject = {
  Body?: ReadableStream | null;
  ContentType?: string;
  ContentLength?: number;
  CacheControl?: string;
  ETag?: string;
  LastModified?: Date;
  ContentRange?: string;
};

type R2BucketLike = {
  put: (key: string, value: unknown, options?: Record<string, unknown>) => Promise<unknown>;
  get: (key: string, options?: Record<string, unknown>) => Promise<R2LikeObject | null>;
  head: (key: string) => Promise<R2LikeObject | null>;
  delete: (key: string) => Promise<unknown>;
  list: (options?: Record<string, unknown>) => Promise<{
    objects: Array<{ key: string; size?: number; uploaded?: Date }>;
    truncated?: boolean;
    cursor?: string;
  }>;
};

type S3FallbackModule = {
  uploadToR2: (input: UploadToR2Input) => Promise<{ key: string; url: string }>;
  createR2PresignedPutUrl: (input: {
    key: string;
    contentType: string;
    cacheControl?: string;
    expiresInSeconds?: number;
  }) => Promise<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
    cacheControl: string;
    expiresInSeconds: number;
  }>;
  headR2Object: (key: string) => Promise<S3LikeObject>;
  getR2Object: (key: string, range?: string | null) => Promise<S3LikeObject>;
  deleteFromR2: (key: string) => Promise<void>;
  copyR2Object: (
    sourceKey: string,
    destinationKey: string
  ) => Promise<{ key: string; url: string }>;
  listR2Objects: (input: ListR2ObjectsInput) => Promise<R2ListedObject[]>;
  listR2ObjectKeys: (input: ListR2ObjectsInput) => Promise<string[]>;
};

const R2_RUNTIME_ENV_KEYS = ['CLOUDFLARE_R2_BUCKET', 'CLOUDFLARE_R2_PUBLIC_BASE_URL'] as const;
const DEFAULT_R2_BINDING = 'MEDIA_BUCKET';
const DEFAULT_UPLOAD_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function readPublicR2Config() {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;

  if (!bucket || !publicBaseUrl) return null;

  return {
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
  };
}

export function hasR2StorageEnv() {
  return R2_RUNTIME_ENV_KEYS.every((key) => Boolean(process.env[key]));
}

export function isR2StorageConfigured() {
  return Boolean(readPublicR2Config());
}

export function getMissingR2EnvKeys() {
  return R2_RUNTIME_ENV_KEYS.filter((key) => !process.env[key]);
}

function encodeR2Key(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

export function buildR2PublicUrl(key: string) {
  const config = readPublicR2Config();
  if (!config) {
    throw new Error(
      `Cloudflare R2 env is incomplete. Missing: ${getMissingR2EnvKeys().join(', ')}`
    );
  }

  return `${config.publicBaseUrl}/${encodeR2Key(key)}`;
}

export function isR2PublicUrl(src?: string | null) {
  const config = readPublicR2Config();
  if (!src || !config) return false;

  return src.startsWith(`${config.publicBaseUrl}/`);
}

async function getRuntimeR2Bucket(): Promise<R2BucketLike | null> {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  try {
    const context = await getCloudflareContext({ async: true });
    const env = context.env as unknown as Record<string, unknown>;
    const bindingName = process.env.CLOUDFLARE_R2_BINDING || DEFAULT_R2_BINDING;
    return (
      (env[bindingName] as R2BucketLike | undefined) ||
      (env[DEFAULT_R2_BINDING] as R2BucketLike | undefined) ||
      (env.R2 as R2BucketLike | undefined) ||
      null
    );
  } catch {
    return null;
  }
}

function getS3FallbackModulePath() {
  const suffix = String.fromCharCode(83, 51);
  return `./r2Storage${suffix}`;
}

async function getS3Fallback(): Promise<S3FallbackModule> {
  if (process.env.NODE_ENV === 'development') {
    return import('./r2StorageS3') as Promise<S3FallbackModule>;
  }

  const modulePath = getS3FallbackModulePath();
  return import(/* webpackIgnore: true */ modulePath) as Promise<S3FallbackModule>;
}

async function getR2BucketOrFallback() {
  const bucket = await getRuntimeR2Bucket();
  if (bucket) return { bucket, fallback: null };

  return { bucket: null, fallback: await getS3Fallback() };
}

function createNotFoundError(key: string) {
  const error = new Error(`R2 object not found: ${key}`) as Error & {
    name: string;
    $metadata: { httpStatusCode: number };
  };
  error.name = 'NotFound';
  error.$metadata = { httpStatusCode: 404 };
  return error;
}

function toS3LikeObject(
  key: string,
  object: R2LikeObject,
  range?: { offset: number; length: number; totalSize: number }
): S3LikeObject {
  const contentLength = range?.length ?? object.size;
  const end = range ? range.offset + range.length - 1 : undefined;

  return {
    Body: object.body ?? null,
    ContentType: object.httpMetadata?.contentType,
    ContentLength: contentLength,
    CacheControl: object.httpMetadata?.cacheControl,
    ETag: object.etag,
    LastModified: object.uploaded,
    ContentRange: range ? `bytes ${range.offset}-${end}/${range.totalSize}` : undefined,
  };
}

function parseRangeHeader(range: string | null | undefined, totalSize: number) {
  if (!range) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    const offset = Math.max(totalSize - suffixLength, 0);
    return {
      r2Range: { offset, length: totalSize - offset },
      responseRange: { offset, length: totalSize - offset, totalSize },
    };
  }

  const offset = Number(rawStart);
  const requestedEnd = rawEnd ? Number(rawEnd) : totalSize - 1;
  if (!Number.isFinite(offset) || !Number.isFinite(requestedEnd) || offset < 0) return null;
  if (offset >= totalSize || requestedEnd < offset) return null;

  const end = Math.min(requestedEnd, totalSize - 1);
  const length = end - offset + 1;

  return {
    r2Range: { offset, length },
    responseRange: { offset, length, totalSize },
  };
}

export async function uploadToR2({ key, body, contentType, cacheControl }: UploadToR2Input) {
  try {
    const { bucket, fallback } = await getR2BucketOrFallback();
    if (!bucket) {
      const result = await fallback.uploadToR2({ key, body, contentType, cacheControl });
      logOperationalEvent({
        event: 'r2.upload',
        status: 'success',
        metadata: {
          key,
          contentType,
          runtime: 's3-fallback',
        },
      });
      return result;
    }

    await bucket.put(key, body, {
      httpMetadata: {
        contentType,
        cacheControl,
      },
    });

    logOperationalEvent({
      event: 'r2.upload',
      status: 'success',
      metadata: {
        key,
        contentType,
        runtime: 'worker-binding',
      },
    });

    return {
      key,
      url: buildR2PublicUrl(key),
    };
  } catch (error) {
    logOperationalEvent({
      event: 'r2.upload',
      level: 'error',
      status: 'failure',
      message: 'R2 upload failed',
      metadata: {
        key,
        contentType,
        error: summarizeError(error),
      },
    });
    throw error;
  }
}

export async function headR2Object(key: string): Promise<S3LikeObject> {
  const { bucket, fallback } = await getR2BucketOrFallback();
  if (!bucket) return fallback.headR2Object(key);

  const object = await bucket.head(key);
  if (!object) throw createNotFoundError(key);

  return toS3LikeObject(key, object);
}

export async function getR2Object(key: string, range?: string | null): Promise<S3LikeObject> {
  const { bucket, fallback } = await getR2BucketOrFallback();
  if (!bucket) return fallback.getR2Object(key, range);

  const head = range ? await bucket.head(key) : null;
  if (range && !head) throw createNotFoundError(key);

  const parsedRange =
    range && typeof head?.size === 'number' ? parseRangeHeader(range, head.size) : null;
  const object = await bucket.get(key, parsedRange ? { range: parsedRange.r2Range } : undefined);
  if (!object) throw createNotFoundError(key);

  return toS3LikeObject(key, object, parsedRange?.responseRange);
}

export async function deleteFromR2(key: string) {
  const { bucket, fallback } = await getR2BucketOrFallback();
  if (!bucket) return fallback.deleteFromR2(key);

  await bucket.delete(key);
}

export async function copyR2Object(sourceKey: string, destinationKey: string) {
  const { bucket, fallback } = await getR2BucketOrFallback();
  if (!bucket) return fallback.copyR2Object(sourceKey, destinationKey);

  const source = await bucket.get(sourceKey);
  if (!source?.body) throw createNotFoundError(sourceKey);

  await bucket.put(destinationKey, source.body, {
    httpMetadata: source.httpMetadata,
  });

  return {
    key: destinationKey,
    url: buildR2PublicUrl(destinationKey),
  };
}

export async function listR2Objects({ prefix }: ListR2ObjectsInput) {
  const { bucket, fallback } = await getR2BucketOrFallback();
  if (!bucket) return fallback.listR2Objects({ prefix });

  const objects: R2ListedObject[] = [];
  let cursor: string | undefined;

  do {
    const response = await bucket.list({ prefix, cursor });
    response.objects.forEach((object) =>
      objects.push({
        key: object.key,
        size: Number(object.size || 0),
        uploaded: object.uploaded,
      })
    );
    cursor = response.truncated ? response.cursor : undefined;
  } while (cursor);

  return objects;
}

export async function listR2ObjectKeys(input: ListR2ObjectsInput) {
  const objects = await listR2Objects(input);
  return objects.map((object) => object.key);
}

function getUploadTokenSecret() {
  const secret = process.env.JWT_SECRET || process.env.REVALIDATION_TOKEN;
  if (!secret) {
    throw new Error('JWT_SECRET or REVALIDATION_TOKEN is required to sign R2 upload URLs');
  }
  return secret;
}

function base64UrlEncode(input: string | ArrayBuffer) {
  const bytes = typeof input === 'string' ? textEncoder.encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return textDecoder.decode(bytes);
}

async function hmacSha256(data: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, textEncoder.encode(data));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function signUploadPayload(payload: R2TokenPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(await hmacSha256(encodedPayload, getUploadTokenSecret()));
  return `${encodedPayload}.${signature}`;
}

export async function verifyR2UploadToken(token: string): Promise<R2TokenPayload> {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid upload token');
  }

  const expectedSignature = base64UrlEncode(
    await hmacSha256(encodedPayload, getUploadTokenSecret())
  );
  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error('Invalid upload token signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as R2TokenPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Upload token expired');
  }

  return payload;
}

/**
 * Compatibility name retained for existing callers. In Cloudflare runtime this
 * returns a signed internal Worker PUT endpoint, not an S3 presigned URL.
 */
export async function createR2PresignedPutUrl({
  key,
  contentType,
  cacheControl = DEFAULT_UPLOAD_CACHE_CONTROL,
  expiresInSeconds = 600,
  maxSize = 60 * 1024 * 1024,
}: {
  key: string;
  contentType: string;
  cacheControl?: string;
  expiresInSeconds?: number;
  maxSize?: number;
}): Promise<{
  uploadUrl: string;
  publicUrl: string;
  key: string;
  cacheControl: string;
  expiresInSeconds: number;
}> {
  const { bucket, fallback } = await getR2BucketOrFallback();
  if (!bucket) {
    return fallback.createR2PresignedPutUrl({
      key,
      contentType,
      cacheControl,
      expiresInSeconds,
    });
  }

  const token = await signUploadPayload({
    key,
    contentType,
    cacheControl,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    maxSize,
  });

  return {
    uploadUrl: `/api/admin/upload/direct?token=${encodeURIComponent(token)}`,
    publicUrl: buildR2PublicUrl(key),
    key,
    cacheControl,
    expiresInSeconds,
  };
}
