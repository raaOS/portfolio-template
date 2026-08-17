# Multi Buyer Load Test - 2026-07-14

Status: not executed live.

Sprint 46 load-test runner and cleanup tooling were prepared, but live traffic remains blocked until Sprint 45 monitoring gets a full 24h verifier pass and operator confirms external alert email delivery.

Prepared verification only:

- `node --check scripts/load/multi-buyer-load-test.js`
- `node --check scripts/load/cleanup-load-test-tenants.js`
- `npm run load:multi-buyer -- --target https://makeitbetter.my.id --tenants 5 --dry-run --run-id lt20260714-dry`

Dry-run report:

- `.audit-reports/load/multi-buyer-lt20260714-dry.json`
- `.audit-reports/load/multi-buyer-lt20260714-dry.md`

Live run command after Sprint 45 full-pass:

```bash
npm run load:multi-buyer -- --target https://makeitbetter.my.id --tenants 5 --run-live --confirm-host makeitbetter.my.id --cleanup-after
```
