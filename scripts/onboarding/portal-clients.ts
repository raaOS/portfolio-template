import fs from 'fs';
import path from 'path';
import { buildClientEnvPlan, clientUrls } from './client-deploy';
import { parseEnv } from './env-file';

export interface ClientSummary {
  id: string;
  clientName: string;
  clientSlug: string;
  adminEmail: string;
  websiteUrl: string;
  adminUrl: string;
  customDomain: string;
  templateKey: string;
  /** true hanya bila semua kunci wajib deploy terisi (sumber: buildClientEnvPlan). */
  deployable: boolean;
  /** Kunci wajib yang masih kosong; dipakai UI untuk menjelaskan alasan. */
  missingKeys: string[];
}

/** Hasil penilaian satu konfigurasi arsip terhadap syarat deploy klien. */
export function assessDeployability(env: Record<string, string>): {
  deployable: boolean;
  missingKeys: string[];
} {
  // Sengaja memakai fungsi yang SAMA dengan server deploy, supaya tombol di UI
  // tidak pernah menawarkan hal yang pasti gagal di server.
  const missingKeys = buildClientEnvPlan(env).missing;
  return { deployable: missingKeys.length === 0, missingKeys };
}

export interface SkippedDeployTarget {
  id: string;
  clientName: string;
  clientSlug: string;
  reason: string;
}

export interface DeployTargets {
  deployable: ClientSummary[];
  skipped: SkippedDeployTarget[];
}

/**
 * Pilih target deploy dari daftar folder eksplisit (bukan `all`), lalu pisahkan
 * yang siap deploy dari yang dilewati. Folder tak dikenal / hilang juga masuk
 * `skipped` supaya UI bisa melaporkannya sebagai "dilewati", bukan "gagal".
 */
