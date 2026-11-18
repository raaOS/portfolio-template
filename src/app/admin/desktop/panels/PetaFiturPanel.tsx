'use client';

// ═══════════════════════════════════════════════════════════════════
// PetaFiturPanel — referensi read-only: app CRUD mana yang kontennya
// ditampilkan template mana. Pasangan dari filter `templateScope`
// (registry admin) — jawaban atas "CRUD ini punya template mana?".
// Sumber kebenaran: audit konten CRUD 2026-11-15 (log tracker).
// ═══════════════════════════════════════════════════════════════════
import { Check, Minus } from 'lucide-react';

type TemplateKey = 'os-desktop' | 'infinite-canvas' | 'spatial-gallery';

interface PetaRow {
  app: string;
  zona: string;
  /** Konten yang dikelola, diringkas */
  konten: string;
  os: boolean;
  canvas: boolean;
  spatial: boolean;
  catatan?: string;
}

const TEMPLATES: { key: TemplateKey; label: string }[] = [
  { key: 'os-desktop', label: 'macOS' },
  { key: 'infinite-canvas', label: 'Canvas' },
  { key: 'spatial-gallery', label: 'Spatial' },
];

const ROWS: PetaRow[] = [
  { app: 'Proyek Karya', zona: 'Konten & Berkas', konten: 'Project + media + detail (narasi, galeri, komentar)', os: true, canvas: true, spatial: true },
  { app: 'Info Profil', zona: 'Konten & Berkas', konten: 'Hero, bio, motto, availability, soft skills, philosophy', os: true, canvas: true, spatial: true },
  { app: 'Pengalaman', zona: 'Konten & Berkas', konten: 'Riwayat kerja / CV', os: true, canvas: true, spatial: true },
  { app: 'Keahlian', zona: 'Konten & Berkas', konten: 'Hard skills', os: true, canvas: true, spatial: true },
  { app: 'Loader Animasi', zona: 'Tampilan', konten: 'Loader boot homepage', os: true, canvas: true, spatial: true },
  { app: 'WhatsApp & Notif', zona: 'Komunikasi', konten: 'Testimoni klien (+ pengaturan WA/notifikasi)', os: true, canvas: true, spatial: true, catatan: 'Testimoni: chat di macOS, list di Canvas & Spatial' },
  { app: 'Info Kontak', zona: 'Komunikasi', konten: 'Email, telepon, alamat, sosmed + chat visitor', os: true, canvas: true, spatial: true },
  { app: 'Tampilan (Appearance)', zona: 'Tampilan', konten: 'Wallpaper (macOS) + Objek 3D tengah (Spatial)', os: true, canvas: false, spatial: true, catatan: 'Split: Canvas tidak memakai keduanya' },
  { app: 'Sistem Dock', zona: 'Tampilan', konten: 'Ikon, label, sembunyikan dock', os: true, canvas: false, spatial: false, catatan: 'Eksklusif macOS (keputusan owner)' },
  { app: 'Widget & Catatan', zona: 'Tampilan', konten: 'Sticky notes dari database', os: true, canvas: false, spatial: false },
  { app: 'File Explorer', zona: 'Konten & Berkas', konten: 'Virtual file system (folder & file)', os: true, canvas: false, spatial: false },
  { app: 'Arsip Galeri', zona: 'Konten & Berkas', konten: 'Arsip file galeri', os: true, canvas: false, spatial: false },
  { app: 'Event Pages', zona: 'Konten & Berkas', konten: 'Landing page event per folder', os: true, canvas: false, spatial: false },
  { app: 'Label & Tag', zona: 'Konten & Berkas', konten: 'Kategori filter proyek (halaman /projects)', os: true, canvas: false, spatial: false },
  { app: 'Feedback', zona: 'Komunikasi', konten: 'Feedback exit-intent pengunjung', os: true, canvas: false, spatial: false },
];

function Cell({ ok }: { ok: boolean }) {
  return ok ? (
    <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="tampil" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-gray-300" aria-label="tidak tampil" />
  );
}

export default function PetaFiturPanel() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-1 text-sm">
      <p className="text-xs leading-relaxed text-gray-500">
        Peta ini menunjukkan <strong>app CRUD mana yang kontennya benar-benar tampil di
        template mana</strong>. Dashboard admin otomatis menyembunyikan app yang tidak
        relevan untuk template aktif deployment ini (filter
        <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px]">templateScope</code>),
        dan datanya tetap aman: mengganti template tidak pernah kehilangan konten.
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[560px] border-collapse text-left text-xs">
          <thead>
            <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 font-semibold">App CRUD</th>
              <th className="px-3 py-2 font-semibold">Konten yang dikelola</th>
              {TEMPLATES.map((t) => (
                <th key={t.key} className="px-2 py-2 text-center font-semibold">
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.app} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2">
                  <div className="font-semibold text-gray-800">{row.app}</div>
                  <div className="text-[10px] text-gray-400">{row.zona}</div>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {row.konten}
                  {row.catatan && (
                    <div className="mt-0.5 text-[10px] italic text-amber-600">{row.catatan}</div>
                  )}
                </td>
                <td className="px-2 py-2 text-center"><Cell ok={row.os} /></td>
                <td className="px-2 py-2 text-center"><Cell ok={row.canvas} /></td>
                <td className="px-2 py-2 text-center"><Cell ok={row.spatial} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-400">
        Fitur khas macOS (Explorer, wallpaper, musik, Spotlight, dll.) tidak diporting ke
        template lain — keputusan owner 2026-11-15. Detail audit:{' '}
        <code className="font-mono text-[10px]">docs/tracker/logs/fitur_penyamaan_konten_template_2026_11_15.md</code>.
      </p>
    </div>
  );
}
