/**
 * Backward-compatible entrypoint for demo SQL seed.
 *
 * Live writes are guarded by PRODUCT_CLOUDFLARE_ENV_CONFIRMED in
 * product-bootstrap.ts.
 */
process.argv.push('--seed-demo');
await import('./product-bootstrap');