export function partitionDeployTargets(
  summaries: ClientSummary[],
  folderNames: string[]
): DeployTargets {
  const byId = new Map(summaries.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const deployable: ClientSummary[] = [];
  const skipped: SkippedDeployTarget[] = [];

  for (const rawFolder of folderNames) {
    const folder = typeof rawFolder === 'string' ? rawFolder.trim() : '';
    if (!folder || seen.has(folder)) continue;
    seen.add(folder);

    const client = byId.get(folder);
    if (!client) {
      skipped.push({
        id: folder,
        clientName: folder,
        clientSlug: folder.replace(/^\d+_/, ''),
        reason: 'Arsip klien tidak ditemukan.',
      });
      continue;
    }

    if (!client.deployable) {
      skipped.push({
        id: client.id,
        clientName: client.clientName,
        clientSlug: client.clientSlug,
        reason:
          'Konfigurasi klien belum lengkap: ' +
          (client.missingKeys.join(', ') || 'tidak diketahui'),
      });
      continue;
    }

    deployable.push(client);
  }

  return { deployable, skipped };
}

export interface ClientDetail extends ClientSummary {
  siteId: string;
  archiveFolder: string;
  workerName: string;
  infra: {
    accountIdMasked: string;
    d1DatabaseName: string;
    d1DatabaseIdMasked: string;
    r2BucketName: string;
    kvIncNamespaceIdMasked: string;
    kvTagNamespaceIdMasked: string;
  };
  credentialStatus: {
    adminPassword: boolean;
    cloudflareApiToken: boolean;
    cloudflareD1ApiToken: boolean;
  };
}

export interface ClientSecrets {
  adminEmail: string;
  adminPassword: string;
  cloudflareApiToken: string;
  cloudflareD1ApiToken: string;
  accountId: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  r2BucketName: string;
  kvIncNamespaceId: string;
  kvTagNamespaceId: string;
}

/**
 * Nama folder arsip harus satu komponen path yang aman. Ini menolak
 * `..`, slash/backslash, drive letter Windows, dan nama kosong.
 */
export function isSafeArchiveFolderName(folderName: unknown): folderName is string {
  return (
    typeof folderName === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/.test(folderName)
  );
}

export function resolveArchiveConfigPath(
  archiveDir: string,
  folderName: string
): string | null {
  if (!isSafeArchiveFolderName(folderName)) return null;

  const root = path.resolve(archiveDir);
  const configPath = path.resolve(root, folderName, 'config.env');
  if (!configPath.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(configPath) || !fs.statSync(configPath).isFile()) return null;

  // Tolak symlink folder yang menunjuk ke luar arsip-klien.
  try {
    const realRoot = fs.realpathSync(root);
    const realConfig = fs.realpathSync(configPath);
    const rootWithSep = realRoot.toLowerCase() + path.sep;
    if (!realConfig.toLowerCase().startsWith(rootWithSep)) return null;
  } catch {
    return null;
  }

  return configPath;
}

function readClientEnv(archiveDir: string, folderName: string) {
  const envPath = resolveArchiveConfigPath(archiveDir, folderName);
  if (!envPath) return null;
  try {
    const env = parseEnv(fs.readFileSync(envPath, 'utf-8'));
    return { envPath, env };
  } catch {
    return null;
  }
}

export function maskIdentifier(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function listClientSummaries(archiveDir: string): ClientSummary[] {
  if (!fs.existsSync(archiveDir)) return [];

  return fs
    .readdirSync(archiveDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isSafeArchiveFolderName(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))
    .flatMap((folderName) => {
      const data = readClientEnv(archiveDir, folderName);
      if (!data) return [];
      const { env } = data;
      const urls = clientUrls(env, folderName);
      const deploy = assessDeployability(env);
      return [{
        id: folderName,
        clientName: env.CUSTOMER_NAME || folderName,
        clientSlug: env.CUSTOMER_SLUG || folderName.replace(/^\d+_/, ''),
        adminEmail: env.ADMIN_EMAIL || '',
        websiteUrl: urls.websiteUrl,
        adminUrl: urls.adminUrl,
        customDomain: env.CUSTOM_DOMAIN || '',
        templateKey: env.ACTIVE_TEMPLATE_KEY || 'os-desktop',
        deployable: deploy.deployable,
        missingKeys: deploy.missingKeys,
      }];
    });
}

export function readClientDetail(
  archiveDir: string,
  folderName: string
): ClientDetail | null {
  const data = readClientEnv(archiveDir, folderName);
  if (!data) return null;
  const { env } = data;
  const urls = clientUrls(env, folderName);
  const clientSlug = env.CUSTOMER_SLUG || folderName.replace(/^\d+_/, '');
  const deploy = assessDeployability(env);

  return {
    id: folderName,
    clientName: env.CUSTOMER_NAME || folderName,
    clientSlug,
    adminEmail: env.ADMIN_EMAIL || '',
    websiteUrl: urls.websiteUrl,
    adminUrl: urls.adminUrl,
    customDomain: env.CUSTOM_DOMAIN || '',
    templateKey: env.ACTIVE_TEMPLATE_KEY || 'os-desktop',
    deployable: deploy.deployable,
    missingKeys: deploy.missingKeys,
    siteId: env.CUSTOMER_SITE_ID || clientSlug,
    archiveFolder: `arsip-klien/${folderName}`,
    workerName: clientSlug,
    infra: {
      accountIdMasked: maskIdentifier(env.CLOUDFLARE_ACCOUNT_ID || ''),
      d1DatabaseName: env.CLOUDFLARE_D1_DATABASE_NAME || '',
      d1DatabaseIdMasked: maskIdentifier(env.CLOUDFLARE_D1_DATABASE_ID || ''),
      r2BucketName: env.CLOUDFLARE_R2_BUCKET_NAME || env.CLOUDFLARE_R2_BUCKET || '',
      kvIncNamespaceIdMasked: maskIdentifier(env.CLOUDFLARE_KV_INC_NAMESPACE_ID || ''),
      kvTagNamespaceIdMasked: maskIdentifier(env.CLOUDFLARE_KV_TAG_NAMESPACE_ID || ''),
    },
    credentialStatus: {
      adminPassword: Boolean(env.ADMIN_PASSWORD),
      cloudflareApiToken: Boolean(env.CLOUDFLARE_API_TOKEN),
      cloudflareD1ApiToken: Boolean(env.CLOUDFLARE_D1_API_TOKEN),
    },
  };
}

/**
 * Hanya field yang memang boleh ditampilkan setelah brankas dibuka.
 * JWT_SECRET, PASSWORD_SALT, dan CRON_SECRET sengaja tidak pernah keluar.
 */
export function readClientSecrets(
  archiveDir: string,
  folderName: string
): ClientSecrets | null {
  const data = readClientEnv(archiveDir, folderName);
  if (!data) return null;
  const { env } = data;

  return {
    adminEmail: env.ADMIN_EMAIL || '',
    adminPassword: env.ADMIN_PASSWORD || '',
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN || '',
    cloudflareD1ApiToken: env.CLOUDFLARE_D1_API_TOKEN || '',
    accountId: env.CLOUDFLARE_ACCOUNT_ID || '',
    d1DatabaseName: env.CLOUDFLARE_D1_DATABASE_NAME || '',
    d1DatabaseId: env.CLOUDFLARE_D1_DATABASE_ID || '',
    r2BucketName: env.CLOUDFLARE_R2_BUCKET_NAME || env.CLOUDFLARE_R2_BUCKET || '',
    kvIncNamespaceId: env.CLOUDFLARE_KV_INC_NAMESPACE_ID || '',
    kvTagNamespaceId: env.CLOUDFLARE_KV_TAG_NAMESPACE_ID || '',
  };
}

export interface ProjectVersions {
  /** Versi kode yang benar-benar dibangun (`src/lib/constants.ts`). */
  appVersion: string | null;
  /** Versi pada judul teratas `CHANGELOG.md` (catatan rilis). */
  changelogVersion: string | null;
  /** Versi acuan perbandingan — selalu versi kode bila terbaca. */
  latestVersion: string | null;
}

/**
 * S5 (audit 2026-10-26): "terbaru" dulu diambil dari CHANGELOG, sehingga portal
 * bisa menyebut 1.3.71 padahal kode sudah 1.3.72/1.3.73. Sekarang versi kode
 * jadi acuan, dan selisih keduanya dilaporkan supaya bisa ditindaklanjuti.
 */
export function readProjectVersions(rootDir: string): ProjectVersions {
  let changelogVersion: string | null = null;
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const match = fs.readFileSync(changelogPath, 'utf-8').match(/##\s*\[([^\]]+)\]/);
    changelogVersion = match ? match[1].trim() : null;
  }

  let appVersion: string | null = null;
  const constantsPath = path.join(rootDir, 'src', 'lib', 'constants.ts');
  if (fs.existsSync(constantsPath)) {
    const match = fs
      .readFileSync(constantsPath, 'utf-8')
      .match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    appVersion = match ? match[1].trim() : null;
  }

  return {
    appVersion,
    changelogVersion,
    latestVersion: appVersion || changelogVersion,
  };
}
