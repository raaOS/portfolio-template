import { describe, expect, it } from 'vitest';
import {
  buildTenantHomeHref,
  buildTenantProjectsHref,
  getTenantBasePath,
  isTenantRoute,
} from './tenantRoutes';

describe('tenant route helpers', () => {
  it('keeps a real tenant slug scoped', () => {
    expect(isTenantRoute('/acme/projects')).toBe(true);
    expect(getTenantBasePath('/acme/projects')).toBe('/acme');
    expect(buildTenantProjectsHref('/acme')).toBe('/acme/projects');
    expect(buildTenantHomeHref('/acme/projects')).toBe('/acme');
    expect(buildTenantHomeHref('/acme/projects', '?app=about')).toBe('/acme?app=about');
  });

  it('routes to /preview/os-desktop when no tenant slug is present', () => {
    expect(buildTenantHomeHref('/projects')).toBe('/preview/os-desktop');
    expect(buildTenantHomeHref('/projects', '?app=about')).toBe('/preview/os-desktop?app=about');
  });

  it.each([
    '/templates',
    '/templates/os-desktop/demo',
    '/preview',
    '/preview/os-desktop',
    '/checkout',
    '/orders/order-1',
  ])('does not treat marketplace route %s as a tenant', (pathname) => {
    expect(isTenantRoute(pathname)).toBe(false);
    expect(getTenantBasePath(pathname)).toBe('');
    expect(buildTenantProjectsHref(pathname)).toBe('/projects');
  });
});
