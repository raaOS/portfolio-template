import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATE_PRICE,
  TEMPLATES,
  TemplateChangeError,
  applyTemplateChange,
  checkTemplateVersionGate,
  compareVersions,
  decideTemplateAction,
  ensureTemplateCatalog,
  readTemplateState,
  validatePurchasePrice,
  type TemplateQuery,
  type TemplateState,
} from './template-purchase';

function baseState(overrides: Partial<TemplateState> = {}): TemplateState {
  return {
    siteId: 'site-gladi',
    siteName: 'Gladi',
    activeTemplateKey: 'os-desktop',
    siteCreatedAt: '2026-10-24 10:00:00',
    owned: [
      {
        templateId: 'os-desktop',
        purchasedAt: '2026-10-24 10:00:00',
        price: 199000,
        grantedBy: 'onboarding',
      },
    ],
    catalogReady: true,
    ...overrides,
  };
}

function createFakeQuery(initial: {
  activeKey: string;
  entitlements: string[];
}): {
  query: TemplateQuery;
  calls: Array<{ sql: string; params: Array<string | number | null> }>;
  state: { activeKey: string; entitlements: Set<string> };
} {
  const state = {
    activeKey: initial.activeKey,
    entitlements: new Set(initial.entitlements),
  };
  const calls: Array<{ sql: string; params: Array<string | number | null> }> = [];

  const query: TemplateQuery = async (sql, params = []) => {
    calls.push({ sql, params });

    if (sql.includes('COUNT(*) AS total')) return [{ total: 3 }];
    if (sql.startsWith('INSERT INTO portfolio_templates')) return [];
    if (sql.startsWith('INSERT OR IGNORE INTO site_template_entitlements')) {
      state.entitlements.add(String(params[2]));
      return [];
    }
    if (sql.startsWith('SELECT id FROM site_template_entitlements')) {
      const key = String(params[1]);
      return state.entitlements.has(key) ? [{ id: 'ent-1' }] : [];
    }
    if (sql.startsWith('UPDATE sites')) {
      state.activeKey = String(params[0]);
      return [];
    }
    if (sql.startsWith('SELECT active_template_key')) {
      return [{ active_template_key: state.activeKey }];
    }
    if (sql.startsWith('INSERT INTO audit_logs')) return [];
    return [];
  };

  return { query, calls, state };
}

describe('validatePurchasePrice', () => {
  it('menerima nominal valid termasuk batas bawah/atas', () => {
    expect(validatePurchasePrice(199000)).toEqual({ valid: true, value: 199000 });
    expect(validatePurchasePrice('199000')).toEqual({ valid: true, value: 199000 });
    expect(validatePurchasePrice(50000).valid).toBe(true);
    expect(validatePurchasePrice(50000000).valid).toBe(true);
  });

  it('menolak nol hilang, desimal, dan teks', () => {
    expect(validatePurchasePrice(1990).valid).toBe(false);
    expect(validatePurchasePrice(199000.5).valid).toBe(false);
    expect(validatePurchasePrice('abc').valid).toBe(false);
    expect(validatePurchasePrice(null).valid).toBe(false);
    expect(validatePurchasePrice(49999).valid).toBe(false);
    expect(validatePurchasePrice(50000001).valid).toBe(false);
  });
});

describe('compareVersions', () => {
  it('membandingkan versi numerik, bukan string', () => {
    expect(compareVersions('1.3.90', '1.3.9')).toBeGreaterThan(0);
    expect(compareVersions('1.3.88', '1.3.90')).toBeLessThan(0);
    expect(compareVersions('1.3.90', '1.3.90')).toBe(0);
  });
});

describe('checkTemplateVersionGate', () => {
  it('memblokir canvas/spatial di build < 1.3.88', () => {
    const gate = checkTemplateVersionGate('1.3.87', 'infinite-canvas');
    expect(gate.level).toBe('block');
  });

  it('memberi peringatan untuk build < 1.3.90', () => {
    expect(checkTemplateVersionGate('1.3.89', 'spatial-gallery').level).toBe('warn');
  });

  it('lolos sejak 1.3.90', () => {
    expect(checkTemplateVersionGate('1.3.90', 'infinite-canvas').level).toBe('ok');
  });

  it('template default tidak diblokir, tapi versi tak terbaca tetap peringatan', () => {
    expect(checkTemplateVersionGate('1.3.80', 'os-desktop').level).toBe('ok');
    expect(checkTemplateVersionGate(null, 'os-desktop').level).toBe('warn');
  });
});

