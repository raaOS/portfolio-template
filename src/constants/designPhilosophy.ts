import type { WorkflowStep } from '@/types/about';

// Konstanta UI form Design Philosophy — dipakai oleh DesignPhilosophyForm.
// Tipe kanonik (WorkflowStep / DesignPhilosophy) tinggal di @/types/about
// dan juga dikonsumsi FlowchartProcess + contentLocalization.

export const AVAILABLE_ICONS = [
  'Search',
  'Lightbulb',
  'Palette',
  'GitPullRequest',
  'CheckCircle2',
  'Sparkles',
  'Target',
  'Zap',
];

export const COLORS = [
  { value: 'amber', label: '🟡 Amber (Discovery)', bg: 'bg-amber-100', border: 'border-amber-400' },
  { value: 'blue', label: '🔵 Blue (Strategy)', bg: 'bg-blue-100', border: 'border-blue-400' },
  {
    value: 'purple',
    label: '🟣 Purple (Execution)',
    bg: 'bg-purple-100',
    border: 'border-purple-400',
  },
  { value: 'rose', label: '🔴 Rose (Refinement)', bg: 'bg-rose-100', border: 'border-rose-400' },
  {
    value: 'emerald',
    label: '🟢 Emerald (Delivery)',
    bg: 'bg-emerald-100',
    border: 'border-emerald-400',
  },
];

// Default workflow steps - selalu dipakai kalau data kosong
export const DEFAULT_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'discovery',
    number: '01',
    title: 'Discovery & Research',
    subtitle: 'Memahami fondasi proyek',
    description: 'Tahap awal untuk memahami masalah bisnis, target audience, dan tujuan desain.',
    type: 'phase',
    color: 'amber',
    icon: 'Search',
    subSteps: [
      {
        id: 'briefing',
        title: 'Briefing & Debrief',
        description: 'Diskusi awal dengan klien',
        status: 'default',
      },
      {
        id: 'research',
        title: 'Research & Observasi',
        description: 'Analisis pasar dan kompetitor',
        status: 'default',
      },
      {
        id: 'reference',
        title: 'Cari Referensi & Asset',
        description: 'Mengumpulkan inspirasi visual',
        status: 'default',
      },
      {
        id: 'sync',
        title: 'Sync dengan Klien',
        description: 'Validasi arah konsep',
        status: 'default',
      },
    ],
    nextSteps: ['strategy'],
    loopTargets: [],
  },
  {
    id: 'strategy',
    number: '02',
    title: 'Strategy & Concept',
    subtitle: 'Merancang pendekatan visual',
    description: 'Menentukan hierarki visual, pesan utama, dan strategi komunikasi.',
    type: 'phase',
    color: 'blue',
    icon: 'Lightbulb',
    subSteps: [
      {
        id: 'message',
        title: 'Definisikan Pesan Utama',
        description: 'Core message yang harus tersampaikan',
        status: 'default',
      },
      {
        id: 'hierarchy',
        title: 'Hierarki Visual',
        description: 'Struktur informasi dan prioritas',
        status: 'default',
      },
      {
        id: 'brainstorm',
        title: 'Brainstorm dengan Tim',
        description: 'Diskusi kreatif eksplorasi ide',
        status: 'default',
      },
      {
        id: 'proposal',
        title: 'Proposal Konsep',
        description: 'Presentasi konsep untuk klien',
        status: 'default',
      },
    ],
    nextSteps: ['execution'],
    loopTargets: ['discovery'],
  },
  {
    id: 'execution',
    number: '03',
    title: 'Execution & Iteration',
    subtitle: 'Mengembangkan desain',
    description: 'Proses kreatif membuat desain dengan iterasi dan revisi.',
    type: 'phase',
    color: 'purple',
    icon: 'Palette',
    subSteps: [
      {
        id: 'wireframe',
        title: 'Draft & Wireframe',
        description: 'Kerangka awal dan layout dasar',
        status: 'default',
      },
      {
        id: 'visual',
        title: 'Desain Visual',
        description: 'Visual dengan detail penuh',
        status: 'default',
      },
      {
        id: 'internal',
        title: 'Review Internal',
        description: 'Evaluasi dengan tim',
        status: 'default',
      },
      {
        id: 'present',
        title: 'Present ke Klien',
        description: 'Tampilkan hasil dan terima feedback',
        status: 'default',
      },
    ],
    nextSteps: ['approval'],
    loopTargets: ['strategy', 'execution'],
  },
  {
    id: 'approval',
    number: '04',
    title: 'Refinement & Approval',
    subtitle: 'Penyempurnaan dan ACC',
    description: 'Tahap revisi akhir hingga persetujuan final.',
    type: 'decision',
    color: 'rose',
    icon: 'GitPullRequest',
    subSteps: [
      {
        id: 'r1',
        title: 'Revisi R1',
        description: 'Perbaikan berdasarkan feedback',
        status: 'default',
      },
      {
        id: 'r2',
        title: 'Revisi R2 (jika perlu)',
        description: 'Penyempurnaan tambahan',
        status: 'default',
      },
      {
        id: 'polish',
        title: 'Final Polish',
        description: 'Detail terakhir dan QC',
        status: 'default',
      },
      { id: 'acc', title: 'ACC dari Klien', description: 'Persetujuan final', status: 'default' },
    ],
    nextSteps: ['delivery'],
    loopTargets: ['execution', 'strategy', 'discovery'],
  },
  {
    id: 'delivery',
    number: '05',
    title: 'Delivery & Result',
    subtitle: 'Serah terima final',
    description: 'Penyerahan aset final dan dokumentasi.',
    type: 'terminator',
    color: 'emerald',
    icon: 'CheckCircle2',
    subSteps: [
      {
        id: 'assets',
        title: 'Prepare Final Assets',
        description: 'File dalam format siap pakai',
        status: 'default',
      },
      {
        id: 'styleguide',
        title: 'Styleguide & Dokumentasi',
        description: 'Panduan penggunaan brand',
        status: 'default',
      },
      {
        id: 'handover',
        title: 'Handover Session',
        description: 'Sesi penjelasan dan Q&A',
        status: 'default',
      },
      {
        id: 'archive',
        title: 'Archive & Closing',
        description: 'Backup dan closing admin',
        status: 'default',
      },
    ],
    nextSteps: [],
    loopTargets: [],
  },
];
