'use client';

import React, { useState, useEffect } from 'react';
import type { TemplateMetadata } from '@/types/template';

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New Template Form
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<'os' | 'landing' | '3d'>('landing');
  const [newTier, setNewTier] = useState<'lite' | 'pro'>('lite');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/admin/templates');
      if (!res.ok) throw new Error('Failed to load templates catalog');
      const data = await res.json();
      setTemplates(data.templates || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) {
        await loadTemplates();
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          name: newName,
          description: newDesc,
          category: newCategory,
          tierRequired: newTier,
          priceIdr: Number(newPrice),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create template');

      setNewId('');
      setNewName('');
      setNewDesc('');
      setNewPrice(0);
      loadTemplates();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (tpl: TemplateMetadata) => {
    try {
      setError(null);
      const res = await fetch(`/api/admin/templates/${tpl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !tpl.isActive }),
      });

      if (!res.ok) throw new Error('Failed to update template status');
      loadTemplates();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0c] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Master Admin: Master Katalog Template</h1>
          <p className="text-xs text-white/50">Kelola katalog template, visibilitas Lite/Pro, harga lisensi, dan status keaktifan.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            ⚠️ {error}
          </div>
        )}

        {/* Form Tambah Template Baru */}
        <form onSubmit={handleCreateTemplate} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-sm font-bold text-emerald-400">Tambah Template Baru</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] text-white/60">Template ID (slug)</label>
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="e.g. landing-retro"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-white/60">Nama Template</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Retro Terminal OS"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-white/60">Harga Add-on (IDR)</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] text-white/60">Kategori</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as 'os' | 'landing' | '3d')}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
              >
                <option value="landing">Landing Page</option>
                <option value="os">OS Simulator</option>
                <option value="3d">3D Spatial</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-white/60">Syarat Tier Minimal</label>
              <select
                value={newTier}
                onChange={(e) => setNewTier(e.target.value as 'lite' | 'pro')}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
              >
                <option value="lite">Lite</option>
                <option value="pro">Pro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-white/60">Deskripsi Singkat</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Deskripsi singkat mengenai tema visual dan fitur..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white h-20"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Template'}
          </button>
        </form>

        {/* Table List Template */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-4 font-bold text-sm">Daftar Katalog Template</div>
          {loading ? (
            <div className="p-8 text-center text-xs text-white/50">Memuat data...</div>
          ) : (
            <div className="divide-y divide-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Nama</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Tier</th>
                    <th className="p-3">Harga</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-white/5">
                      <td className="p-3 font-mono font-bold text-emerald-400">{tpl.id}</td>
                      <td className="p-3 font-semibold text-white">{tpl.name}</td>
                      <td className="p-3 uppercase">{tpl.category}</td>
                      <td className="p-3 uppercase font-bold text-amber-300">{tpl.tierRequired}</td>
                      <td className="p-3 font-mono">Rp {tpl.priceIdr.toLocaleString('id-ID')}</td>
                      <td className="p-3">
                        {tpl.isActive ? (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">Aktif</span>
                        ) : (
                          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-400">Non-aktif</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleToggleActive(tpl)}
                          className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:bg-white/20"
                        >
                          {tpl.isActive ? 'Matikan' : 'Aktifkan'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
