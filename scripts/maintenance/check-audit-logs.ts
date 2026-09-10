import * as dotenv from 'dotenv';
import path from 'path';
import { queryD1 } from '../src/lib/cloudflareD1';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const rows = await queryD1<{ key: string; value: string }>(
    'SELECT key, value FROM app_kv WHERE key = ?',
    ['audit_logs']
  );

  if (rows.length === 0) {
    console.log('No audit_logs key found in D1.');
    return;
  }

  const logs = JSON.parse(rows[0].value);
  console.log('=== LATEST AUDIT LOGS ===');
  if (Array.isArray(logs)) {
    logs
      .slice(-15)
      .reverse()
      .forEach((log, idx) => {
        console.log(`[${idx}] Time: ${log.timestamp || log.createdAt || 'N/A'}`);
        console.log(`    Action: ${log.action || log.message}`);
        console.log(`    User: ${log.user || log.userId || log.ip || 'N/A'}`);
      });
  } else {
    console.log('Logs is not an array:', typeof logs);
    console.log(logs);
  }
}

main().catch(console.error);
