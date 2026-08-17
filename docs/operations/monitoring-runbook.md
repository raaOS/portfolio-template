# Monitoring Runbook

Status: Sprint 45 operational baseline.

Tujuan monitoring ini adalah mendeteksi error production sebelum buyer melapor. Semua alert dan log memakai kontrak produk generic, bukan integrasi personal legacy.

## Synthetic Checks

Command utama:

```bash
npm run monitoring:synthetic -- --url https://makeitbetter.my.id --site-slug urgent
```

Endpoint yang dicek:

- `/api/health`
- `/`
- `/client/login`
- `/client/reset-password`
- `/api/public/sites/{siteSlug}`
- `/api/public/sites/{siteSlug}/projects`

Script juga bisa mengecek storage/quota per site memakai D1/R2 env lokal. Default warning threshold adalah 80% dari quota efektif.

Untuk cron lokal atau CI, jalankan minimal tiap 5 menit:

```bash
npm run monitoring:synthetic -- --url https://makeitbetter.my.id --site-slug urgent --out .audit-reports/monitoring/latest.json
```

Untuk membuktikan Sprint 45 full operational pass, jalankan loop 24 jam:

```bash
npm run monitoring:synthetic:loop -- --url https://makeitbetter.my.id --site-slug urgent --duration-hours 24 --interval-minutes 5 --alert-provider resend --out-dir .audit-reports/monitoring/24h
```

Setelah 24 jam, verifikasi bukti:

```bash
npm run monitoring:verify-24h -- --dir .audit-reports/monitoring/24h --duration-hours 24 --interval-minutes 5 --require-external-alert --alert-report .audit-reports/monitoring/external-alert-test.json --out .audit-reports/monitoring/sprint-45-24h-verification.json
```

Contoh Windows Task Scheduler:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\USER\Documents\portfolio-template'; npm run monitoring:synthetic -- --url https://makeitbetter.my.id --site-slug urgent --out .audit-reports/monitoring/latest.json"
```

## Alert Providers

Supported provider:

- `console`: menulis payload alert JSON ke stdout/stderr. Cocok untuk CI/cron yang sudah punya log alert.
- `webhook`: mengirim POST JSON ke `MONITORING_ALERT_WEBHOOK_URL`.
- `resend`: mengirim email memakai Resend. Gunakan `MONITORING_ALERT_RESEND_API_KEY` atau fallback `NOTIFICATION_API_KEY`.
- `none`: alert eksternal mati.

Env names only:

```bash
MONITORING_ALERT_PROVIDER=webhook
MONITORING_ALERT_WEBHOOK_URL=
```

atau:

```bash
MONITORING_ALERT_PROVIDER=resend
MONITORING_ALERT_FROM=
MONITORING_ALERT_TO=
MONITORING_ALERT_RESEND_API_KEY=
```

Jangan commit nilai env asli.

## Test Alert

Test alert tanpa merusak production:

```bash
npm run monitoring:synthetic -- --url https://makeitbetter.my.id --site-slug urgent --simulate-failure --alert-provider console --expect-failure
```

Untuk provider eksternal:

```bash
npm run monitoring:synthetic -- --url https://makeitbetter.my.id --site-slug urgent --simulate-failure --expect-failure --out .audit-reports/monitoring/external-alert-test.json
```

Pass jika operator menerima alert dan report mencatat alert `sent=true`.

Untuk Resend, minimal env yang harus ada:

```bash
MONITORING_ALERT_PROVIDER=resend
MONITORING_ALERT_TO=
MONITORING_ALERT_FROM=
MONITORING_ALERT_RESEND_API_KEY=
```

`MONITORING_ALERT_FROM` dan `MONITORING_ALERT_RESEND_API_KEY` boleh memakai fallback `NOTIFICATION_DEFAULT_FROM` dan `NOTIFICATION_API_KEY`. `MONITORING_ALERT_TO` tetap wajib karena system harus tahu operator yang menerima alert.

## Structured Operational Logs

Runtime sekarang menulis log JSON dengan `type=portfolio_os_operational_event`.

Event yang dicakup:

- `admin.login`
- `client.login`
- `client.password_reset.request`
- `client.password_reset.confirm`
- `site.create`
- `site.update`
- `site.delete`
- `client_access.save`
- `project.create`
- `project.update`
- `project.publish`
- `project.delete`
- `r2.upload`
- `d1.query_error`

Log sengaja tidak mencetak password, token, cookie, authorization header, CSRF token, atau API key. Request context dibatasi ke method, path, `cf-ray`, dan country.

## Daily Dashboard Checklist

Cek harian:

- Cloudflare Worker logs: filter `portfolio_os_operational_event`.
- Error spikes:
  - `level=error`
  - `event=d1.query_error`
  - `event=r2.upload` dengan `status=failure`
  - `event=client.login` dengan `status=failure` atau `blocked`
  - `event=client.password_reset.*` dengan `status=failure`
- Synthetic report terakhir: `.audit-reports/monitoring/latest.json`.
- Storage/quota warning dari synthetic check.
- Cloudflare dashboard:
  - 5xx rate
  - Worker CPU/timeouts
  - request volume anomaly
  - R2/D1 errors

## Incident Triage

1. Jalankan synthetic check manual.
2. Buka Cloudflare logs dan filter `cf-ray` dari synthetic failure jika ada.
3. Jika `/api/health` degraded, cek D1 env dan D1 availability.
4. Jika upload gagal, filter `event=r2.upload status=failure`.
5. Jika login/reset gagal, filter event auth/reset dan cek rate limit sebelum mengubah credential.
6. Jika storage warning, cek quota site dan R2 prefix `sites/{siteId}/`.

## Pass Criteria Sprint 45

Lulus penuh jika:

- Synthetic check production berjalan minimal 24 jam tiap 5 menit.
- Alert dummy diterima operator lewat provider eksternal atau sistem log yang dipantau.
- 5xx/D1/R2/login/reset error muncul sebagai structured log.
- Tidak ada secret/token tercetak di log.

Jika script dan log sudah ada tetapi belum berjalan 24 jam atau provider alert eksternal belum dikonfigurasi, status yang jujur adalah implemented, not fully operationally proven.
