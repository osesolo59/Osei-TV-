import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogg']);
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt =
      file.fieldname === 'thumbnail'
        ? ALLOWED_IMAGE_EXTS.has(ext)
          ? ext
          : '.jpg'
        : ALLOWED_VIDEO_EXTS.has(ext)
          ? ext
          : '.mp4';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniqueSuffix}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'video' && file.mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    if (file.fieldname === 'thumbnail' && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    cb(new Error('Unsupported file type'));
  },
});

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const db = new Database('database.sqlite');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Deterministic inline SVG avatar generator (no external network dependency)
const AVATAR_PALETTES = [
  ['#1E293B', '#F8FAFC'],
  ['#991B1B', '#FEF2F2'],
  ['#0F766E', '#F0FDFA'],
  ['#1D4ED8', '#EFF6FF'],
  ['#7C2D12', '#FFF7ED'],
  ['#4338CA', '#EEF2FF'],
  ['#047857', '#ECFDF5'],
  ['#6D28D9', '#F5F3FF'],
];

function buildAvatarUri(name: string): string {
  const cleanName = (name || 'Osei').trim();
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const [bg, fg] = AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : cleanName.slice(0, 2).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><rect width="80" height="80" rx="40" fill="${bg}"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="${fg}" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="700" letter-spacing="0.02em">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function formatViewsLabel(count: number, isLive: boolean): string {
  if (isLive) {
    if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K watching`;
    return `${count} watching`;
  }
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${count} view${count === 1 ? '' : 's'}`;
}

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Initialize & migrate schema safely
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    avatar TEXT,
    subscribers INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    videoUrl TEXT,
    thumbnailUrl TEXT,
    channelName TEXT,
    channelAvatar TEXT,
    userId TEXT,
    views INTEGER DEFAULT 0,
    uploadDate TEXT,
    duration TEXT,
    likes INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    videoId TEXT,
    userId TEXT,
    text TEXT,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS video_reactions (
    userId TEXT NOT NULL,
    videoId TEXT NOT NULL,
    reaction TEXT NOT NULL CHECK(reaction IN ('like', 'dislike')),
    PRIMARY KEY (userId, videoId)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    subscriberId TEXT NOT NULL,
    channelName TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    PRIMARY KEY (subscriberId, channelName)
  );

  CREATE TABLE IF NOT EXISTS watch_later (
    userId TEXT NOT NULL,
    videoId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    PRIMARY KEY (userId, videoId)
  );

  CREATE TABLE IF NOT EXISTS watch_history (
    userId TEXT NOT NULL,
    videoId TEXT NOT NULL,
    watchedAt TEXT NOT NULL,
    PRIMARY KEY (userId, videoId)
  );

  CREATE TABLE IF NOT EXISTS live_chat (
    id TEXT PRIMARY KEY,
    videoId TEXT NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT NOT NULL,
    text TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT NOT NULL,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS channel_stats (
    channelName TEXT PRIMARY KEY,
    subscribers INTEGER DEFAULT 0,
    bio TEXT DEFAULT '',
    joinedDate TEXT DEFAULT 'Jan 2024'
  );
`);

// Safe migrations for existing database.sqlite columns
ensureColumn('users', 'isPremium', 'INTEGER DEFAULT 0');
ensureColumn('users', 'createdAt', "TEXT DEFAULT ''");
ensureColumn('videos', 'category', "TEXT DEFAULT 'General'");
ensureColumn('videos', 'isShort', 'INTEGER DEFAULT 0');
ensureColumn('videos', 'isLive', 'INTEGER DEFAULT 0');
ensureColumn('videos', 'dislikes', 'INTEGER DEFAULT 0');
ensureColumn('videos', 'createdAt', "TEXT DEFAULT ''");
ensureColumn('comments', 'username', "TEXT DEFAULT ''");
ensureColumn('comments', 'avatar', "TEXT DEFAULT ''");
ensureColumn('comments', 'likes', 'INTEGER DEFAULT 0');
ensureColumn('comments', 'parentId', 'TEXT');
ensureColumn('comments', 'createdAt', "TEXT DEFAULT ''");

// Seed curated videos & shorts so every feature works out of the box
function seedCatalog() {
  const curatedVideos = [
    {
      id: '1',
      title: 'Building a Video Streaming App in React',
      description:
        'Learn how to build a production-grade video streaming platform using React, TypeScript, Tailwind CSS, and SQLite. We cover player controls, responsive grids, and real-time live studio workflows.',
      thumbnailUrl: '/src/assets/images/thumb_react_code_1795610177755.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      channelName: 'Code With Osei',
      channelAvatar: buildAvatarUri('Code With Osei'),
      views: 1240000,
      uploadDate: '2 days ago',
      duration: '10:00',
      category: 'Programming',
      isShort: 0,
      isLive: 0,
      likes: 12400,
      dislikes: 112,
      createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
    },
    {
      id: '2',
      title: 'Top 10 PC Games of 2026',
      description:
        'A deep dive into the top 10 PC releases shaping competitive and single-player gaming this year. Timestamps and performance benchmarks included.',
      thumbnailUrl: '/src/assets/images/thumb_gaming_esports_1795610177844.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      channelName: 'Gaming Central',
      channelAvatar: buildAvatarUri('Gaming Central'),
      views: 850000,
      uploadDate: '1 week ago',
      duration: '10:53',
      category: 'Gaming',
      isShort: 0,
      isLive: 0,
      likes: 45000,
      dislikes: 420,
      createdAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
    },
    {
      id: '3',
      title: 'Mastering Landscape Photography',
      description:
        'Improve your alpine and golden-hour landscape photography with five practical field techniques covering dynamic range, foreground framing, and mist timing.',
      thumbnailUrl: '/src/assets/images/thumb_landscape_photo_1795610178284.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      channelName: 'Photo Pro',
      channelAvatar: buildAvatarUri('Photo Pro'),
      views: 312000,
      uploadDate: '3 weeks ago',
      duration: '15:00',
      category: 'Photography',
      isShort: 0,
      isLive: 0,
      likes: 8200,
      dislikes: 64,
      createdAt: new Date(Date.now() - 21 * 86400_000).toISOString(),
    },
    {
      id: '4',
      title: 'Daily Tech News & Studio Briefing',
      description:
        'Today in technology: silicon roadmaps, open-source tooling updates, and creative hardware announcements analyzed live from Studio One.',
      thumbnailUrl: '/src/assets/images/thumb_tech_news_1795610179286.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      channelName: 'Tech Today',
      channelAvatar: buildAvatarUri('Tech Today'),
      views: 2540000,
      uploadDate: '5 hours ago',
      duration: '8:45',
      category: 'News',
      isShort: 0,
      isLive: 0,
      likes: 28500,
      dislikes: 310,
      createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    },
    {
      id: '5',
      title: 'Lo-Fi Beats to Relax & Focus',
      description:
        'A continuous broadcast of analog vinyl lo-fi beats, warm tape hiss, and mellow chords for deep coding, studying, and late-night sessions.',
      thumbnailUrl: '/src/assets/images/thumb_lofi_studio_1795610178864.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      channelName: 'Chill Vibes',
      channelAvatar: buildAvatarUri('Chill Vibes'),
      views: 14200,
      uploadDate: 'Live now',
      duration: 'LIVE',
      category: 'Music',
      isShort: 0,
      isLive: 1,
      likes: 45000,
      dislikes: 95,
      createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    },
    {
      id: '6',
      title: 'Healthy Cooking: 15-Minute Seared Salmon Bowl',
      description:
        'Fast weeknight culinary prep: crispy seared salmon with charred sweet corn, herbed brown rice, avocado, and bright citrus dressing in 15 minutes.',
      thumbnailUrl: '/src/assets/images/thumb_healthy_cooking_1795610179138.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      channelName: 'Chef Osei',
      channelAvatar: buildAvatarUri('Chef Osei'),
      views: 418000,
      uploadDate: '4 days ago',
      duration: '15:30',
      category: 'Cooking',
      isShort: 0,
      isLive: 0,
      likes: 13200,
      dislikes: 88,
      createdAt: new Date(Date.now() - 4 * 86400_000).toISOString(),
    },
    {
      id: '7',
      title: 'Learning Acoustic Guitar: Fingerstyle Foundations',
      description:
        'Your first complete acoustic guitar session covering clean fretting posture, open chord transitions, and rhythmic picking patterns.',
      thumbnailUrl: '/src/assets/images/thumb_guitar_lesson_1795610180093.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      channelName: 'Music Academy',
      channelAvatar: buildAvatarUri('Music Academy'),
      views: 1820000,
      uploadDate: '2 months ago',
      duration: '18:50',
      category: 'Music',
      isShort: 0,
      isLive: 0,
      likes: 21000,
      dislikes: 140,
      createdAt: new Date(Date.now() - 60 * 86400_000).toISOString(),
    },
    {
      id: '8',
      title: 'Space Exploration Documentary: Beyond Orbit',
      description:
        'An orbital journey examining Earth observation systems, deep-space telemetry, and the next decade of crewed exploration.',
      thumbnailUrl: '/src/assets/images/thumb_space_earth_1795610179696.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      channelName: 'Science Now',
      channelAvatar: buildAvatarUri('Science Now'),
      views: 910000,
      uploadDate: '1 month ago',
      duration: '14:48',
      category: 'Education',
      isShort: 0,
      isLive: 0,
      likes: 18000,
      dislikes: 105,
      createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
    },
    {
      id: '9',
      title: 'E-Sports Championship Grand Finals Live',
      description:
        'Watch the championship showdown live from the main arena stage with play-by-play commentary and instant tactical replays.',
      thumbnailUrl: '/src/assets/images/thumb_gaming_esports_1795610177844.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      channelName: 'Pro Gaming',
      channelAvatar: buildAvatarUri('Pro Gaming'),
      views: 125400,
      uploadDate: 'Started 2 hours ago',
      duration: 'LIVE',
      category: 'Sports',
      isShort: 0,
      isLive: 1,
      likes: 35000,
      dislikes: 210,
      createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    },
    {
      id: '10',
      title: 'Orbital Earth Cam — Live Horizon Feed',
      description:
        'Continuous high-definition views of Earth’s horizon, cloud formations, and atmospheric glow from low Earth orbit.',
      thumbnailUrl: '/src/assets/images/thumb_space_earth_1795610179696.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      channelName: 'Space Exploration',
      channelAvatar: buildAvatarUri('Space Exploration'),
      views: 18900,
      uploadDate: 'Started 5 hours ago',
      duration: 'LIVE',
      category: 'Education',
      isShort: 0,
      isLive: 1,
      likes: 8900,
      dislikes: 42,
      createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    },
    // Vertical Shorts
    {
      id: 's1',
      title: 'Golden Hour Kickflip at Concrete Park',
      description: 'Slow-motion breakdown of a clean sunset kickflip over the hip.',
      thumbnailUrl: '/src/assets/images/short_street_skate_1795610180407.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      channelName: 'Street Sports',
      channelAvatar: buildAvatarUri('Street Sports'),
      views: 540000,
      uploadDate: '1 day ago',
      duration: '0:42',
      category: 'Sports',
      isShort: 1,
      isLive: 0,
      likes: 31200,
      dislikes: 120,
      createdAt: new Date(Date.now() - 86400_000).toISOString(),
    },
    {
      id: 's2',
      title: 'Pouring a Crisp Rosetta in 30 Seconds',
      description: 'Microfoam milk texture tips for clean ceramic cup latte art.',
      thumbnailUrl: '/src/assets/images/short_latte_art_1795610179530.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      channelName: 'Chef Osei',
      channelAvatar: buildAvatarUri('Chef Osei'),
      views: 280000,
      uploadDate: '3 days ago',
      duration: '0:31',
      category: 'Cooking',
      isShort: 1,
      isLive: 0,
      likes: 19400,
      dislikes: 45,
      createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    },
    {
      id: 's3',
      title: 'Modular Synth Late-Night Jam',
      description: 'Patching an analog acid bassline with tape delay in the studio.',
      thumbnailUrl: '/src/assets/images/short_synth_jam_1795610180173.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      channelName: 'Chill Vibes',
      channelAvatar: buildAvatarUri('Chill Vibes'),
      views: 690000,
      uploadDate: '5 days ago',
      duration: '0:55',
      category: 'Music',
      isShort: 1,
      isLive: 0,
      likes: 48200,
      dislikes: 85,
      createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    },
    {
      id: 's4',
      title: 'Rainy Night Walk Through Neon Alley',
      description: 'Binaural rain soundscape and street photography walk after dusk.',
      thumbnailUrl: '/src/assets/images/short_city_rain_1795610180366.jpg',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      channelName: 'Photo Pro',
      channelAvatar: buildAvatarUri('Photo Pro'),
      views: 420000,
      uploadDate: '1 week ago',
      duration: '0:48',
      category: 'Photography',
      isShort: 1,
      isLive: 0,
      likes: 27900,
      dislikes: 61,
      createdAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
    },
  ];

  const insertVideo = db.prepare(`
    INSERT OR IGNORE INTO videos
    (id, title, description, videoUrl, thumbnailUrl, channelName, channelAvatar, userId, views, uploadDate, duration, category, isShort, isLive, likes, dislikes, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const healVideo = db.prepare(`
    UPDATE videos
    SET thumbnailUrl = ?, channelAvatar = ?, category = ?, isShort = ?, isLive = ?, createdAt = COALESCE(NULLIF(createdAt, ''), ?)
    WHERE id = ? AND (thumbnailUrl LIKE '%unsplash%' OR channelAvatar LIKE '%dicebear%' OR category = 'General' OR category IS NULL)
  `);

  const insertChannel = db.prepare(`
    INSERT OR IGNORE INTO channel_stats (channelName, subscribers, bio, joinedDate)
    VALUES (?, ?, ?, ?)
  `);

  for (const v of curatedVideos) {
    insertVideo.run(
      v.id,
      v.title,
      v.description,
      v.videoUrl,
      v.thumbnailUrl,
      v.channelName,
      v.channelAvatar,
      v.views,
      v.uploadDate,
      v.duration,
      v.category,
      v.isShort,
      v.isLive,
      v.likes,
      v.dislikes,
      v.createdAt
    );
    healVideo.run(v.thumbnailUrl, v.channelAvatar, v.category, v.isShort, v.isLive, v.createdAt, v.id);
    insertChannel.run(
      v.channelName,
      Math.max(12000, Math.round(v.views * 0.45)),
      `Official ${v.channelName} channel on Osei TV — curated ${v.category.toLowerCase()} stories, tutorials, and live broadcasts.`,
      'Mar 2024'
    );
  }

  // Seed initial comments if none exist on video 1
  const existingComments = db.prepare('SELECT COUNT(*) as cnt FROM comments WHERE videoId = ?').get('1') as { cnt: number };
  if (existingComments.cnt === 0) {
    const insertComment = db.prepare(`
      INSERT INTO comments (id, videoId, userId, username, avatar, text, likes, date, createdAt)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
    `);
    insertComment.run(
      'c1',
      '1',
      'DevGuy',
      buildAvatarUri('DevGuy'),
      'Clean breakdown of the player state architecture—thanks for walking through every detail!',
      42,
      '1 day ago',
      new Date(Date.now() - 86400_000).toISOString()
    );
    insertComment.run(
      'c2',
      '1',
      'ReactBuilder',
      buildAvatarUri('ReactBuilder'),
      'The keyboard shortcut integration and theater mode layout look super crisp.',
      19,
      '12 hours ago',
      new Date(Date.now() - 43200_000).toISOString()
    );
  }

  // Seed initial live chat messages for live streams
  const liveIds = ['5', '9', '10'];
  for (const liveId of liveIds) {
    const chatCount = db.prepare('SELECT COUNT(*) as cnt FROM live_chat WHERE videoId = ?').get(liveId) as { cnt: number };
    if (chatCount.cnt === 0) {
      const insertChat = db.prepare(
        'INSERT INTO live_chat (id, videoId, username, avatar, text, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
      );
      insertChat.run(
        `lc-${liveId}-1`,
        liveId,
        'NightOwl',
        buildAvatarUri('NightOwl'),
        'Audio and stream clarity are super crisp tonight.',
        new Date(Date.now() - 180_000).toISOString()
      );
      insertChat.run(
        `lc-${liveId}-2`,
        liveId,
        'KofiStudio',
        buildAvatarUri('KofiStudio'),
        'Checking in from Accra — great broadcast!',
        new Date(Date.now() - 90_000).toISOString()
      );
    }
  }
}

seedCatalog();

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  });
  return cookies;
}

