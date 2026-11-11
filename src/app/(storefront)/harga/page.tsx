import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isStorefrontDeployment } from '@/lib/storefront';
import { getBasePrice } from '@/lib/services/pricingConfigService';
import { BASE_PRICE, formatIdr } from '@/constants/pricing';

export const metadata: Metadata = {
  title: 'Harga',
  description:
    'Satu harga, tanpa langganan bulanan. Rp199.000 untuk template portfolio premium, admin panel mandiri, dan bantuan setup ke akun Cloudflare kamu sendiri.',
};

// Harga dibaca dari panel Harga Jual (platform_settings) — bukan hardcode.
// ISR 5 menit supaya perubahan harga owner tidak perlu deploy ulang.
export const revalidate = 300;

const INCLUDES = [
  {
    title: 'Template portfolio premium',
    body: 'Pilih satu dari tiga template (OS Desktop, Infinite Canvas, Spatial Gallery) beserta seluruh halamannya.',
  },
  {
    title: 'Admin panel mandiri',
    body: 'Kelola proyek, profil, pengalaman, keahlian, galeri, kontak, testimoni, wallpaper, dock, dan widget dari browser.',
  },
  {
    title: 'Database & media milikmu',
    body: 'Cloudflare D1 untuk data, R2 untuk foto/video. Semuanya dibuat di akun Cloudflare kamu sendiri.',
  },
  {
    title: 'Setup + deploy dibantu',
    body: 'Kami yang menyiapkan database, bucket, dan proses deploy sampai websitemu online — kamu cukup mengisi konten.',
  },
] as const;

const FAQ = [
  {
    q: 'Apakah ada biaya bulanan?',
    a: 'Tidak. Yang kamu bayar ke kami hanya sekali, sebesar harga template. Biaya bulanan hanya mungkin muncul dari Cloudflare kalau pemakaianmu melewati kuota gratis — dan itu ditagih langsung oleh Cloudflare, bukan oleh kami.',
  },
  {
    q: 'Apakah butuh akun Cloudflare sendiri?',
    a: 'Ya. Website ini dirancang agar data dan hosting ada di akun Cloudflare kamu, bukan menumpang di server kami. Kami bantu proses pembuatan akun dan pengisian kredensialnya saat onboarding.',
  },
  {
    q: 'Apakah butuh kartu kredit untuk Cloudflare?',
    a: 'Untuk D1 dan Worker: tidak, cukup paket gratis. Untuk R2 (penyimpanan foto/video) Cloudflare meminta verifikasi kartu. Kalau kamu belum siap menambahkan kartu, website tetap bisa online lebih dulu tanpa media, lalu fitur media diaktifkan belakangan setelah R2 siap.',
  },
  {
    q: 'Bisa pakai domain sendiri?',
    a: 'Bisa. Awalnya website online di alamat <slug>.workers.dev. Domain pribadi bisa dipasang setelahnya di akun Cloudflare yang sama — kami beri panduan langkahnya.',
  },
  {
    q: 'Berapa lama sampai website online?',
    a: 'Setelah pembayaran terverifikasi, kami memproses paling lambat 1×24 jam pada hari kerja. Prosesnya mencakup pembuatan database, bucket, deploy, dan pengiriman kredensial login admin.',
  },
  {
    q: 'Bisa revisi desain?',
    a: 'Kamu bisa mengubah sendiri konten, warna, wallpaper, dan susunan dock lewat admin panel tanpa batas. Perubahan struktur atau kode di luar cakupan template masuk kategori pekerjaan tambahan dan dibicarakan dulu.',
  },
  {
    q: 'Kalau saya bingung, ada bantuan?',
    a: 'Ada. Setelah pembelian kamu mendapat panduan klien berisi langkah login, mengisi konten, dan mengunggah media. Kalau masih macet, hubungi kami lewat email yang tertera di halaman ini.',
  },
  {
    q: 'Bisa refund?',
    a: 'Bisa dalam 7 hari kalau website belum berhasil dinyalakan karena kesalahan di sisi kami. Setelah akses admin dan website aktif, pembayaran dianggap final. Detail lengkap ada di Syarat & Ketentuan.',
  },
] as const;

