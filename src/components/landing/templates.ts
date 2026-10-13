export interface TemplateItem {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  description: string;
  features: string[];
  previewUrl: string;
}

export const TEMPLATES_DATA: TemplateItem[] = [
  {
    id: 'os-desktop',
    name: 'OS Desktop',
    subtitle: 'macOS Desktop Simulator',
    badge: 'Paling Populer',
    description:
      'Pengalaman portofolio layaknya sistem operasi desktop Apple: multi-window multitasking, dock aplikasi animasi, Dynamic Island, music player, dan terminal interaktif.',
    features: [
      'Window manager & draggable apps',
      'Dock bar & Dynamic Island audio',
      'Cloudflare D1 SQL & R2 Storage',
      'Admin panel mandiri & AI Chatbot',
    ],
    previewUrl: '/preview/os-desktop',
  },
  {
    id: 'infinite-canvas',
    name: 'Infinite Canvas',
    subtitle: 'Freeform Visual Board',
    badge: 'Desainer & Kreatif',
    description:
      'Kanvas tak terbatas untuk memamerkan karya visual, desain grafis, dan portofolio kreatif. Bebas drag, zoom, dan eksplorasi project cards tanpa batas ruang.',
    features: [
      'Smooth pan & zoom inertia',
      'Scattered interactive project cards',
      'Filter kategori real-time',
      'Ringan dan responsif di mobile & desktop',
    ],
    previewUrl: '/preview/infinite-canvas',
  },
  {
    id: 'spatial-gallery',
    name: 'Spatial Gallery',
    subtitle: '3D Cylindrical Exhibition',
    badge: 'Futuristik 3D',
    description:
      'Eksibisi seni 3D imersif dengan silinder spatial berputar dan orbital artwork. Menghadirkan kesan futuristik dan kurasi level galeri virtual kontemporer.',
    features: [
      '3D Cylindrical rotating carousel',
      'Interaksi orbital spotlight & zoom',
      'Shader lighting & shadow dinamis',
      'Dukungan media video loop & poster',
    ],
    previewUrl: '/preview/spatial-gallery',
  },
];
