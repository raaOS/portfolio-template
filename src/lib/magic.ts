/**
 * Magic Comment Generator
 * ======================
 * Menghasilkan komentar Gen-Z dan metrik viral untuk project portofolio.
 * Data ini bersifat dekoratif — tidak disimpan di database.
 *
 * @module magic
 */

export interface CommentReply {
  id?: string;
  text: string;
  name: string;
  time: string;
  createdAt?: string;
  likes: number;
  avatar?: string;
}

export interface Comment {
  id?: string;
  text: string;
  name: string;
  time?: string;
  createdAt?: string;
  likes: number;
  likedByMe?: boolean;
  replies: CommentReply[];
  avatar?: string;
}

export interface ViralMetrics {
  likes: number;
  shares: number;
}

interface Vibe {
  type: string;
  comments: string[];
  admin_replies: string[];
  user_replies: string[];
}

/**
 * Generates viral metrics for a project.
 * Likes: 5-45, Shares: 0-5 (randomized).
 */
export function generateViralMetrics(): ViralMetrics {
  return {
    likes: Math.floor(Math.random() * 41) + 5,
    shares: Math.floor(Math.random() * 6),
  };
}

/**
 * Vibe definitions — kumpulan template komentar berdasarkan nuansa.
 */
export const COMMENT_VIBES: Vibe[] = [
  {
    type: 'praise_short',
    comments: [
      'Keren banget! 🔥',
      'Suka banget sama warnanya ✨',
      'Gokil sih ini 👏',
      'Simple tapi ngena banget.',
      'Visualnya manja di mata 👀',
      'Favorit sih ini!',
      'Kelas abangku 🤝',
      'Asli keren parah ✨',
      "Definisi 'Art' sesungguhnya",
      'Estetik parah! 🌈',
    ],
    admin_replies: [
      'Makasih banyak! 🙏',
      'Glad you like it! ✨',
      'Thank you! 🙌',
      'Thanks for the support! 🔥',
    ],
    user_replies: [],
  },
  {
    type: 'praise_detailed',
    comments: [
      'Detail teksturnya dapet banget, rapi! 🔥',
      'Komposisi warnanya juara sih ini, adem liatnya.',
      'Transisinya halus banget bang, enak dimata.',
      'Konsepnya out of the box banget, salut! 🧠',
      'Mood-nya dapet banget, agak dark tapi elegan.',
      'Pemilihan font-nya pas banget sama visualnya.',
    ],
    admin_replies: [
      'Thank you! Emang agak tricky di bagian itu hehe ✨',
      'Makasih! Butuh waktu lama buat nemu mood yg pas 🙏',
      'Thanks! Glad you noticed the details 🙌',
    ],
    user_replies: ['Setuju, mood-nya dapet banget emang.', 'Iya, warnanya itu lho yg bikin beda.'],
  },
  {
    type: 'curious_tech',
    comments: [
      'Pake software apa bang? Halus bgt.',
      'Ini render berapa lama bang? Penasaran 😂',
      'Workflow-nya gimana bang bisa sebersih ini?',
      'Pake plugin tambahan gak bang buat efek itu?',
      'Color grading-nya pake apa bang? Cakepp',
    ],
    admin_replies: [
      'Pake AE + Photoshop aja kok bang 🙏',
      'Render lumayan lama, ditinggal tidur semalem haha 😂',
      'Grading manual di Premiere bang hehe',
    ],
    user_replies: ['Kayaknya pake AE deh ini.', 'Biasanya sih Red Giant bang kalo look gini.'],
  },
  {
    type: 'joke_casual',
    comments: [
      'Info loker bang, mau berguru 🙏',
      'Mundur bang, gantengnya kelewatan (karyanya maksudnya) 🤣',
      'Ajarin dong puh sepuh 🙇',
      'Spek PC NASA ya bang? 😂',
      'Ginjal aman bang buat rakit PC ginian? 🤣',
    ],
    admin_replies: [
      'Waduh saya masih pemula bang 🙏😂',
      'PC kentang kok bang, kipasnya aja yg kenceng ✈️',
      'Aman bang, cuma makan mie instan sebulan 😂',
    ],
    user_replies: ['Wkwk PC NASA valid 🔥', 'Gas puh ajarin kita'],
  },
];

