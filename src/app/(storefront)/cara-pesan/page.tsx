import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isStorefrontDeployment } from '@/lib/storefront';

export const metadata: Metadata = {
  title: 'Cara Pesan',
  description:
    'Lima langkah memesan template portfolio: pilih template, bayar via QRIS, verifikasi pembayaran, onboarding Cloudflare, lalu website online.',
};

const STEPS = [
  {
    title: 'Pilih template dan cek demonya',
    body: (
      <>
        Coba <Link href="/">demo di beranda</Link>, jalankan demonya, lalu
        tentukan satu yang paling cocok. Template masih bisa diganti sebelum website
        dinyalakan.
      </>
    ),
  },
  {
    title: 'Isi data pesanan dan bayar',
    body: (
      <>
        Di <Link href="/checkout">halaman checkout</Link>, isi nama, email, nomor
        WhatsApp, alamat website yang diinginkan, dan template pilihanmu. Setelah
        submit, kamu diarahkan ke halaman pembayaran QRIS.
      </>
    ),
  },
  {
    title: 'Tunggu verifikasi pembayaran',
    body: (
      <>
        Pembayaran diperiksa manual, paling lambat <strong>1×24 jam</strong> pada hari
        kerja. Status pesanan bisa kamu pantau di link pesanan yang muncul setelah
        checkout.
      </>
    ),
  },
  {
    title: 'Onboarding akun Cloudflare',
    body: (
      <>
        Kami yang membuatkan email dan akun Cloudflare untuk website-mu, lalu memasang
        semuanya di sana — kamu tidak perlu membuat akun sendiri. Satu-satunya langkah yang
        wajib kamu kerjakan sendiri: mengaktifkan penyimpanan media (R2), karena Cloudflare
        butuh kartu/PayPal milikmu untuk verifikasinya. Langkahnya kami pandu lewat tautan
        khusus.
      </>
    ),
  },
  {
    title: 'Website online, kamu terima kunci admin',
    body: (
      <>
        Setelah deploy selesai, kamu menerima alamat website dan kredensial login admin.
        Mulai dari situ semua konten diisi sendiri. Panduan lengkap ada di{' '}
        <Link href="/panduan">Panduan Klien</Link>.
      </>
    ),
  },
] as const;

const PREPARE = [
  'Email aktif — dipakai untuk kredensial admin dan komunikasi pesanan.',
  'Nomor WhatsApp aktif — untuk koordinasi onboarding.',
  'Tidak perlu membuat akun Cloudflare sendiri — kami yang buatkan saat onboarding.',
  'Kartu atau PayPal atas namamu — hanya untuk verifikasi R2 jika ingin mengunggah foto/video.',
  'Materi konten: teks profil, daftar proyek, foto/logo. Boleh menyusul setelah online.',
];

export default function CaraPesanPage() {
  if (!isStorefrontDeployment()) notFound();

  return (
    <>
      <p className="lp-eyebrow">Cara Pesan</p>
      <h1 className="lp-title">Dari pesan sampai online, lima langkah</h1>
      <p className="lp-lead">
        Tidak perlu paham Cloudflare atau koding. Bagian teknis kami yang urus; kamu
        yang menentukan isi dan tampilannya.
      </p>

      <section className="lp-section" aria-labelledby="cara-langkah">
        <h2 className="lp-h2" id="cara-langkah">
          Alurnya
        </h2>
        <ol className="lp-steps">
          {STEPS.map((step) => (
            <li key={step.title} className="lp-step">
              <h3 className="lp-h3">{step.title}</h3>
              <p className="lp-p" style={{ marginBottom: 0 }}>
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section" aria-labelledby="cara-siap">
        <h2 className="lp-h2" id="cara-siap">
          Yang perlu kamu siapkan
        </h2>
        <ul className="lp-list">
          {PREPARE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="lp-note" style={{ marginTop: 14 }}>
          <strong>Belum punya kartu untuk R2?</strong> Tidak masalah. Website bisa
          dinyalakan lebih dulu tanpa media, lalu diaktifkan setelah R2 siap. Kualitas
          dan tampilan template tetap sama.
        </div>
      </section>

      <section className="lp-section" aria-labelledby="cara-biaya">
        <h2 className="lp-h2" id="cara-biaya">
          Setelah website online
        </h2>
        <p className="lp-p">
          Kamu bisa mengubah konten kapan saja lewat <code>/admin</code> — tanpa biaya
          tambahan dan tanpa menghubungi kami. Kalau ada yang macet, panduan langkah
          demi langkah tersedia di Panduan Klien.
        </p>
        <div className="lp-actions">
          <Link href="/checkout" className="lp-btn lp-btn-primary">
            Mulai pesan <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/harga" className="lp-btn">
            Lihat harga &amp; isi paket
          </Link>
          <Link href="/panduan" className="lp-btn">
            Panduan Klien
          </Link>
        </div>
      </section>
    </>
  );
}
