import crypto from 'crypto';
import { queryD1 } from '@/lib/cloudflareD1';
import { hashClientPassword, normalizeClientEmail } from '@/lib/clientAuth';
import { cleanEnvVar } from '@/lib/utils/env';

const DEFAULT_RESET_TTL_MINUTES = 30;
const RESET_TOKEN_BYTES = 32;

type ClientResetAccessRow = {
  access_id: string;
  site_id: string;
  email: string;
  access_status: string;
  site_slug: string;
  site_name: string;
  site_status: string;
};

type ResetTokenRow = {
  id: string;
  site_id: string;
  access_id: string;
  email: string;
  status: string;
  expires_at: string;
  access_status: string;
  site_status: string;
};

type ResetDeliveryResult = {
  delivered: boolean;
  reason?: string;
};

type CreateResetResult = {
  accepted: boolean;
  delivery: ResetDeliveryResult;
};

function readResetTtlMinutes() {
  const raw = Number(cleanEnvVar('CLIENT_PASSWORD_RESET_TOKEN_TTL_MINUTES'));
  if (!Number.isInteger(raw) || raw < 5 || raw > 120) return DEFAULT_RESET_TTL_MINUTES;
  return raw;
}

export function isClientPasswordResetEnabled() {
  return cleanEnvVar('FEATURE_CLIENT_PASSWORD_RESET') !== 'false';
}

function requireResetSalt() {
  const salt = cleanEnvVar('PASSWORD_SALT');
  if (!salt) throw new Error('PASSWORD_SALT is not configured');
  return salt;
}

function createRawResetToken() {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url');
}

export function hashClientPasswordResetToken(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new Error('Reset token is required');

  return crypto
    .createHash('sha256')
    .update(`${normalizedToken}:${requireResetSalt()}`)
    .digest('hex');
}

function normalizeBaseUrl(baseUrl?: string) {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed;
}

export function getPublicAppBaseUrl(requestOrigin?: string) {
  return (
    normalizeBaseUrl(cleanEnvVar('NEXT_PUBLIC_SITE_URL')) ||
    normalizeBaseUrl(cleanEnvVar('NEXT_PUBLIC_APP_URL')) ||
    normalizeBaseUrl(requestOrigin || '')
  );
}

async function getActiveClientAccess(siteSlug: string, email: string) {
  const rows = await queryD1<ClientResetAccessRow>(
    `SELECT
       ca.id as access_id,
       ca.site_id,
       ca.email,
       ca.status as access_status,
       s.slug as site_slug,
       s.name as site_name,
       s.status as site_status
     FROM client_access ca
     INNER JOIN sites s ON s.id = ca.site_id
     WHERE s.slug = ? AND ca.email = ?
     LIMIT 1`,
    [siteSlug.trim(), normalizeClientEmail(email)]
  );

  const access = rows[0] ?? null;
  if (!access) return null;
  if (access.access_status !== 'active' || access.site_status !== 'active') return null;
  return access;
}