export default async function HargaPage() {
  if (!isStorefrontDeployment()) notFound();

  const price = (await getBasePrice()) || BASE_PRICE;

  return (
    <>
      <p className="lp-eyebrow">Harga</p>
      <h1 className="lp-title">Satu harga, sekali bayar</h1>
      <p className="lp-lead">
        Tidak ada langganan, tidak ada potongan per transaksi. Kamu membeli template
        sekali, lalu websitenya berjalan di akun Cloudflare milikmu sendiri.
      </p>

      <section className="lp-section" aria-labelledby="harga-paket">
        <div className="lp-card">
          <h2 className="lp-h3" id="harga-paket">
            Paket Template Portfolio
          </h2>
          <div className="lp-price-box" style={{ marginTop: 6 }}>
            <span className="lp-price">{formatIdr(price)}</span>
            <span className="lp-price-note">sekali bayar · tanpa langganan</span>
          </div>
          <p className="lp-p" style={{ marginTop: 12 }}>
            Termasuk setup dan deploy ke akun Cloudflare kamu, plus bantuan sampai
            website benar-benar online.
          </p>

          <div className="lp-grid" style={{ marginTop: 16 }}>
            {INCLUDES.map((item) => (
              <div key={item.title}>
                <h3 className="lp-h3">{item.title}</h3>
                <p className="lp-p" style={{ marginBottom: 0 }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          <div className="lp-actions">
            <Link href="/checkout" className="lp-btn lp-btn-primary">
              Pesan sekarang <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/" className="lp-btn">
              Coba demo di beranda
            </Link>
          </div>
        </div>
      </section>

      <section className="lp-section" aria-labelledby="harga-cloudflare">
        <h2 className="lp-h2" id="harga-cloudflare">
          Biaya Cloudflare (dibayar ke Cloudflare, bukan ke kami)
        </h2>
        <p className="lp-p">
          Website ini memakai tiga layanan Cloudflare dengan paket gratis yang cukup
          untuk portfolio pribadi. Tabel ini apa adanya, termasuk bagian yang butuh
          verifikasi kartu.
        </p>

        <table className="lp-table">
          <thead>
            <tr>
              <th scope="col">Layanan</th>
              <th scope="col">Fungsi</th>
              <th scope="col">Biaya</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Workers</td>
              <td>Menjalankan website dan API</td>
              <td>Gratis (100.000 request/hari)</td>
            </tr>
            <tr>
              <td>D1</td>
              <td>Menyimpan data proyek, profil, pesan</td>
              <td>Gratis (5 juta baris dibaca/hari)</td>
            </tr>
            <tr>
              <td>R2</td>
              <td>Menyimpan foto dan video</td>
              <td>
                Gratis 10 GB/bulan — <strong>butuh verifikasi kartu</strong> saat
                aktivasi
              </td>
            </tr>
            <tr>
              <td>Domain sendiri</td>
              <td>Alamat kustom, opsional</td>
              <td>Sesuai harga registrar domain</td>
            </tr>
          </tbody>
        </table>

        <div className="lp-note" style={{ marginTop: 14 }}>
          <strong>Soal R2 dan kartu:</strong> Cloudflare mewajibkan verifikasi kartu
          (atau PayPal) sebelum bucket R2 bisa dipakai. Kalau kamu belum ingin
          menambahkan kartu, website tetap bisa online lebih dulu tanpa media, dan
          foto/video diaktifkan kemudian setelah R2 siap. Kami tidak memakai kartu
          kami di akunmu.
        </div>
      </section>

      <section className="lp-section" id="faq" aria-labelledby="harga-faq">
        <h2 className="lp-h2" id="harga-faq">
          Pertanyaan yang sering ditanya
        </h2>
        <div className="lp-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>

        <div className="lp-actions">
          <Link href="/cara-pesan" className="lp-btn lp-btn-primary">
            Lihat cara pesan <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/syarat-ketentuan" className="lp-btn">
            Syarat &amp; Ketentuan
          </Link>
        </div>
      </section>
    </>
  );
}
