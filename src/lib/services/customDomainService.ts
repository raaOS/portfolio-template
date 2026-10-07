import { bootstrapD1Schema, isD1Configured, queryD1 } from '@/lib/cloudflareD1';

export interface CustomDomainRecord {
  siteId: string;
  customDomain: string | null;
  cnameTarget: string;
  status: 'unconfigured' | 'pending_cname' | 'active' | 'error';
  sslStatus: 'active' | 'pending_validation' | 'none' | 'error';
  updatedAt: string;
}

type CustomDomainRow = {
  site_id: string;
  hostname: string;
  cloudflare_hostname_id: string | null;
  hostname_status: string;
  ssl_status: string;
  updated_at: string;
};

type CloudflareHostname = {
  id: string;
  hostname: string;
  status?: string;
  ssl?: { status?: string };
};

type CloudflareResponse = {
  success?: boolean;
  result?: CloudflareHostname | CloudflareHostname[];
  errors?: Array<{ message?: string }>;
};

const records = new Map<string, CustomDomainRow>();

function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

export function isCustomDomainEnabled() {
  return readEnv('FEATURE_CUSTOM_DOMAIN') === 'true';
}

function getCloudflareConfig() {
  const apiToken = readEnv('CLOUDFLARE_CUSTOM_HOSTNAME_API_TOKEN');
  const zoneId = readEnv('CLOUDFLARE_ZONE_ID');
  const cnameTarget = readEnv('CLOUDFLARE_CUSTOM_DOMAIN_CNAME_TARGET');
  const missing = [
    !apiToken && 'CLOUDFLARE_CUSTOM_HOSTNAME_API_TOKEN',
    !zoneId && 'CLOUDFLARE_ZONE_ID',
    !cnameTarget && 'CLOUDFLARE_CUSTOM_DOMAIN_CNAME_TARGET',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Custom domain env is incomplete: ${missing.join(', ')}`);
  }

  return { apiToken, zoneId, cnameTarget };
}

function getCnameTarget() {
  return readEnv('CLOUDFLARE_CUSTOM_DOMAIN_CNAME_TARGET');
}

export function normalizeCustomDomain(input: string) {
  const hostname = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');

  if (!hostname || hostname.length > 253 || hostname.includes(':')) {
    throw new Error('Invalid custom domain');
  }

  const labels = hostname.split('.');
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )
  ) {
    throw new Error('Invalid custom domain');
  }

  return hostname;
}

function mapRow(row: CustomDomainRow): CustomDomainRecord {
  const status =
    row.hostname_status === 'active' && row.ssl_status === 'active'
      ? 'active'
      : row.hostname_status === 'error' || row.ssl_status === 'error'
        ? 'error'
        : 'pending_cname';

  return {
    siteId: row.site_id,
    customDomain: row.hostname,
    cnameTarget: getCnameTarget(),
    status,
    sslStatus:
      row.ssl_status === 'active'
        ? 'active'
        : row.ssl_status === 'error'
          ? 'error'
          : 'pending_validation',
    updatedAt: row.updated_at,
  };
}

function emptyRecord(siteId: string): CustomDomainRecord {
  return {
    siteId,
    customDomain: null,
    cnameTarget: getCnameTarget(),
    status: 'unconfigured',
    sslStatus: 'none',
    updatedAt: new Date().toISOString(),
  };
}

function cloudflareError(payload: CloudflareResponse, fallback: string) {
  return payload.errors?.map((error) => error.message).filter(Boolean).join('; ') || fallback;
}

async function cloudflareRequest(path: string, init?: RequestInit) {
  const { apiToken, zoneId } = getCloudflareConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    }
  );
  const payload = (await response.json().catch(() => ({}))) as CloudflareResponse;
  if (!response.ok || !payload.success) {
    throw new Error(cloudflareError(payload, `Cloudflare custom hostname failed (${response.status})`));
  }
  return payload;
}

async function findCloudflareHostname(hostname: string) {
  const payload = await cloudflareRequest(`?hostname=${encodeURIComponent(hostname)}`);
  const result = Array.isArray(payload.result) ? payload.result[0] : payload.result;
  return result || null;
}

async function createCloudflareHostname(hostname: string) {
  try {
    const payload = await cloudflareRequest('', {
      method: 'POST',
      body: JSON.stringify({
        hostname,
        ssl: { method: 'http', type: 'dv' },
      }),
    });
    return Array.isArray(payload.result) ? payload.result[0] : payload.result;
  } catch (error) {
    const existing = await findCloudflareHostname(hostname).catch(() => null);
    if (existing) return existing;
    throw error;
  }
}

async function readCloudflareHostname(id: string, hostname: string) {
  if (id) {
    const payload = await cloudflareRequest(`/${encodeURIComponent(id)}`);
    const result = Array.isArray(payload.result) ? payload.result[0] : payload.result;
    if (result) return result;
  }
  return findCloudflareHostname(hostname);
}

async function persistCloudflareHostname(siteId: string, hostname: CloudflareHostname) {
  const now = new Date().toISOString();
  const row: CustomDomainRow = {
    site_id: siteId,
    hostname: hostname.hostname,
    cloudflare_hostname_id: hostname.id,
    hostname_status: hostname.status || 'pending',
    ssl_status: hostname.ssl?.status || 'pending_validation',
    updated_at: now,
  };

  await queryD1(
    `INSERT INTO site_custom_domains
       (site_id, hostname, cloudflare_hostname_id, hostname_status, ssl_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(site_id) DO UPDATE SET
       hostname = excluded.hostname,
       cloudflare_hostname_id = excluded.cloudflare_hostname_id,
       hostname_status = excluded.hostname_status,
       ssl_status = excluded.ssl_status,
       updated_at = excluded.updated_at`,
    [siteId, row.hostname, row.cloudflare_hostname_id, row.hostname_status, row.ssl_status, now, now]
  );
  records.set(siteId, row);
  return mapRow(row);
}

export class CustomDomainService {
  getRecord(siteId: string) {
    const row = records.get(siteId);
    return row ? mapRow(row) : null;
  }

  async getStatuses(siteIds: string[]) {
    if (!isD1Configured() || siteIds.length === 0) return new Map<string, CustomDomainRecord>();
    await bootstrapD1Schema();
    const placeholders = siteIds.map(() => '?').join(', ');
    const rows = (await queryD1<CustomDomainRow>(
      `SELECT site_id, hostname, cloudflare_hostname_id, hostname_status, ssl_status, updated_at
       FROM site_custom_domains WHERE site_id IN (${placeholders})`,
      siteIds
    )) || [];
    const result = new Map<string, CustomDomainRecord>();
    if (Array.isArray(rows)) {
      for (const row of rows) {
        records.set(row.site_id, row);
        result.set(row.site_id, mapRow(row));
      }
    }
    return result;
  }

  async getStatus(siteId: string) {
    const statuses = await this.getStatuses([siteId]);
    return statuses.get(siteId) || emptyRecord(siteId);
  }

  async registerDomain(siteId: string, input: string) {
    if (!isCustomDomainEnabled()) throw new Error('Custom domain feature is disabled');
    await bootstrapD1Schema();
    await this.getStatus(siteId);

    if (!input.trim()) {
      const row = records.get(siteId);
      if (row?.cloudflare_hostname_id) {
        await cloudflareRequest(`/${encodeURIComponent(row.cloudflare_hostname_id)}`, {
          method: 'DELETE',
        });
      }
      await queryD1('DELETE FROM site_custom_domains WHERE site_id = ?', [siteId]);
      records.delete(siteId);
      return emptyRecord(siteId);
    }

    const hostname = normalizeCustomDomain(input);
    const conflict = await queryD1<{ site_id: string }>(
      'SELECT site_id FROM site_custom_domains WHERE hostname = ? AND site_id != ? LIMIT 1',
      [hostname, siteId]
    );
    if (conflict.length > 0) throw new Error('Custom domain is already assigned to another site');

    getCloudflareConfig();
    const previous = records.get(siteId) || null;
    const cloudflareHostname = await createCloudflareHostname(hostname);
    if (!cloudflareHostname?.id) throw new Error('Cloudflare did not return a custom hostname ID');
    const result = await persistCloudflareHostname(siteId, cloudflareHostname);

    if (
      previous?.cloudflare_hostname_id &&
      previous.cloudflare_hostname_id !== cloudflareHostname.id
    ) {
      await cloudflareRequest(`/${encodeURIComponent(previous.cloudflare_hostname_id)}`, {
        method: 'DELETE',
      }).catch(() => undefined);
    }

    return result;
  }

  async verifyDomain(siteId: string) {
    if (!isCustomDomainEnabled()) throw new Error('Custom domain feature is disabled');
    const current = await this.getStatus(siteId);
    const row = records.get(siteId);
    if (!current.customDomain || !row) return current;

    const hostname = await readCloudflareHostname(
      row.cloudflare_hostname_id || '',
      row.hostname
    );
    if (!hostname) throw new Error('Custom hostname was not found in Cloudflare');
    return persistCloudflareHostname(siteId, hostname);
  }

  // `resolveActiveSiteByDomain` (rewrite `/{slug}` multi-tenant) sudah dihapus
  // bersama konsep tenant — tidak ada lagi pemanggilnya.
}

export const customDomainService = new CustomDomainService();
