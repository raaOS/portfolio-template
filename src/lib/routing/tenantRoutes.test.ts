import { describe, expect, it } from 'vitest';
import {
  buildTenantProjectsHref,
  getTenantBasePath,
  isTenantRoute,
} from './tenantRoutes';

describe('tenant route helpers', () => {
  it('keeps a real tenant slug scoped', () => {
    expect(isTenantRoute('/acme/projects')).toBe(true);
    expect(getTenantBasePath('/acme/projects')).toBe('/acme');
    expect(buildTenantProjectsHref('/acme')).toBe('/acme/projects');
  });

  it.each([
    '/templates',
    '/templates/os-desktop/demo',
    '/checkout',
    '/orders/order-1',
  ])('does not treat marketplace route %s as a tenant', (pathname) => {
    expect(isTenantRoute(pathname)).toBe(false);
    expect(getTenantBasePath(pathname)).toBe('');
    expect(buildTenantProjectsHref(pathname)).toBe('/projects');
  });
});
