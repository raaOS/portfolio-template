import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isStorefrontDeployment } from '@/lib/storefront';

export const metadata: Metadata = {
  title: 'Fitur',
  description:
    'Apa saja yang bisa kamu kelola sendiri lewat admin panel: proyek, profil, pengalaman, keahlian, galeri, wallpaper, dock, widget, loader, pesan, dan notifikasi.',
};

const CONTENT_APPS = [
  ['Proyek Karya', 'Tambah, ubah, urutkan karya. Tiap proyek bisa punya cerita tantangan, solusi, dan dampak.'],
  ['Info Profil', 'Nama, headline, deskripsi diri, dan tautan sosial.'],
  ['Pengalaman', 'Riwayat kerja, organisasi, atau pendidikan.'],
  ['Keahlian', 'Kelompok skill beserta ikon dan tingkatannya.'],
  ['Arsip Galeri', 'Kumpulan foto dan video di luar proyek.'],
  ['Label & Tag', 'Penanda untuk mengelompokkan karya.'],
  ['File Explorer', 'Kelola semua berkas media yang sudah diunggah.'],
  ['Event Pages', 'Halaman khusus untuk acara atau momen tertentu.'],
] as const;

const LOOK_APPS = [
  ['Tampilan', 'Wallpaper, warna aksen, dan nuansa tampilan situs.'],
  ['Sistem Dock', 'Susunan dan isi dock pada template OS Desktop.'],
  ['Widget & Catatan', 'Widget desktop serta catatan tempel.'],
  ['Loader Animasi', 'Animasi pembuka sebelum desktop tampil.'],
] as const;

const INBOX_APPS = [
  ['Pesan Masuk', 'Pesan dari pengunjung lewat form kontak.'],
  ['Feedback', 'Masukan yang dikirim pengunjung.'],
  ['WhatsApp & Notif', 'Notifikasi masuk ke WhatsApp atau kanal yang kamu atur.'],
  ['Info Kontak', 'Email, telepon, dan lokasi yang tampil di halaman kontak.'],
] as const;

const SYSTEM_APPS = [
  ['Asisten AI', 'Chatbot untuk menjawab pertanyaan pengunjung (opsional).'],
  ['Statistik Pengunjung', 'Angka kunjungan dan halaman yang paling dilihat.'],
  ['Log Aktivitas', 'Jejak perubahan yang dilakukan dari panel admin.'],
  ['Backup Database', 'Simpan salinan data sebelum perubahan besar.'],
] as const;

function AppList({ apps }: { apps: readonly (readonly [string, string])[] }) {
  return (
    <ul className="lp-list">
      {apps.map(([name, desc]) => (
        <li key={name}>
          <strong>{name}</strong> — {desc}
        </li>
      ))}
    </ul>
  );
}

export default function FiturPage() {
  if (!isStorefrontDeployment()) notFound();

  return (
    <>
      <p className="lp-eyebrow">Fitur</p>
      <h1 className="lp-title">Yang bisa kamu ubah sendiri, tanpa koding</h1>
      <p className="lp-lead">
        Setelah website online, semuanya diatur dari satu panel di <code>/admin</code>.
        Tidak ada deploy ulang, tidak perlu menghubungi kami untuk mengganti teks atau foto.
      </p>

      <section className="lp-section" aria-labelledby="fitur-konten">
        <h2 className="lp-h2" id="fitur-konten">
          Zona Konten &amp; Berkas
        </h2>
        <p className="lp-p">Isi utama website. Semua perubahan langsung tampil di situs.</p>
        <AppList apps={CONTENT_APPS} />
      </section>

      <section className="lp-section" aria-labelledby="fitur-tampilan">
        <h2 className="lp-h2" id="fitur-tampilan">
          Zona Tampilan
        </h2>
        <p className="lp-p">Wajah website: dari wallpaper sampai animasi pembuka.</p>
        <AppList apps={LOOK_APPS} />
      </section>

      <section className="lp-section" aria-labelledby="fitur-komunikasi">
        <h2 className="lp-h2" id="fitur-komunikasi">
          Zona Komunikasi
        </h2>
        <p className="lp-p">Pesan dan masukan pengunjung, terkumpul di satu tempat.</p>
        <AppList apps={INBOX_APPS} />
      </section>

      <section className="lp-section" aria-labelledby="fitur-sistem">
        <h2 className="lp-h2" id="fitur-sistem">
          Zona Sistem
        </h2>
        <p className="lp-p">
          Alat bantu operasional. Beberapa di antaranya opsional dan bisa dinyalakan belakangan.
        </p>
        <AppList apps={SYSTEM_APPS} />
      </section>

      <section className="lp-section" aria-labelledby="fitur-media">
        <h2 className="lp-h2" id="fitur-media">
          Foto &amp; video
        </h2>
        <ul className="lp-list">
          <li>
            Video dikompresi otomatis di browser sebelum diunggah, jadi file besar tidak
            membebani kuota.
          </li>
          <li>Poster video dibuat otomatis dari satu frame — tidak perlu bikin thumbnail manual.</li>
          <li>Semua file disimpan di bucket R2 milikmu, bukan di server kami.</li>
          <li>Foto dan video pendamping bisa dihapus lewat File Explorer, bukan dari dasbor cloud.</li>
        </ul>
      </section>

      <section className="lp-section" aria-labelledby="fitur-batas">
        <h2 className="lp-h2" id="fitur-batas">
          Yang tidak termasuk
        </h2>
        <p className="lp-p">
          Supaya tidak ada kejutan, ini batasnya:
        </p>
        <ul className="lp-list">
          <li>Mengubah struktur template atau menambah halaman baru di luar template = pekerjaan tambahan.</li>
          <li>Integrasi baru (misalnya pembayaran atau sistem eksternal) dibicarakan terpisah.</li>
          <li>Fitur media butuh R2. Kalau belum siap verifikasi kartu, website tetap online tanpa foto/video.</li>
        </ul>
        <div className="lp-note">
          Semua yang ada di daftar atas bisa kamu ubah kapan saja, tanpa biaya tambahan
          dan tanpa menghubungi kami.
        </div>
      </section>

      <div className="lp-actions" style={{ marginTop: 26 }}>
        <Link href="/harga" className="lp-btn lp-btn-primary">
          Lihat harga &amp; isi paket <span aria-hidden="true">↗</span>
        </Link>
        <Link href="/cara-pesan" className="lp-btn">
          Cara pesan
        </Link>
      </div>
    </>
  );
}
