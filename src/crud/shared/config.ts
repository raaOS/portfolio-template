/**
 * Shared Core — Config
 * Hardcoded SITE_ID for single-customer deployment.
 *
 * @module
 */

/** The site ID for this deployment. Each customer gets one D1 with one site. */
export const SITE_ID = process.env.CUSTOMER_SITE_ID || 'default-site';