function buildResetUrl(baseUrl: string, token: string) {
  if (!baseUrl) return '';
  const url = new URL('/client/reset-password', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

async function sendClientPasswordResetEmail({
  to,
  siteName,
  resetUrl,
  expiresMinutes,
}: {
  to: string;
  siteName: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<ResetDeliveryResult> {
  const provider = (cleanEnvVar('NOTIFICATION_PROVIDER') || '').toLowerCase();
  if (!provider) {
    return { delivered: false, reason: 'notification-provider-not-configured' };
  }

  if (!resetUrl) {
    return { delivered: false, reason: 'public-app-url-not-configured' };
  }

  if (provider === 'resend') {
    const apiKey = cleanEnvVar('NOTIFICATION_API_KEY');
    const from = cleanEnvVar('NOTIFICATION_DEFAULT_FROM');
    if (!apiKey || !from) {
      return { delivered: false, reason: 'resend-env-incomplete' };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Reset password ${siteName}`,
        text: [
          `Reset password untuk ${siteName}.`,
          `Buka link ini dalam ${expiresMinutes} menit:`,
          resetUrl,
          '',
          'Jika kamu tidak meminta reset password, abaikan email ini.',
        ].join('\n'),
        html: [
          `<p>Reset password untuk <strong>${siteName}</strong>.</p>`,
          `<p>Link ini berlaku ${expiresMinutes} menit.</p>`,
          `<p><a href="${resetUrl}">Reset password client dashboard</a></p>`,
          '<p>Jika kamu tidak meminta reset password, abaikan email ini.</p>',
        ].join(''),
      }),
    });

    if (!response.ok) {
      return { delivered: false, reason: `resend-${response.status}` };
    }

    return { delivered: true };
  }

  if (provider === 'console' && process.env.NODE_ENV !== 'production') {
    console.info('[ClientPasswordReset] Dev reset URL:', resetUrl);
    return { delivered: true, reason: 'console-dev' };
  }

  return { delivered: false, reason: `unsupported-provider-${provider}` };
}

export async function createClientPasswordResetRequest({
  siteSlug,
  email,
  requestOrigin,
}: {
  siteSlug: string;
  email: string;
  requestOrigin?: string;
}): Promise<CreateResetResult> {
  if (!isClientPasswordResetEnabled()) {
    return {
      accepted: false,
      delivery: { delivered: false, reason: 'client-password-reset-disabled' },
    };
  }

  const access = await getActiveClientAccess(siteSlug, email);
  if (!access) {
    return { accepted: true, delivery: { delivered: true, reason: 'generic-no-account-leak' } };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresMinutes = readResetTtlMinutes();
  const expiresAt = new Date(now.getTime() + expiresMinutes * 60 * 1000).toISOString();
  const rawToken = createRawResetToken();
  const tokenHash = hashClientPasswordResetToken(rawToken);
  const resetUrl = buildResetUrl(getPublicAppBaseUrl(requestOrigin), rawToken);

  await queryD1(
    `UPDATE client_password_resets
     SET status = 'superseded', updated_at = ?
     WHERE access_id = ? AND status = 'pending'`,
    [nowIso, access.access_id]
  );

  await queryD1(
    `INSERT INTO client_password_resets
       (id, site_id, access_id, email, token_hash, status, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      `client-reset-${crypto.randomUUID()}`,
      access.site_id,
      access.access_id,
      access.email,
      tokenHash,
      expiresAt,
      nowIso,
      nowIso,
    ]
  );

  const delivery = await sendClientPasswordResetEmail({
    to: access.email,
    siteName: access.site_name,
    resetUrl,
    expiresMinutes,
  });

  return { accepted: true, delivery };
}

export async function resetClientPasswordWithToken({
  token,
  newPassword,
}: {
  token: string;
  newPassword: string;
}) {
  const tokenHash = hashClientPasswordResetToken(token);
  const nowIso = new Date().toISOString();
  const rows = await queryD1<ResetTokenRow>(
    `SELECT
       cpr.id,
       cpr.site_id,
       cpr.access_id,
       cpr.email,
       cpr.status,
       cpr.expires_at,
       ca.status as access_status,
       s.status as site_status
     FROM client_password_resets cpr
     INNER JOIN client_access ca ON ca.id = cpr.access_id AND ca.site_id = cpr.site_id
     INNER JOIN sites s ON s.id = cpr.site_id
     WHERE cpr.token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );

  const reset = rows[0];
  if (!reset || reset.status !== 'pending') return false;
  if (reset.access_status !== 'active' || reset.site_status !== 'active') return false;
  if (new Date(reset.expires_at).getTime() < Date.now()) {
    await queryD1(`UPDATE client_password_resets SET status = 'expired', updated_at = ? WHERE id = ?`, [
      nowIso,
      reset.id,
    ]);
    return false;
  }

  await queryD1(
    `UPDATE client_access
     SET password_hash = ?, updated_at = ?
     WHERE id = ? AND site_id = ?`,
    [hashClientPassword(newPassword), nowIso, reset.access_id, reset.site_id]
  );

  await queryD1(
    `UPDATE client_password_resets
     SET status = 'used', used_at = ?, updated_at = ?
     WHERE id = ? AND status = 'pending'`,
    [nowIso, nowIso, reset.id]
  );

  await queryD1(
    `UPDATE client_password_resets
     SET status = 'superseded', updated_at = ?
     WHERE access_id = ? AND status = 'pending'`,
    [nowIso, reset.access_id]
  );

  return true;
}
