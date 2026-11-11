'use client';

import AlurBisnisDiagram from './AlurBisnisDiagram';
import { CATATAN_SOP, PETA_ASET } from './bizMapContent';

/**
 * Peta Bisnis — alur jualan & peta aset (app `petaBisnis`, zona Sistem Owner,
 * ownerOnly). Pindah penuh dari portal PENGELOLA_KLIEN di v1.3.79 setelah flow
 * berubah (deferred R2, v1.3.78). Alur dirender sebagai diagram SVG berwarna
 * (`AlurBisnisDiagram`); konten ada di `bizMapContent.ts` (sumber tunggal).
 */

export default function PetaBisnisPanel() {
  return (
    <div className="h-full overflow-y-auto px-5 pb-6 pt-4">
      {/* Alur Bisnis — diagram 6 fase */}
      <section aria-label="Alur Bisnis">
        <h3 className="text-sm font-semibold text-slate-700">Alur Jualan</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Sesuai flow v1.3.78 (deferred R2): deploy hari-1 tanpa media, klien aktivasi via wizard,
          owner menyelesaikan setup. Panah diwarnai per fase; kotak diwarnai per pelaku.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
          <AlurBisnisDiagram />
        </div>
      </section>

      {/* Peta Aset */}
      <section aria-label="Peta Aset" className="mt-6">
        <h3 className="text-sm font-semibold text-slate-700">Peta Aset</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {PETA_ASET.map((group) => (
            <div key={group.label} className="rounded-xl border border-slate-200 bg-white/70 p-3">
              <p className="text-xs font-bold text-slate-700">
                {group.label}
                {group.hint ? (
                  <span className="ml-1 font-normal text-slate-400">— {group.hint}</span>
                ) : null}
              </p>
              <ul className="mt-2 space-y-1">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-1.5 text-[11px] leading-snug text-slate-600">
                    <span aria-hidden className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* SOP ringkas */}
      <section aria-label="Catatan SOP" className="mt-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <p className="text-xs font-bold text-amber-700">Catatan SOP (wajib)</p>
          <ul className="mt-2 space-y-1.5">
            {CATATAN_SOP.map((note) => (
              <li key={note} className="flex gap-1.5 text-[11px] leading-snug text-amber-800/90">
                <span aria-hidden className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="mt-4 pb-2 text-[10px] text-slate-300">
        Sumber tunggal konten: src/app/admin/desktop/panels/bizMapContent.ts — alur berubah? ubah
        di sana (log v1.3.79).
      </p>
    </div>
  );
}