function setSessionCookie(req: express.Request, res: express.Response, token: string) {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';
  const parts = [`oseitv_session=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'Max-Age=604800'];
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: express.Request, res: express.Response) {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';
  const parts = ['oseitv_session=', 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttps) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function isSafeMediaUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  if (trimmed === 'LIVE_STREAM') return true;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/src/assets/')) return true;
  if (trimmed.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function formatVideoRow(row: any) {
  const numericViews = Number(row.views) || 0;
  const isLive = Boolean(row.isLive) || row.duration === 'LIVE';
  return {
    id: String(row.id),
    title: row.title || 'Untitled Video',
    description: row.description || '',
    videoUrl: row.videoUrl || '',
    thumbnailUrl: row.thumbnailUrl || '/src/assets/images/thumb_react_code_1795610177755.jpg',
    channelName: row.channelName || 'Creator',
    channelAvatar: row.channelAvatar || buildAvatarUri(row.channelName || 'Creator'),
    userId: row.userId || null,
    views: formatViewsLabel(numericViews, isLive),
    viewCount: numericViews,
    uploadDate: row.uploadDate || 'Recently',
    duration: isLive ? 'LIVE' : row.duration || '0:00',
    category: row.category || 'General',
    isShort: Boolean(row.isShort),
    isLive,
    likes: Number(row.likes) || 0,
    dislikes: Number(row.dislikes) || 0,
    createdAt: row.createdAt || row.uploadDate || new Date().toISOString(),
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' }));

  const extractUser = (req: express.Request): { id: string; username: string; avatar: string } | null => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let fromCookie = false;
    if (!token) {
      const cookies = parseCookies(req.headers.cookie);
      if (cookies.oseitv_session) {
        token = cookies.oseitv_session;
        fromCookie = true;
      }
    }
    if (!token) return null;

    if (fromCookie && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const hasCustomHeader = req.headers['x-requested-with'] === 'OseiTV';
      const origin = req.headers.origin;
      const expectedHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
      let originValid = false;
      if (origin && expectedHost) {
        try {
          originValid = new URL(origin).host === expectedHost;
        } catch {
          originValid = false;
        }
      }
      if (!hasCustomHeader && !originValid) return null;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; avatar: string };
      return decoded;
    } catch {
      return null;
    }
  };

  const authenticateToken = (req: any, res: any, next: any) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    req.user = user;
    next();
  };

  // --- Auth Routes ---
  app.post('/api/auth/register', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (username.length < 2 || username.length > 40) {
      return res.status(400).json({ error: 'Username must be between 2 and 40 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const id = `u-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const avatar = buildAvatarUri(username);
      const createdAt = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, username, email, password, avatar, subscribers, isPremium, createdAt) VALUES (?, ?, ?, ?, ?, 0, 0, ?)'
      ).run(id, username, email, hashedPassword, avatar, createdAt);

      db.prepare(
        'INSERT OR IGNORE INTO channel_stats (channelName, subscribers, bio, joinedDate) VALUES (?, 0, ?, ?)'
      ).run(username, `Welcome to ${username}'s official channel on Osei TV.`, 'Joined recently');

      db.prepare(
        'INSERT INTO notifications (id, userId, title, message, link, isRead, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)'
      ).run(
        `n-${Date.now()}`,
        id,
        'Welcome to Osei TV',
        'Your creator channel is ready. Upload a video or launch Live Studio anytime.',
        `/channel/${encodeURIComponent(username)}`,
        createdAt
      );

      const token = jwt.sign({ id, username, avatar }, JWT_SECRET, { expiresIn: '7d' });
      setSessionCookie(req, res, token);
      res.json({ token, user: { id, username, avatar, isPremium: false } });
    } catch (e: any) {
      if (e.message?.includes('UNIQUE')) {
        return res.status(409).json({ error: 'An account with that email or username already exists.' });
      }
      res.status(400).json({ error: 'Could not create account.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email) as any;
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      const avatar =
        user.avatar && !user.avatar.includes('dicebear.com')
          ? user.avatar
          : buildAvatarUri(user.username);
      const token = jwt.sign({ id: user.id, username: user.username, avatar }, JWT_SECRET, {
        expiresIn: '7d',
      });
      setSessionCookie(req, res, token);
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          avatar,
          isPremium: Boolean(user.isPremium),
        },
      });
    } catch {
      res.status(500).json({ error: 'Sign in failed.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const sessionUser = extractUser(req);
    if (!sessionUser) {
      return res.status(200).json({ user: null, token: null });
    }
    try {
      const user = db
        .prepare('SELECT id, username, email, avatar, subscribers, isPremium FROM users WHERE id = ?')
        .get(sessionUser.id) as any;
      if (!user) return res.json({ user: null, token: null });
      const avatar =
        user.avatar && !user.avatar.includes('dicebear.com')
          ? user.avatar
          : buildAvatarUri(user.username);
      const freshToken = jwt.sign({ id: user.id, username: user.username, avatar }, JWT_SECRET, {
        expiresIn: '7d',
      });
      res.json({
        token: freshToken,
        user: {
          id: user.id,
          username: user.username,
          avatar,
          subscribers: user.subscribers || 0,
          isPremium: Boolean(user.isPremium),
        },
      });
    } catch {
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });

  // --- Media Upload ---
  app.post(
    '/api/upload',
    authenticateToken,
    upload.fields([
      { name: 'video', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ]),
    (req: any, res) => {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const videoFile = files?.video?.[0];
      const thumbFile = files?.thumbnail?.[0];
      if (!videoFile) {
        return res.status(400).json({ error: 'No valid video file provided.' });
      }
      res.json({
        videoUrl: `/uploads/${videoFile.filename}`,
        thumbnailUrl: thumbFile ? `/uploads/${thumbFile.filename}` : null,
      });
    }
  );

  // --- Video Catalog Routes ---
  app.get('/api/videos', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const onlyLive = req.query.live === 'true';
    const onlyShorts = req.query.short === 'true';
    const sort = req.query.sort === 'trending' ? 'trending' : 'recent';

    const orderBy = sort === 'trending' ? 'ORDER BY views DESC, likes DESC' : 'ORDER BY isLive DESC, createdAt DESC, id DESC';
    const rows = db.prepare(`SELECT * FROM videos ${orderBy}`).all() as any[];

    let filtered = rows.map(formatVideoRow);
    if (onlyLive) {
      filtered = filtered.filter((v) => v.isLive);
    }
    if (onlyShorts) {
      filtered = filtered.filter((v) => v.isShort);
    }
    if (category && category !== 'All') {
      if (category === 'Live') {
        filtered = filtered.filter((v) => v.isLive);
      } else if (category === 'Recently uploaded') {
        filtered = filtered.slice(0, 8);
      } else {
        const lower = category.toLowerCase();
        filtered = filtered.filter(
          (v) =>
            v.category.toLowerCase() === lower ||
            v.title.toLowerCase().includes(lower) ||
            (v.description || '').toLowerCase().includes(lower)
        );
      }
    }
    if (q) {
      filtered = filtered.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.channelName.toLowerCase().includes(q) ||
          (v.description || '').toLowerCase().includes(q) ||
          (v.category || '').toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  });

  app.get('/api/videos/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Video not found' });
    const sessionUser = extractUser(req);
    let userReaction: 'like' | 'dislike' | null = null;
    let isWatchLater = false;
    let isSubscribed = false;

    if (sessionUser) {
      const rx = db
        .prepare('SELECT reaction FROM video_reactions WHERE userId = ? AND videoId = ?')
        .get(sessionUser.id, row.id) as { reaction: 'like' | 'dislike' } | undefined;
      userReaction = rx?.reaction || null;

      const wl = db
        .prepare('SELECT 1 FROM watch_later WHERE userId = ? AND videoId = ?')
        .get(sessionUser.id, row.id);
      isWatchLater = Boolean(wl);

      const sub = db
        .prepare('SELECT 1 FROM subscriptions WHERE subscriberId = ? AND channelName = ?')
        .get(sessionUser.id, row.channelName);
      isSubscribed = Boolean(sub);
    }

    const channelStat = db
      .prepare('SELECT subscribers FROM channel_stats WHERE channelName = ?')
      .get(row.channelName) as { subscribers: number } | undefined;

    res.json({
      ...formatVideoRow(row),
      channelSubscribers: channelStat?.subscribers ?? 12000,
      userReaction,
      isWatchLater,
      isSubscribed,
    });
  });

  app.post('/api/videos', authenticateToken, (req: any, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const videoUrl = typeof req.body?.videoUrl === 'string' ? req.body.videoUrl.trim() : '';
    const thumbnailUrl =
      typeof req.body?.thumbnailUrl === 'string' && isSafeMediaUrl(req.body.thumbnailUrl)
        ? req.body.thumbnailUrl.trim()
        : '/src/assets/images/thumb_react_code_1795610177755.jpg';
    const duration = typeof req.body?.duration === 'string' ? req.body.duration.trim() : '0:30';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : 'General';
    const isShort = Boolean(req.body?.isShort) ? 1 : 0;
    const isLive = videoUrl === 'LIVE_STREAM' || duration === 'LIVE' ? 1 : 0;

    if (!title || title.length > 150) {
      return res.status(400).json({ error: 'A valid video title (1–150 characters) is required.' });
    }
    if (!isSafeMediaUrl(videoUrl)) {
      return res.status(400).json({ error: 'A valid video source is required.' });
    }

    const { id: userId, username, avatar } = req.user;
    const id = `v-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const nowIso = new Date().toISOString();
    const uploadDate = isLive ? 'Live now' : 'Just now';

    try {
      db.prepare(
        `INSERT INTO videos
         (id, title, description, videoUrl, thumbnailUrl, channelName, channelAvatar, userId, views, uploadDate, duration, category, isShort, isLive, likes, dislikes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
      ).run(
        id,
        title,
        description,
        videoUrl,
        thumbnailUrl,
        username,
        avatar,
        userId,
        isLive ? 1 : 0,
        uploadDate,
        isLive ? 'LIVE' : duration,
        category || 'General',
        isShort,
        isLive,
        nowIso
      );

      db.prepare(
        'INSERT OR IGNORE INTO channel_stats (channelName, subscribers, bio, joinedDate) VALUES (?, 0, ?, ?)'
      ).run(username, `Official ${username} channel on Osei TV.`, 'Joined 2026');

      if (isLive) {
        db.prepare(
          'INSERT INTO live_chat (id, videoId, username, avatar, text, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          `lc-${Date.now()}`,
          id,
          username,
          avatar,
          `Welcome to the live broadcast: ${title}!`,
          nowIso
        );
      }

      const created = db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
      res.status(201).json(formatVideoRow(created));
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Could not publish video' });
    }
  });

  app.patch('/api/videos/:id', authenticateToken, (req: any, res) => {
    const existing = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Video not found' });
    if (existing.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const nextTitle =
      typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : existing.title;
    const nextDesc =
      typeof req.body?.description === 'string' ? req.body.description.trim() : existing.description;
    const endLive = req.body?.isLive === false;

    db.prepare(
      `UPDATE videos
       SET title = ?, description = ?, isLive = ?, duration = ?, uploadDate = ?
       WHERE id = ?`
    ).run(
      nextTitle,
      nextDesc,
      endLive ? 0 : existing.isLive,
      endLive ? 'VOD' : existing.duration,
      endLive ? 'Streamed just now' : existing.uploadDate,
      existing.id
    );

    const updated = db.prepare('SELECT * FROM videos WHERE id = ?').get(existing.id);
    res.json(formatVideoRow(updated));
  });

  app.delete('/api/videos/:id', authenticateToken, (req: any, res) => {
    const existing = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Video not found' });
    if (existing.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    db.prepare('DELETE FROM comments WHERE videoId = ?').run(existing.id);
    db.prepare('DELETE FROM video_reactions WHERE videoId = ?').run(existing.id);
    db.prepare('DELETE FROM watch_later WHERE videoId = ?').run(existing.id);
    db.prepare('DELETE FROM watch_history WHERE videoId = ?').run(existing.id);
    db.prepare('DELETE FROM live_chat WHERE videoId = ?').run(existing.id);
    db.prepare('DELETE FROM videos WHERE id = ?').run(existing.id);

    // Clean up local uploaded file safely if confined to uploadsDir
    if (typeof existing.videoUrl === 'string' && existing.videoUrl.startsWith('/uploads/')) {
      const target = path.resolve(uploadsDir, path.basename(existing.videoUrl));
      if (target.startsWith(uploadsDir + path.sep) && fs.existsSync(target)) {
        fs.unlink(target, () => {});
      }
    }
    res.json({ deleted: true });
  });

  app.post('/api/videos/:id/view', (req, res) => {
    const video = db.prepare('SELECT id, views, isLive, duration FROM videos WHERE id = ?').get(req.params.id) as any;
    if (!video) return res.status(404).json({ error: 'Video not found' });

    db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(video.id);
    const updated = db.prepare('SELECT views, isLive, duration FROM videos WHERE id = ?').get(video.id) as any;

    const sessionUser = extractUser(req);
    if (sessionUser) {
      db.prepare(
        `INSERT INTO watch_history (userId, videoId, watchedAt) VALUES (?, ?, ?)
         ON CONFLICT(userId, videoId) DO UPDATE SET watchedAt = excluded.watchedAt`
      ).run(sessionUser.id, video.id, new Date().toISOString());
    }

    const isLive = Boolean(updated.isLive) || updated.duration === 'LIVE';
    res.json({
      viewCount: updated.views,
      views: formatViewsLabel(updated.views, isLive),
    });
  });

  app.post('/api/videos/:id/react', authenticateToken, (req: any, res) => {
    const reaction = req.body?.reaction;
    if (reaction !== 'like' && reaction !== 'dislike') {
      return res.status(400).json({ error: 'Invalid reaction' });
    }
    const video = db.prepare('SELECT id, likes, dislikes FROM videos WHERE id = ?').get(req.params.id) as any;
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const existing = db
      .prepare('SELECT reaction FROM video_reactions WHERE userId = ? AND videoId = ?')
      .get(req.user.id, video.id) as { reaction: 'like' | 'dislike' } | undefined;

    let likes = Number(video.likes) || 0;
    let dislikes = Number(video.dislikes) || 0;
    let nextReaction: 'like' | 'dislike' | null = reaction;

    if (existing?.reaction === reaction) {
      db.prepare('DELETE FROM video_reactions WHERE userId = ? AND videoId = ?').run(req.user.id, video.id);
      if (reaction === 'like') likes = Math.max(0, likes - 1);
      else dislikes = Math.max(0, dislikes - 1);
      nextReaction = null;
    } else if (existing) {
      db.prepare('UPDATE video_reactions SET reaction = ? WHERE userId = ? AND videoId = ?').run(
        reaction,
        req.user.id,
        video.id
      );
      if (reaction === 'like') {
        likes += 1;
        dislikes = Math.max(0, dislikes - 1);
      } else {
        dislikes += 1;
        likes = Math.max(0, likes - 1);
      }
    } else {
      db.prepare('INSERT INTO video_reactions (userId, videoId, reaction) VALUES (?, ?, ?)').run(
        req.user.id,
        video.id,
        reaction
      );
      if (reaction === 'like') likes += 1;
      else dislikes += 1;
    }

    db.prepare('UPDATE videos SET likes = ?, dislikes = ? WHERE id = ?').run(likes, dislikes, video.id);
    res.json({ likes, dislikes, userReaction: nextReaction });
  });

  // --- Comments ---
  app.get('/api/videos/:id/comments', (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.id, c.videoId, c.userId,
                COALESCE(NULLIF(u.username, ''), NULLIF(c.username, ''), 'Viewer') as user,
                COALESCE(NULLIF(u.avatar, ''), NULLIF(c.avatar, ''), '') as avatar,
                c.text, c.likes, c.parentId, c.date, c.createdAt
         FROM comments c
         LEFT JOIN users u ON c.userId = u.id
         WHERE c.videoId = ?
         ORDER BY c.createdAt DESC, c.id DESC`
      )
      .all(req.params.id) as any[];

    const formatted = rows.map((r) => ({
      ...r,
      avatar: r.avatar && !r.avatar.includes('dicebear.com') ? r.avatar : buildAvatarUri(r.user),
      likes: Number(r.likes) || 0,
    }));
    res.json(formatted);
  });

  app.post('/api/videos/:id/comments', authenticateToken, (req: any, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const parentId = typeof req.body?.parentId === 'string' ? req.body.parentId : null;
    if (!text || text.length > 1000) {
      return res.status(400).json({ error: 'Comment must be between 1 and 1000 characters.' });
    }

    const video = db.prepare('SELECT id, title, userId FROM videos WHERE id = ?').get(req.params.id) as any;
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const id = `c-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const createdAt = new Date().toISOString();

    db.prepare(
      'INSERT INTO comments (id, videoId, userId, username, avatar, text, likes, parentId, date, createdAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)'
    ).run(id, video.id, req.user.id, req.user.username, req.user.avatar, text, parentId, 'Just now', createdAt);

    if (video.userId && video.userId !== req.user.id) {
      db.prepare(
        'INSERT INTO notifications (id, userId, title, message, link, isRead, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)'
      ).run(
        `n-${Date.now()}`,
        video.userId,
        'New comment',
        `${req.user.username} commented on "${video.title}"`,
        `/video/${video.id}`,
        createdAt
      );
    }

    res.status(201).json({
      id,
      videoId: video.id,
      userId: req.user.id,
      user: req.user.username,
      avatar: req.user.avatar,
      text,
      likes: 0,
      parentId,
      date: 'Just now',
      createdAt,
    });
  });

  app.post('/api/comments/:commentId/like', (req, res) => {
    const existing = db.prepare('SELECT id, likes FROM comments WHERE id = ?').get(req.params.commentId) as any;
    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    db.prepare('UPDATE comments SET likes = COALESCE(likes, 0) + 1 WHERE id = ?').run(existing.id);
    const updated = db.prepare('SELECT likes FROM comments WHERE id = ?').get(existing.id) as { likes: number };
    res.json({ likes: updated.likes });
  });

  // --- Subscriptions, Watch Later, History, Liked ---
  app.get('/api/subscriptions', authenticateToken, (req: any, res) => {
    const subs = db
      .prepare('SELECT channelName, createdAt FROM subscriptions WHERE subscriberId = ? ORDER BY createdAt DESC')
      .all(req.user.id) as { channelName: string; createdAt: string }[];

    const channels = subs.map((s) => {
      const stat = db
        .prepare('SELECT subscribers FROM channel_stats WHERE channelName = ?')
        .get(s.channelName) as { subscribers: number } | undefined;
      return {
        channelName: s.channelName,
        avatar: buildAvatarUri(s.channelName),
        subscribers: stat?.subscribers ?? 0,
      };
    });

    const names = subs.map((s) => s.channelName);
    let videos: any[] = [];
    if (names.length > 0) {
      const placeholders = names.map(() => '?').join(',');
      videos = db
        .prepare(`SELECT * FROM videos WHERE channelName IN (${placeholders}) ORDER BY createdAt DESC`)
        .all(...names)
        .map(formatVideoRow);
    }

    res.json({ channels, videos });
  });

  app.post('/api/subscriptions/toggle', authenticateToken, (req: any, res) => {
    const channelName = typeof req.body?.channelName === 'string' ? req.body.channelName.trim() : '';
    if (!channelName) return res.status(400).json({ error: 'Channel name required' });

    const existing = db
      .prepare('SELECT 1 FROM subscriptions WHERE subscriberId = ? AND channelName = ?')
      .get(req.user.id, channelName);

    db.prepare(
      'INSERT OR IGNORE INTO channel_stats (channelName, subscribers, bio, joinedDate) VALUES (?, 0, ?, ?)'
    ).run(channelName, `Official ${channelName} channel on Osei TV.`, 'Joined 2024');

    let isSubscribed = false;
    if (existing) {
      db.prepare('DELETE FROM subscriptions WHERE subscriberId = ? AND channelName = ?').run(
        req.user.id,
        channelName
      );
      db.prepare('UPDATE channel_stats SET subscribers = MAX(0, subscribers - 1) WHERE channelName = ?').run(
        channelName
      );
    } else {
      db.prepare('INSERT INTO subscriptions (subscriberId, channelName, createdAt) VALUES (?, ?, ?)').run(
        req.user.id,
        channelName,
        new Date().toISOString()
      );
      db.prepare('UPDATE channel_stats SET subscribers = subscribers + 1 WHERE channelName = ?').run(channelName);
      isSubscribed = true;
    }

    const stat = db
      .prepare('SELECT subscribers FROM channel_stats WHERE channelName = ?')
      .get(channelName) as { subscribers: number };

    res.json({ isSubscribed, subscribers: stat?.subscribers ?? 0 });
  });

  app.get('/api/watch-later', authenticateToken, (req: any, res) => {
    const rows = db
      .prepare(
        `SELECT v.* FROM watch_later wl
         JOIN videos v ON v.id = wl.videoId
         WHERE wl.userId = ?
         ORDER BY wl.createdAt DESC`
      )
      .all(req.user.id);
    res.json(rows.map(formatVideoRow));
  });

  app.post('/api/watch-later/toggle', authenticateToken, (req: any, res) => {
    const videoId = typeof req.body?.videoId === 'string' ? req.body.videoId.trim() : '';
    if (!videoId) return res.status(400).json({ error: 'Video ID required' });
    const existing = db
      .prepare('SELECT 1 FROM watch_later WHERE userId = ? AND videoId = ?')
      .get(req.user.id, videoId);
    if (existing) {
      db.prepare('DELETE FROM watch_later WHERE userId = ? AND videoId = ?').run(req.user.id, videoId);
      return res.json({ saved: false });
    }
    db.prepare('INSERT INTO watch_later (userId, videoId, createdAt) VALUES (?, ?, ?)').run(
      req.user.id,
      videoId,
      new Date().toISOString()
    );
    res.json({ saved: true });
  });

  app.get('/api/history', authenticateToken, (req: any, res) => {
    const rows = db
      .prepare(
        `SELECT v.*, wh.watchedAt FROM watch_history wh
         JOIN videos v ON v.id = wh.videoId
         WHERE wh.userId = ?
         ORDER BY wh.watchedAt DESC`
      )
      .all(req.user.id);
    res.json(rows.map(formatVideoRow));
  });

  app.delete('/api/history', authenticateToken, (req: any, res) => {
    db.prepare('DELETE FROM watch_history WHERE userId = ?').run(req.user.id);
    res.json({ cleared: true });
  });

  app.get('/api/liked-videos', authenticateToken, (req: any, res) => {
    const rows = db
      .prepare(
        `SELECT v.* FROM video_reactions vr
         JOIN videos v ON v.id = vr.videoId
         WHERE vr.userId = ? AND vr.reaction = 'like'`
      )
      .all(req.user.id);
    res.json(rows.map(formatVideoRow));
  });

  // --- Channel Profile ---
  app.get('/api/channels/:channelName', (req, res) => {
    const rawName = decodeURIComponent(req.params.channelName).trim();
    const videos = db
      .prepare('SELECT * FROM videos WHERE lower(channelName) = lower(?) ORDER BY createdAt DESC')
      .all(rawName) as any[];

    const userRow = db
      .prepare('SELECT id, username, avatar, createdAt FROM users WHERE lower(username) = lower(?)')
      .get(rawName) as any;

    const canonicalName = videos[0]?.channelName || userRow?.username || rawName;
    const stat = db
      .prepare('SELECT * FROM channel_stats WHERE lower(channelName) = lower(?)')
      .get(canonicalName) as any;

    if (videos.length === 0 && !userRow && !stat) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const sessionUser = extractUser(req);
    let isSubscribed = false;
    if (sessionUser) {
      const sub = db
        .prepare('SELECT 1 FROM subscriptions WHERE subscriberId = ? AND lower(channelName) = lower(?)')
        .get(sessionUser.id, canonicalName);
      isSubscribed = Boolean(sub);
    }

    const totalViews = videos.reduce((sum, v) => sum + (Number(v.views) || 0), 0);
    const formattedVideos = videos.map(formatVideoRow);

    res.json({
      channel: {
        channelName: canonicalName,
        handle: `@${canonicalName.replace(/\s+/g, '').toLowerCase()}`,
        avatar:
          (userRow?.avatar && !userRow.avatar.includes('dicebear.com') && userRow.avatar) ||
          videos[0]?.channelAvatar ||
          buildAvatarUri(canonicalName),
        subscribers: stat?.subscribers ?? 0,
        isSubscribed,
        totalViews,
        videoCount: formattedVideos.length,
        joinedDate: stat?.joinedDate || 'Mar 2024',
        bio: stat?.bio || `Official ${canonicalName} channel on Osei TV.`,
      },
      videos: formattedVideos,
    });
  });

  // --- Live Chat ---
  app.get('/api/videos/:id/chat', (req, res) => {
    const messages = db
      .prepare(
        'SELECT id, videoId, username as user, avatar, text, createdAt FROM live_chat WHERE videoId = ? ORDER BY createdAt ASC LIMIT 100'
      )
      .all(req.params.id) as any[];
    res.json(
      messages.map((m) => ({
        ...m,
        avatar: m.avatar && !m.avatar.includes('dicebear.com') ? m.avatar : buildAvatarUri(m.user),
      }))
    );
  });

  app.post('/api/videos/:id/chat', (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 200) {
      return res.status(400).json({ error: 'Message must be 1–200 characters.' });
    }
    const sessionUser = extractUser(req);
    const username = sessionUser?.username || 'Guest Viewer';
    const avatar = sessionUser?.avatar || buildAvatarUri(username);
    const id = `lc-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const createdAt = new Date().toISOString();

    db.prepare(
      'INSERT INTO live_chat (id, videoId, username, avatar, text, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, req.params.id, username, avatar, text, createdAt);

    res.status(201).json({ id, videoId: req.params.id, user: username, avatar, text, createdAt });
  });

  // --- Notifications & Premium ---
  app.get('/api/notifications', authenticateToken, (req: any, res) => {
    const rows = db
      .prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 20')
      .all(req.user.id) as any[];
    res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        link: r.link,
        isRead: Boolean(r.isRead),
        createdAt: r.createdAt,
      }))
    );
  });

  app.post('/api/notifications/read-all', authenticateToken, (req: any, res) => {
    db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ?').run(req.user.id);
    res.json({ ok: true });
  });

  app.post('/api/premium/activate', authenticateToken, (req: any, res) => {
    db.prepare('UPDATE users SET isPremium = 1 WHERE id = ?').run(req.user.id);
    db.prepare(
      'INSERT INTO notifications (id, userId, title, message, link, isRead, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)'
    ).run(
      `n-${Date.now()}`,
      req.user.id,
      'Osei TV Premium Active',
      'Your ad-free streaming, offline downloads, and Music Premium benefits are active.',
      '/',
      new Date().toISOString()
    );
    res.json({ isPremium: true });
  });

  // Static serving for uploaded videos/thumbnails and generated media assets
  app.use('/uploads', express.static(uploadsDir));
  app.use('/src/assets/images', express.static(path.resolve(__dirname, 'src', 'assets', 'images')));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Osei TV server running on http://localhost:${PORT}`);
  });
}

startServer();
