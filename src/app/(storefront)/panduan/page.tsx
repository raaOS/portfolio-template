import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isStorefrontDeployment } from '@/lib/storefront';

export const metadata: Metadata = {
  title: 'Panduan Klien',
  description:
    'Panduan pemakaian website portfolio untuk klien: login admin, mengisi konten, mengunggah media, mengatur tampilan, dan aturan menjaga resource Cloudflare.',
};

const CONTENT_APPS = [
  ['Proyek Karya', 'Tambah, ubah, dan urutkan karya. Setiap proyek bisa punya cerita (tantangan, solusi, dampak).'],
  ['Info Profil', 'Nama, headline, deskripsi diri, dan tautan sosial.'],
  ['Pengalaman', 'Riwayat kerja, organisasi, atau pendidikan.'],
  ['Keahlian', 'Kelompok skill beserta ikon dan tingkatannya.'],
  ['Arsip Galeri', 'Kumpulan foto/video di luar proyek.'],
  ['File Explorer', 'Kelola berkas media yang sudah diunggah.'],
  ['Info Kontak', 'Email, telepon, dan lokasi yang tampil di halaman kontak.'],
] as const;

const LOOK_APPS = [
  ['Tampilan', 'Wallpaper, warna aksen, dan nuansa tampilan situs.'],
  ['Sistem Dock', 'Susunan dan isi dock di template OS Desktop.'],
  ['Widget & Catatan', 'Widget desktop serta catatan tempel.'],
  ['Loader Animasi', 'Animasi pembuka sebelum desktop tampil.'],
] as const;

const INBOX_APPS = [
  ['Pesan Masuk', 'Pesan dari pengunjung lewat form kontak.'],
  ['Feedback', 'Masukan yang dikirim pengunjung.'],
  ['WhatsApp & Notif', 'Notifikasi masuk ke WhatsApp/kanal yang kamu atur.'],
] as const;

export default function PanduanPage() {
  if (!isStorefrontDeployment()) notFound();

  return (
    <>
      <p className="lp-eyebrow">Panduan Klien</p>
      <h1 className="lp-title">Cara mengurus website-mu sendiri</h1>
      <p className="lp-lead">
        Setelah website online, semua isi dan tampilannya kamu pegang sendiri lewat
        panel admin. Halaman ini menjelaskan langkah paling umum. Simpan link-nya.
      </p>

      <div className="lp-doc" style={{ marginTop: 26 }}>
        <h2>1. Masuk ke panel admin</h2>
        <p>
          Buka <code>https://alamat-website-kamu/admin/login</code>, lalu masuk dengan
          email dan password yang kami kirimkan saat serah terima. Setelah login, kamu
          akan melihat desktop admin berisi kumpulan aplikasi.
        </p>
        <p>
          Lupa password? Klik tautan <strong>Lupa password</strong> di halaman login,
          atau minta reset ke kami lewat email di bawah. Jangan berikan password ke
          siapa pun.
        </p>

        <h2>2. Mengisi konten</h2>
        <p>
          Mulai dari aplikasi di zona <strong>Konten &amp; Berkas</strong>. Urutan yang
          paling masuk akal: profil dulu, lalu proyek, lalu keahlian dan pengalaman.
        </p>
        <ul>
          {CONTENT_APPS.map(([name, desc]) => (
            <li key={name}>
              <strong>{name}</strong> — {desc}
            </li>
          ))}
        </ul>
        <p>
          Setiap perubahan langsung tersimpan ke database dan tampil di situs dalam
          hitungan detik. Tidak ada tombol deploy yang perlu kamu tekan.
        </p>

        <h2>3. Mengunggah foto dan video</h2>
        <ul>
          <li>
            Foto sebaiknya berformat JPG/PNG dengan sisi terpanjang sekitar 1600–2000
            piksel agar cepat dimuat.
          </li>
          <li>
            Video wallpaper dikompresi otomatis di browser sebelum diunggah — biarkan
            tab tetap terbuka sampai proses selesai.
          </li>
          <li>
            Poster video dibuat otomatis dari satu frame. Jangan menghapus berkas
            pendamping (<code>-preview.mp4</code> atau <code>.jpg</code>) di bucket;
            itu bagian dari video yang sama.
          </li>
          <li>
            Kalau fitur media belum aktif di paketmu, unggahan akan ditolak dengan pesan
            jelas. Hubungi kami untuk mengaktifkannya.
          </li>
        </ul>

        <h3>Tampilan</h3>
        <ul>
          {LOOK_APPS.map(([name, desc]) => (
            <li key={name}>
              <strong>{name}</strong> — {desc}
            </li>
          ))}
        </ul>

        <h3>Kotak masuk</h3>
        <ul>
          {INBOX_APPS.map(([name, desc]) => (
            <li key={name}>
              <strong>{name}</strong> — {desc}
            </li>
          ))}
        </ul>

        <h2>4. Jangan hapus resource Cloudflare</h2>
        <p>
          Website-mu berjalan di akun Cloudflare milikmu sendiri, memakai tiga resource
          utama:
        </p>
        <ul>
          <li>
            <strong>Worker</strong> — aplikasi yang menyajikan halaman dan API.
          </li>
          <li>
            <strong>Database D1</strong> — seluruh teks konten, proyek, dan pesan.
          </li>
          <li>
            <strong>Bucket R2</strong> — semua foto dan video.
          </li>
        </ul>
        <div className="lp-note">
          Menghapus salah satu resource di atas akan menghapus website atau datanya, dan
          tidak bisa dibatalkan. Kalau kamu ingin berhenti memakai layanan ini, hubungi
          kami dulu — kami bantu membuat cadangan sebelum apa pun dihapus.
        </div>

        <h2>5. Kapan menghubungi kami</h2>
        <ul>
          <li>Website menampilkan error atau tidak bisa dibuka.</li>
          <li>Lupa password dan tombol reset tidak mengirim email.</li>
          <li>Ingin mengaktifkan fitur media (R2), AI, atau notifikasi.</li>
          <li>Ingin mengganti template atau menambah halaman di luar template.</li>
        </ul>
        <p>
          Kirim email ke{' '}
          <a href="mailto:m4keitbetter@gmail.com">m4keitbetter@gmail.com</a> dengan
          menyertakan alamat website dan tangkapan layar masalahnya. Sebutkan juga
          perangkat dan browser yang kamu pakai supaya kami lebih cepat menemukan
          penyebabnya.
        </p>

        <h2>Kebiasaan yang membuat website tetap sehat</h2>
        <ul>
          <li>Simpan salinan foto/video asli di komputer atau drive sendiri.</li>
          <li>Gunakan tombol Backup Database di panel admin sebelum perubahan besar.</li>
          <li>Hapus media yang tidak terpakai lewat File Explorer, bukan dari dasbor cloud.</li>
          <li>Jangan mengubah kode atau konfigurasi deploy tanpa berdiskusi dengan kami.</li>
        </ul>
      </div>

      <div className="lp-actions" style={{ marginTop: 26 }}>
        <Link href="/harga" className="lp-btn">
          Harga &amp; isi paket
        </Link>
        <Link href="/syarat-ketentuan" className="lp-btn">
          Syarat &amp; Ketentuan
        </Link>
      </div>
    </>
  );
}
