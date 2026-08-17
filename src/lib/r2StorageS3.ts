import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

type UploadToR2Input = {
  key: string;
  body: unknown;
  contentType: string;
  cacheControl?: string;
};

type ListR2ObjectsInput = {
  prefix: string;
};

type R2ListedObject = {
  key: string;
  size: number;
  uploaded?: Date;
};

const S3_R2_ENV_KEYS = [
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET',
  'CLOUDFLARE_R2_PUBLIC_BASE_URL',
] as const;

let client: S3Client | null = null;

function readR2Config(): R2Config | null {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
  };
}

function getMissingS3R2EnvKeys() {
  const missing: string[] = S3_R2_ENV_KEYS.filter((key) => !process.env[key]);
  if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID && !process.env.CLOUDFLARE_ACCOUNT_ID) {
    missing.unshift('CLOUDFLARE_ACCOUNT_ID');
  }
  return missing;
}

function getR2Client(config: R2Config) {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return client;
}

function encodeR2Key(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function encodeCopySource(bucket: string, key: string) {
  return `${bucket}/${encodeR2Key(key)}`;
}

function requireR2Config() {
  const config = readR2Config();
  if (!config) {
    throw new Error(
      `Cloudflare R2 S3 env is incomplete. Missing: ${getMissingS3R2EnvKeys().join(', ')}`
    );
  }
  return config;
}

function buildR2PublicUrl(key: string) {
  const config = requireR2Config();
  return `${config.publicBaseUrl}/${encodeR2Key(key)}`;
}

export async function uploadToR2({ key, body, contentType, cacheControl }: UploadToR2Input) {
  const config = requireR2Config();

  await getR2Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body as never,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );

  return {
    key,
    url: buildR2PublicUrl(key),
  };
}

export async function createR2PresignedPutUrl({
  key,
  contentType,
  cacheControl = 'public, max-age=31536000, immutable',
  expiresInSeconds = 600,
}: {
  key: string;
  contentType: string;
  cacheControl?: string;
  expiresInSeconds?: number;
}) {
  const config = requireR2Config();

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  const uploadUrl = await getSignedUrl(getR2Client(config), command, {
    expiresIn: expiresInSeconds,
  });

  return {
    uploadUrl,
    publicUrl: buildR2PublicUrl(key),
    key,
    cacheControl,
    expiresInSeconds,
  };
}

export async function headR2Object(key: string) {
  const config = requireR2Config();

  return getR2Client(config).send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
}

export async function getR2Object(key: string, range?: string | null) {
  const config = requireR2Config();

  return getR2Client(config).send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Range: range || undefined,
    })
  );
}

export async function deleteFromR2(key: string) {
  const config = requireR2Config();

  await getR2Client(config).send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
}

export async function copyR2Object(sourceKey: string, destinationKey: string) {
  const config = requireR2Config();

  await getR2Client(config).send(
    new CopyObjectCommand({
      Bucket: config.bucket,
      CopySource: encodeCopySource(config.bucket, sourceKey),
      Key: destinationKey,
    })
  );

  return {
    key: destinationKey,
    url: buildR2PublicUrl(destinationKey),
  };
}

export async function listR2Objects({ prefix }: ListR2ObjectsInput) {
  const config = requireR2Config();
  const objects: R2ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await getR2Client(config).send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    response.Contents?.forEach((item) => {
      if (!item.Key) return;
      objects.push({
        key: item.Key,
        size: Number(item.Size || 0),
        uploaded: item.LastModified,
      });
    });
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

export async function listR2ObjectKeys(input: ListR2ObjectsInput) {
  const objects = await listR2Objects(input);
  return objects.map((object) => object.key);
}