describe('decideTemplateAction', () => {
  it('noop saat template sudah aktif', () => {
    const action = decideTemplateAction(baseState(), 'os-desktop', 'activate');
    expect(action.kind).toBe('noop');
  });

  it('gratis saat template sudah dimiliki tapi belum aktif', () => {
    const state = baseState();
    state.owned.push({
      templateId: 'infinite-canvas',
      purchasedAt: '2026-11-01 09:00:00',
      price: 199000,
      grantedBy: 'portal',
    });
    expect(decideTemplateAction(state, 'infinite-canvas', 'activate').kind).toBe('activate');
    // Mode purchase pun tidak boleh membuat order lagi.
    expect(decideTemplateAction(state, 'infinite-canvas', 'purchase').kind).toBe('activate');
  });

  it('menolak aktivasi gratis untuk template yang belum dibeli', () => {
    const action = decideTemplateAction(baseState(), 'spatial-gallery', 'activate');
    expect(action.kind).toBe('error');
    if (action.kind === 'error') {
      expect(action.message).toContain('belum dibeli');
    }
  });

  it('mewajibkan pembelian untuk template baru', () => {
    expect(decideTemplateAction(baseState(), 'spatial-gallery', 'purchase').kind).toBe('purchase');
  });

  it('menolak key asing', () => {
    expect(decideTemplateAction(baseState(), 'template-racun', 'purchase').kind).toBe('error');
  });
});

describe('readTemplateState', () => {
  it('membaca site + entitlement dari D1 klien', async () => {
    const query: TemplateQuery = async (sql) => {
      if (sql.startsWith('SELECT id, name, active_template_key')) {
        return [
          {
            id: 'site-gladi',
            name: 'Gladi',
            active_template_key: 'infinite-canvas',
            created_at: '2026-10-24 10:00:00',
          },
        ];
      }
      if (sql.includes('FROM site_template_entitlements')) {
        return [
          {
            template_id: 'infinite-canvas',
            purchased_at: '2026-11-01 09:00:00',
            price: 199000,
            granted_by: 'portal:ORD-1',
          },
        ];
      }
      if (sql.includes('COUNT(*) AS total')) return [{ total: 3 }];
      return [];
    };

    const state = await readTemplateState(query, 'site-gladi');
    expect(state.siteId).toBe('site-gladi');
    expect(state.activeTemplateKey).toBe('infinite-canvas');
    expect(state.owned).toEqual([
      {
        templateId: 'infinite-canvas',
        purchasedAt: '2026-11-01 09:00:00',
        price: 199000,
        grantedBy: 'portal:ORD-1',
      },
    ]);
    expect(state.catalogReady).toBe(true);
  });

  it('berhenti kalau jumlah baris sites bukan 1', async () => {
    const query: TemplateQuery = async (sql) => {
      if (sql.startsWith('SELECT id, name')) return [{ id: 'a' }, { id: 'b' }];
      return [];
    };
    await expect(readTemplateState(query)).rejects.toThrow('harus tepat 1');
  });

  it('berhenti kalau CUSTOMER_SITE_ID tidak cocok', async () => {
    const query: TemplateQuery = async (sql) => {
      if (sql.startsWith('SELECT id, name')) {
        return [{ id: 'site-lain', name: 'X', active_template_key: null, created_at: '' }];
      }
      return [];
    };
    await expect(readTemplateState(query, 'site-gladi')).rejects.toThrow('tidak sinkron');
  });
});

describe('ensureTemplateCatalog', () => {
  it('meng-upsert semua template dari registry', async () => {
    const calls: Array<{ sql: string; params: Array<string | number | null> }> = [];
    const query: TemplateQuery = async (sql, params = []) => {
      calls.push({ sql, params });
      return [];
    };

    await ensureTemplateCatalog(query, { price: 199000 });

    expect(calls).toHaveLength(TEMPLATES.length);
    const ids = calls.map((call) => call.params[0]);
    expect(ids).toEqual(TEMPLATES.map((template) => template.id));
    expect(calls.every((call) => call.params[3] === 199000)).toBe(true);
  });

  it('jatuh ke harga default bila nominal tidak valid', async () => {
    const prices: unknown[] = [];
    const query: TemplateQuery = async (_sql, params = []) => {
      prices.push(params[3]);
      return [];
    };
    await ensureTemplateCatalog(query, { price: 10 });
    expect(prices.every((price) => price === DEFAULT_TEMPLATE_PRICE)).toBe(true);
  });
});

