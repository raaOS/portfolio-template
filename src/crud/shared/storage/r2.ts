/**
 * Shared Core — R2 Storage
 * Upload/download/delete objects from Cloudflare R2.
 *
 * @module
 */

interface R2Config {
  bucket: string;
  publicBaseUrl: string;
  accountId: string;
  apiToken: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

export function isR2Configured(): boolean {
  return !!(
    readEnv('CLOUDFLARE_R2_BUCKET') &&
    (readEnv('CLOUDFLARE_ACCOUNT_ID') || readEnv('CLOUDFLARE_R2_ACCOUNT_ID')) &&
    (readEnv('CLOUDFLARE_R2_ACCESS_KEY_ID') || readEnv('CLOUDFLARE_API_TOKEN'))
  );
}

function getR2Config(): R2Config {
  const accountId = readEnv('CLOUDFLARE_ACCOUNT_ID') || readEnv('CLOUDFLARE_R2_ACCOUNT_ID');
  const bucket = readEnv('CLOUDFLARE_R2_BUCKET');
  const publicBaseUrl = readEnv('CLOUDFLARE_R2_PUBLIC_BASE_URL');
  const apiToken = readEnv('CLOUDFLARE_API_TOKEN');
  const accessKeyId = readEnv('CLOUDFLARE_R2_ACCESS_KEY_ID');
  const secretAccessKey = readEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY');

  if (!bucket || !accountId) {
    throw new Error('R2 configuration incomplete');
  }

  return { bucket, publicBaseUrl, accountId, apiToken, accessKeyId, secretAccessKey };
}

/**
 * Build the full R2 key for a site-scoped file.
 */
export function buildSiteKey(siteId: string, ...path: string[]): string {
  return ['sites', siteId, ...path].join('/');
}

/**
 * Build a public URL for an R2 key.
 */
export function buildPublicUrl(key: string): string {
  const config = getR2Config();
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${config.bucket}.${config.accountId}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Upload a file to R2 via S3-compatible API.
 */
export async function uploadToR2(params: {
  key: string;
  body: ArrayBuffer | Uint8Array | Blob;
  contentType?: string;
  cacheControl?: string;
}): Promise<{ key: string; url: string }> {
  const config = getR2Config();

  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('R2 S3 credentials not configured');
  }

  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${config.bucket}/${params.key}`;

  const contentType = params.contentType || 'application/octet-stream';
  const date = new Date().toUTCString();

  // Convert body to ArrayBuffer for consistent handling
  let bodyArrayBuffer: ArrayBuffer;
  if (params.body instanceof Blob) {
    bodyArrayBuffer = await params.body.arrayBuffer();
  } else if (params.body instanceof Uint8Array) {
    bodyArrayBuffer = new ArrayBuffer(params.body.byteLength);
    new Uint8Array(bodyArrayBuffer).set(params.body);
  } else {
    bodyArrayBuffer = params.body;
  }

  // AWS4-HMAC-SHA256 signing
  const canonicalHeaders = `content-type:${contentType}\nhost:${config.accountId}.r2.cloudflarestorage.com\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${date}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n/${config.bucket}/${params.key}\n\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
  const credentialScope = `${date.split(' ')[0]}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const signature = await hmacSha256(
    await hmacSha256(
      await hmacSha256(
        await hmacSha256(new TextEncoder().encode(`AWS4${config.secretAccessKey}`), date.split(' ')[0]),
        'auto'
      ),
      's3'
    ),
    stringToSign
  );

  const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Authorization': authHeader,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'x-amz-date': date,
      ...(params.cacheControl ? { 'Cache-Control': params.cacheControl } : {}),
    },
    body: bodyArrayBuffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 upload failed: ${response.status} ${text}`);
  }

  return {
    key: params.key,
    url: buildPublicUrl(params.key),
  };
}

/**
 * Delete a file from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const config = getR2Config();

  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('R2 S3 credentials not configured');
  }

  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${config.bucket}/${key}`;

  const date = new Date().toUTCString();
  const canonicalHeaders = `host:${config.accountId}.r2.cloudflarestorage.com\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${date}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `DELETE\n/${config.bucket}/${key}\n\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
  const credentialScope = `${date.split(' ')[0]}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const signature = await hmacSha256(
    await hmacSha256(
      await hmacSha256(
        await hmacSha256(new TextEncoder().encode(`AWS4${config.secretAccessKey}`), date.split(' ')[0]),
        'auto'
      ),
      's3'
    ),
    stringToSign
  );

  const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': authHeader,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'x-amz-date': date,
    },
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`R2 delete failed: ${response.status} ${text}`);
  }
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: CryptoKey | ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const data = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  if (key instanceof CryptoKey) {
    return crypto.subtle.sign('HMAC', key, data);
  }
  let keyBuffer: ArrayBuffer;
  if (key instanceof Uint8Array) {
    keyBuffer = new ArrayBuffer(key.byteLength);
    new Uint8Array(keyBuffer).set(key);
  } else {
    keyBuffer = key;
  }
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, data);
}