const TIMES = [
  '2 menit yang lalu',
  '10 menit yang lalu',
  '30 menit yang lalu',
  '1 jam yang lalu',
  '2 jam yang lalu',
  '5 jam yang lalu',
  '10 jam yang lalu',
  '1 hari yang lalu',
  '2 hari yang lalu',
];

const NAMES = [
  'Bagas',
  'Dinda',
  'Rizky',
  'Siti',
  'Adit',
  'Fajri',
  'Tiara',
  'Gilang',
  'Putri',
  'Zaki',
  'Bbudii',
  'Ani',
  'Joko',
  'Rina',
  'Setiawan',
  'Maya',
  'Kevin',
  'Lutfi',
  'Wawan',
  'Doni',
  'Togar',
  'Yanto',
  'Samsul',
  'Lala',
  'Eka',
  'Fani',
  'Hana',
  'Indra',
];

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a full thread of Gen-Z comments for a project.
 *
 * @param slug - Project slug untuk unique ID generation
 * @param count - Jumlah komentar (default: random 0-2)
 * @param tone - Tone filter untuk komentar ('tech', 'casual', 'aesthetic')
 * @param includeReplies - Apakah menyertakan balasan komentar dari admin/user lain
 * @returns Array of comments with optional replies
 */
export function generateGenZComments(
  slug: string,
  count?: number,
  tone?: string,
  includeReplies: boolean = true
): Comment[] {
  const projectComments: Comment[] = [];

  let commentCount = 2; // Default

  if (typeof count === 'number') {
    commentCount = count;
  } else {
    const seed = Math.random();
    if (seed > 0.8) commentCount = 1;
    if (seed > 0.95) commentCount = 0;
  }

  // Filter vibes berdasarkan pilihan gaya bahasa (tone)
  let vibes = COMMENT_VIBES;
  if (tone) {
    const cleanTone = tone.toLowerCase();
    if (cleanTone === 'tech') {
      vibes = COMMENT_VIBES.filter(
        (v) => v.type === 'curious_tech' || v.type === 'praise_detailed'
      );
    } else if (cleanTone === 'casual' || cleanTone === 'gen-z') {
      vibes = COMMENT_VIBES.filter((v) => v.type === 'joke_casual' || v.type === 'praise_short');
    } else if (cleanTone === 'aesthetic') {
      vibes = COMMENT_VIBES.filter(
        (v) => v.type === 'praise_detailed' || v.type === 'praise_short'
      );
    }
  }

  for (let i = 0; i < commentCount; i++) {
    const vibe = getRandom(vibes.length > 0 ? vibes : COMMENT_VIBES);
    const text = getRandom(vibe.comments);

    const replies: CommentReply[] = [];

    if (includeReplies) {
      const isOwnerReply = Math.random() > 0.3; // 70% chance it's admin replying
      if (isOwnerReply && vibe.admin_replies.length > 0) {
        const replyText = getRandom(vibe.admin_replies);
        replies.push({
          id: `r-${slug}-${i}-admin`,
          text: replyText,
          name: 'Owner',
          time: getRandom(TIMES),
          createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          likes: Math.floor(Math.random() * 20),
          avatar: `https://ui-avatars.com/api/?name=Owner&background=000&color=fff`,
        });
      } else if (!isOwnerReply && vibe.user_replies.length > 0) {
        const replyText = getRandom(vibe.user_replies);
        const replierName = getRandom(NAMES);
        replies.push({
          id: `r-${slug}-${i}-user`,
          text: replyText,
          name: replierName,
          time: getRandom(TIMES),
          createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          likes: Math.floor(Math.random() * 20),
          avatar: `https://ui-avatars.com/api/?name=${replierName}&background=random`,
        });
      }
    }

    const name = getRandom(NAMES);
    projectComments.push({
      id: `c-${slug}-${i}-${Date.now()}`,
      text: text,
      name: name,
      createdAt: new Date(Date.now() - Math.random() * 172800000).toISOString(),
      likes: Math.floor(Math.random() * 100),
      replies: replies,
      avatar: `https://ui-avatars.com/api/?name=${name}&background=random`,
    });
  }

  return projectComments;
}
