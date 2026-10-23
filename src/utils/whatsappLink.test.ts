import { describe, it, expect } from 'vitest';
import { buildWhatsAppLink, normalizeWhatsAppNumber } from './whatsappLink';

// Semua nomor di file ini DUMMY (bukan nomor asli siapa pun) — mengikuti
// pola dari owner di v1.3.68: uji jembatan chat pakai nomor dummy.
const DUMMY = '081234567890';

describe('normalizeWhatsAppNumber', () => {
  it('membersihkan format lokal 08xx dan mengonversi ke intl 62', () => {
    expect(normalizeWhatsAppNumber(DUMMY)).toBe('6281234567890');
    expect(normalizeWhatsAppNumber('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeWhatsAppNumber('0812 3456 789')).toBe('628123456789');
  });

  it('menerima format internasional apa adanya', () => {
    expect(normalizeWhatsAppNumber('+62 812 3456 7890')).toBe('6281234567890');
    expect(normalizeWhatsAppNumber('6281234567890')).toBe('6281234567890');
  });

  it('mengambil nomor dari URL wa.me / api.whatsapp.com yang di-paste', () => {
    expect(normalizeWhatsAppNumber('https://wa.me/6281234567890')).toBe('6281234567890');
    expect(normalizeWhatsAppNumber('https://wa.me/6281234567890?text=halo')).toBe('6281234567890');
    expect(
      normalizeWhatsAppNumber('https://api.whatsapp.com/send?phone=6281234567890&text=x')
    ).toBe('6281234567890');
  });

  it('mengembalikan null untuk input tidak layak (dipakai sebagai pemicu mode lama)', () => {
    expect(normalizeWhatsAppNumber(null)).toBeNull();
    expect(normalizeWhatsAppNumber(undefined)).toBeNull();
    expect(normalizeWhatsAppNumber('')).toBeNull();
    expect(normalizeWhatsAppNumber('   ')).toBeNull();
    expect(normalizeWhatsAppNumber('abc')).toBeNull();
    // Terlalu pendek setelah normalisasi ('0712' → inti 7 digit + prefix 62 = 8? cek)
    expect(normalizeWhatsAppNumber('071')).toBeNull();
    // Terlalu panjang (> 15 digit)
    expect(normalizeWhatsAppNumber('0812345678901234567')).toBeNull();
  });

  it('nomor pendek yang masih masuk 8-15 digit tetap valid', () => {
    // '0812' hanya 4 digit → null
    expect(normalizeWhatsAppNumber('0812')).toBeNull();
    // Lokal 8 digit '08123456' → 62 + 8123456 = 628123456 (9 digit intl, valid).
    expect(normalizeWhatsAppNumber('08123456')).toBe('628123456');
  });
});

describe('buildWhatsAppLink', () => {
  it('membangun link wa.me lengkap dengan pesan prefilled (nomor dummy)', () => {
    expect(buildWhatsAppLink(DUMMY, 'Halo, mau tanya soal paket')).toBe(
      'https://wa.me/6281234567890?text=Halo%2C%20mau%20tanya%20soal%20paket'
    );
  });

  it('memberi pesan bawaan bila pengunjung kosong (klik tanpa ngetik)', () => {
    expect(buildWhatsAppLink(DUMMY)).toBe('https://wa.me/6281234567890');
    expect(buildWhatsAppLink(DUMMY, '   ')).toBe('https://wa.me/6281234567890');
  });

  it('menangani karakter yang perlu di-encode aman', () => {
    expect(buildWhatsAppLink(DUMMY, 'Besok bisa "jalan"? Aku & tim, siap!')).toBe(
      'https://wa.me/6281234567890?text=Besok%20bisa%20%22jalan%22%3F%20Aku%20%26%20tim%2C%20siap!'
    );
  });

  it('mengembalikan null bila nomor tidak valid — caller jatuh ke mode lama', () => {
    expect(buildWhatsAppLink(null, 'hi')).toBeNull();
    expect(buildWhatsAppLink('', 'hi')).toBeNull();
    expect(buildWhatsAppLink('bukan-nomor', 'hi')).toBeNull();
  });
});
