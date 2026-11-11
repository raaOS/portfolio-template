import { afterEach, describe, expect, it, vi } from 'vitest';
import CheckoutPage from '@/app/checkout/page';

/**
 * v1.3.82 — gerbang `/checkout`.
 *
 * Middleware sudah mem-404-kan jalur ini di situs klien, tapi halaman dulu
 * komponen client murni tanpa penjaga sendiri. Test ini mengunci perilaku:
 * hanya deployment toko (`STOREFRONT=true`) yang boleh merender form.
 */
describe('/checkout', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('404 di deployment klien', async () => {
    vi.stubEnv('STOREFRONT', 'false');
    await expect(CheckoutPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
  });

  it('404 saat STOREFRONT tidak diset sama sekali', async () => {
    vi.stubEnv('STOREFRONT', '');
    await expect(CheckoutPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
  });

  it('meneruskan ?template= ke form', async () => {
    vi.stubEnv('STOREFRONT', 'true');
    const node = await CheckoutPage({
      searchParams: Promise.resolve({ template: 'infinite-canvas' }),
    });
    expect((node.props as { initialTemplateId?: string }).initialTemplateId).toBe(
      'infinite-canvas'
    );
  });

  it('tanpa ?template= form memilih template default sendiri', async () => {
    vi.stubEnv('STOREFRONT', 'true');
    const node = await CheckoutPage({ searchParams: Promise.resolve({}) });
    expect((node.props as { initialTemplateId?: string }).initialTemplateId).toBeUndefined();
  });
});