describe('applyTemplateChange', () => {
  it('pembelian template baru menulis entitlement + key + audit', async () => {
    const { query, calls, state } = createFakeQuery({
      activeKey: 'os-desktop',
      entitlements: ['os-desktop'],
    });

    const result = await applyTemplateChange(query, baseState(), {
      templateKey: 'infinite-canvas',
      price: 199000,
      orderId: 'ORD-20261118-ABCDEF',
      catalogPrice: 199000,
    });

    expect(result.changed).toBe(true);
    expect(result.entitlementCreated).toBe(true);
    expect(result.previousKey).toBe('os-desktop');
    expect(state.activeKey).toBe('infinite-canvas');
    expect(state.entitlements.has('infinite-canvas')).toBe(true);

    const entitlementInsert = calls.find((call) =>
      call.sql.startsWith('INSERT OR IGNORE INTO site_template_entitlements')
    );
    expect(entitlementInsert?.params[3]).toBe(199000);
    expect(entitlementInsert?.params[4]).toBe('portal:ORD-20261118-ABCDEF');

    const auditInsert = calls.find((call) => call.sql.startsWith('INSERT INTO audit_logs'));
    expect(auditInsert?.params[3]).toBe('template_purchased');
    expect(String(auditInsert?.params[6])).toContain('ORD-20261118-ABCDEF');
  });

  it('pindah ke template yang sudah dibeli tidak menulis entitlement/order', async () => {
    const { query, calls, state } = createFakeQuery({
      activeKey: 'os-desktop',
      entitlements: ['os-desktop', 'infinite-canvas'],
    });
    const ownedState = baseState();
    ownedState.owned.push({
      templateId: 'infinite-canvas',
      purchasedAt: '2026-11-01 09:00:00',
      price: 199000,
      grantedBy: 'portal:ORD-1',
    });

    const result = await applyTemplateChange(query, ownedState, {
      templateKey: 'infinite-canvas',
      catalogPrice: 199000,
    });

    expect(result.entitlementCreated).toBe(false);
    expect(result.changed).toBe(true);
    expect(state.activeKey).toBe('infinite-canvas');
    expect(calls.some((call) => call.sql.startsWith('INSERT OR IGNORE'))).toBe(false);
    const auditInsert = calls.find((call) => call.sql.startsWith('INSERT INTO audit_logs'));
    expect(auditInsert?.params[3]).toBe('template_activated');
  });

  it('menolak pembelian tanpa harga valid', async () => {
    const { query } = createFakeQuery({ activeKey: 'os-desktop', entitlements: ['os-desktop'] });
    await expect(
      applyTemplateChange(query, baseState(), { templateKey: 'infinite-canvas' })
    ).rejects.toThrow('Harga');
  });

  it('error setelah entitlement tersimpan ditandai parsial (order jangan dihapus)', async () => {
    const query: TemplateQuery = async (sql) => {
      if (sql.includes('COUNT(*) AS total')) return [{ total: 3 }];
      if (sql.startsWith('SELECT id FROM site_template_entitlements')) return [{ id: 'ent-1' }];
      if (sql.startsWith('UPDATE sites')) throw new Error('D1 menolak update');
      return [];
    };

    let caught: unknown = null;
    try {
      await applyTemplateChange(query, baseState(), {
        templateKey: 'infinite-canvas',
        price: 199000,
        orderId: 'ORD-X',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TemplateChangeError);
    const failure = caught as TemplateChangeError;
    expect(failure.partial.entitlementCreated).toBe(true);
    expect(failure.partial.keyChanged).toBe(false);
  });

  it('audit gagal tidak membatalkan aktivasi', async () => {
    const { query, state } = createFakeQuery({
      activeKey: 'os-desktop',
      entitlements: ['os-desktop', 'infinite-canvas'],
    });
    const wrapped: TemplateQuery = async (sql, params = []) => {
      if (sql.startsWith('INSERT INTO audit_logs')) throw new Error('tabel audit sibuk');
      return query(sql, params);
    };
    const ownedState = baseState();
    ownedState.owned.push({
      templateId: 'infinite-canvas',
      purchasedAt: '2026-11-01 09:00:00',
      price: 199000,
      grantedBy: 'portal:ORD-1',
    });

    const result = await applyTemplateChange(wrapped, ownedState, {
      templateKey: 'infinite-canvas',
      catalogPrice: 199000,
    });

    expect(result.changed).toBe(true);
    expect(result.auditWarning).toContain('tabel audit sibuk');
    expect(state.activeKey).toBe('infinite-canvas');
  });
});
