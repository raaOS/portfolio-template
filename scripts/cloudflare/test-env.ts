/**
 * Product Cloudflare Environment Doctor.
 *
 * Default mode is offline/safe: it checks key presence only and never prints
 * secret values. Use --live-check only after confirming this env points to the
 * dedicated product Cloudflare account.
 */
import { queryD1 } from '../../src/lib/cloudflareD1';
import {
  loadProductEnv,
  printProductEnvReport,
  requireProductCloudflareEnvConfirmed,
} from './product-env';

loadProductEnv();

async function main() {
  const report = printProductEnvReport();
  const isLiveCheck = process.argv.includes('--live-check');

  if (!isLiveCheck) {
    console.log('');
    console.log('Offline env doctor complete. No Cloudflare request was sent.');
    return;
  }

  if (report.missingRequired.length > 0 || report.backendIssues.length > 0) {
    throw new Error('Product env is incomplete. Fix missing keys before live check.');
  }

  requireProductCloudflareEnvConfirmed('run live Cloudflare connectivity check');
  const rows = await queryD1<{ ok: number }>('SELECT 1 as ok');
  console.log(`D1 live check: ${rows[0]?.ok === 1 ? 'ok' : 'unexpected response'}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
