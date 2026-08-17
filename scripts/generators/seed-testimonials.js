/**
 * Seed Testimonials - Generator data testimonial demo.
 *
 * Membuat data testimonial dummy yang realistis untuk development dan preview
 * tanpa data production atau identitas pribadi.
 *
 * @module scripts/generators/seed-testimonials
 */
const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(process.cwd(), 'src/data/testimonial.json');

const testimonials = [
  {
    id: 1,
    name: 'Nadia - Brand Owner',
    notificationText: 'Konsep visualnya sudah pas dengan arah brand kami.',
    isActive: true,
    messages: [
      { id: 1, text: 'Konsep visualnya sudah kami review.', isMe: false, time: '09:40' },
      { id: 2, text: 'Terima kasih. Apakah arah warnanya sudah sesuai brief?', isMe: true, time: '09:42' },
      { id: 3, text: 'Sudah sesuai dan mudah dipakai lintas kanal.', isMe: false, time: '09:45' },
    ],
  },
  {
    id: 2,
    name: 'Ardi - Product Lead',
    notificationText: 'Case study-nya rapi dan mudah dipresentasikan.',
    isActive: true,
    messages: [
      { id: 4, text: 'Deck case study sudah kami pakai untuk meeting internal.', isMe: false, time: '10:15' },
      { id: 5, text: 'Mantap. Ada bagian yang perlu disederhanakan lagi?', isMe: true, time: '10:18' },
      { id: 6, text: 'Tidak ada. Flow-nya jelas dan visualnya membantu.', isMe: false, time: '10:22' },
    ],
  },
  {
    id: 3,
    name: 'Sinta - Marketing Manager',
    notificationText: 'Materi campaign-nya konsisten dan siap publish.',
    isActive: true,
    messages: [
      { id: 7, text: 'Asset campaign sudah masuk folder final ya.', isMe: false, time: '11:00' },
      { id: 8, text: 'Siap, semua ukuran sudah saya export sesuai placement.', isMe: true, time: '11:03' },
      { id: 9, text: 'Bagus. Tinggal kami jadwalkan minggu ini.', isMe: false, time: '11:08' },
    ],
  },
];

const data = {
  testimonials,
  lastUpdated: new Date().toISOString(),
};

const dir = path.dirname(dataFilePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));

console.log('Demo testimonials seeded successfully.');
console.log(`File created at: ${dataFilePath}`);
