import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import youtubedl from 'youtube-dl-exec';
import { initDatabase, getDb } from './database';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8150;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'waisify-super-secret-key-2026';

let youtube: any;

// Initialize YouTube client dynamically to bypass ESM limitations in CommonJS
async function initYoutube() {
  try {
    const { Innertube, Platform } = await eval("import('youtubei.js')");
    
    // Configure custom evaluator shim for YouTube cipher deciphering
    Platform.shim.eval = async (data: any) => {
      return new Function(data.output)();
    };

    youtube = await Innertube.create();
    console.log('youtubei.js Innertube client initialized successfully with evaluator shim');
  } catch (error) {
    console.error('Failed to initialize Innertube client:', error);
  }
}

// Authentication Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Spotify Client Token Cache
let spotifyToken = '';
let spotifyTokenExpiry = 0;

async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return '';
  }

  if (spotifyToken && Date.now() < spotifyTokenExpiry) {
    return spotifyToken;
  }

  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      console.error('Failed to get Spotify token:', response.statusText);
      return '';
    }

    const data: any = await response.json();
    spotifyToken = data.access_token;
    spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return spotifyToken;
  } catch (error) {
    console.error('Error fetching Spotify token:', error);
    return '';
  }
}

// Helper to parse YouTube duration strings (e.g., "4:12" or "1:15:30") to seconds
function parseDuration(durationStr: string): number {
  const parts = durationStr.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

// Routes

// 1. Auth: Register
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const db = getDb();
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );

    const userId = result.lastID;
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, username, userId });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, userId: user.id });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Search: Spotify & YouTube combined search
app.get('/api/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const spotifyToken = await getSpotifyToken();
  if (spotifyToken) {
    // Search Spotify
    try {
      console.log(`Searching Spotify for query: "${query}"`);
      const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=25`, {
        headers: { 'Authorization': `Bearer ${spotifyToken}` }
      });

      if (response.ok) {
        const data: any = await response.json();
        const tracks = data.tracks.items.map((track: any) => ({
          source: 'spotify',
          id: track.id,
          title: track.name,
          artist: track.artists.map((a: any) => a.name).join(', '),
          thumbnail: track.album.images[0]?.url || track.album.images[1]?.url || '',
          duration: Math.floor(track.duration_ms / 1000),
          youtubeId: '' // Will be resolved dynamically on playback
        }));
        return res.json(tracks);
      } else {
        console.error('Spotify API returned non-OK status:', response.statusText);
      }
    } catch (err) {
      console.error('Spotify API search failed, falling back to YouTube:', err);
    }
  }

  // Fallback / Default: Search YouTube
  try {
    console.log(`Searching YouTube for query: "${query}"`);
    if (!youtube) {
      return res.status(503).json({ error: 'YouTube client is initializing, try again' });
    }
    const results = await youtube.search(query, { type: 'video' });
    
    // Process video objects safely
    const tracks = (results.videos || [])
      .map((item: any) => {
        const videoId = item.id || item.video_id;
        if (!videoId) return null;
        
        const title = item.title?.toString() || item.title?.text || 'Unknown Title';
        const artist = item.author?.name || item.author?.text || 'Unknown Artist';
        const thumbnail = item.thumbnails?.[0]?.url || item.thumbnail?.[0]?.url || '';
        const durationSec = item.duration?.seconds || 
          (typeof item.duration?.text === 'string' ? parseDuration(item.duration.text) : 180);

        return {
          source: 'youtube',
          id: videoId,
          title,
          artist,
          thumbnail,
          duration: durationSec,
          youtubeId: videoId
        };
      })
      .filter(Boolean);

    res.json(tracks);
  } catch (err: any) {
    console.error('YouTube search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Resolve Track Title & Artist to YouTube ID silently
app.get('/api/resolve', async (req, res) => {
  const { title, artist } = req.query;
  if (!title || !artist) {
    return res.status(400).json({ error: 'Title and artist parameters are required' });
  }

  try {
    if (!youtube) {
      return res.status(503).json({ error: 'YouTube client is initializing' });
    }

    const query = `${title} ${artist}`;
    console.log(`[YouTube Resolver] Resolving query for Spotify track: "${query}"`);
    const results = await youtube.search(query, { type: 'video' });
    const firstVideo = results.videos?.[0] as any;

    if (!firstVideo) {
      return res.status(404).json({ error: 'Song not found on YouTube' });
    }

    const videoId = firstVideo.id || firstVideo.video_id;
    if (!videoId) {
      return res.status(404).json({ error: 'Invalid video ID resolved' });
    }

    res.json({ youtubeId: videoId });
  } catch (err: any) {
    console.error('Resolve error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to resolve stream URL using savenow.to (loader.to widget backend)
async function resolveViaSavenow(youtubeId: string): Promise<string> {
  const domain = 'p.savenow.to';
  const downloadUrl = `https://${domain}/api/v2/download?button=1&format=mp3&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + youtubeId)}`;
  
  console.log(`[Savenow] Triggering download for ${youtubeId}...`);
  const response = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Savenow trigger failed with status ${response.status}`);
  }
  
  const data = (await response.json()) as any;
  if (data && data.success && data.download_url) {
    console.log(`[Savenow] Cached stream found instantly!`);
    return data.download_url;
  }
  
  if (!data || !data.id) {
    throw new Error('No conversion ID returned from Savenow');
  }
  
  const id = data.id;
  console.log(`[Savenow] Starting progress polling for ID: ${id}`);
  
  // Poll for up to 30 seconds (20 attempts, 1.5s delay) to stay within request timeout limits
  for (let attempt = 1; attempt <= 20; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      const progressRes = await fetch(`https://${domain}/api/progress?id=${id}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      if (progressRes.ok) {
        const progData = (await progressRes.json()) as any;
        console.log(`[Savenow] Poll attempt ${attempt} progress: ${progData.progress / 10}%`);
        if (progData && progData.success === 1 && progData.download_url) {
          console.log(`[Savenow] Resolved stream URL: ${progData.download_url}`);
          return progData.download_url;
        }
      }
    } catch (e: any) {
      console.warn(`[Savenow] Poll attempt ${attempt} failed:`, e.message);
    }
  }
  
  throw new Error('Savenow conversion timed out');
}

// Local disk cache of fully-downloaded audio, keyed by youtubeId.
// Several problems forced this instead of proxying/re-fetching per request:
//  - A single track load triggers many HTTP requests (initial + Range
//    requests as the player buffers/seeks). Re-running the whole
//    yt-dlp -> Savenow -> Piped chain per request meant parallel ~20-30s
//    Savenow conversions that never all finished in time.
//  - Savenow's CDN doesn't honor Range requests (always answers 200 with
//    the full file, never 206), so every "chunk" request downloaded the
//    entire track again from scratch.
// Downloading once to disk and serving that file (which DOES support Range,
// via res.sendFile) fixes both: first play pays the resolve+download cost
// once, everything after — including going back to a previously played
// track — reads instantly from disk.
const AUDIO_CACHE_DIR = path.resolve(process.cwd(), 'audio-cache');
if (!fs.existsSync(AUDIO_CACHE_DIR)) {
  fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
}

const audioDownloadInFlight = new Map<string, Promise<{ filePath: string; contentType: string }>>();

function getCachedAudioFile(youtubeId: string): { filePath: string; contentType: string } | null {
  const metaPath = path.join(AUDIO_CACHE_DIR, `${youtubeId}.json`);
  const filePath = path.join(AUDIO_CACHE_DIR, `${youtubeId}.audio`);
  if (fs.existsSync(metaPath) && fs.existsSync(filePath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      return { filePath, contentType: meta.contentType || 'audio/mpeg' };
    } catch {
      return null;
    }
  }
  return null;
}

// Extracts a real amplitude envelope from a cached audio file — decodes to
// raw mono PCM via ffmpeg, computes RMS loudness over fixed windows, and
// downsamples to a fixed number of points (independent of track length) so
// the client can index into it by playback percentage. Used to drive the
// player's visualizer off the track's actual energy instead of a canned
// animation loop.
const WAVEFORM_POINTS = 300;
async function computeWaveform(youtubeId: string, filePath: string): Promise<void> {
  const waveformPath = path.join(AUDIO_CACHE_DIR, `${youtubeId}.waveform.json`);
  if (fs.existsSync(waveformPath)) return;

  const SAMPLE_RATE = 8000;
  const WINDOW_SAMPLES = 800; // 100ms per window at 8kHz

  await new Promise<void>((resolve) => {
    const chunks: Buffer[] = [];
    const proc = spawn(ffmpegPath as unknown as string, ['-i', filePath, '-f', 's16le', '-ac', '1', '-ar', String(SAMPLE_RATE), '-']);
    proc.stdout.on('data', (d) => chunks.push(d));
    proc.on('error', (e) => {
      console.warn(`[Waveform] ffmpeg spawn failed for "${youtubeId}":`, e.message);
      resolve();
    });
    proc.on('close', (code) => {
      try {
        if (code !== 0) {
          console.warn(`[Waveform] ffmpeg exited ${code} for "${youtubeId}"`);
          return resolve();
        }
        const buf = Buffer.concat(chunks);
        const sampleCount = Math.floor(buf.length / 2);

        const windows: number[] = [];
        for (let i = 0; i + WINDOW_SAMPLES <= sampleCount; i += WINDOW_SAMPLES) {
          let sumSq = 0;
          for (let j = 0; j < WINDOW_SAMPLES; j++) {
            const sample = buf.readInt16LE((i + j) * 2) / 32768;
            sumSq += sample * sample;
          }
          windows.push(Math.sqrt(sumSq / WINDOW_SAMPLES));
        }

        if (windows.length === 0) {
          console.warn(`[Waveform] No windows computed for "${youtubeId}" (file too short?)`);
          return resolve();
        }

        const out: number[] = [];
        for (let i = 0; i < WAVEFORM_POINTS; i++) {
          const idx = Math.floor((i / WAVEFORM_POINTS) * windows.length);
          out.push(windows[idx] || 0);
        }
        const max = Math.max(...out, 0.0001);
        const normalized = out.map((v) => Math.round((v / max) * 100) / 100);

        fs.writeFileSync(waveformPath, JSON.stringify(normalized));
        console.log(`[Waveform] Computed for "${youtubeId}"`);
      } catch (e: any) {
        console.warn(`[Waveform] Processing failed for "${youtubeId}":`, e.message);
      }
      resolve();
    });
  });
}

// Starts (or joins) a background download of the full track to disk, tee-ing
// the same network stream to `res` as it arrives so the first caller doesn't
// wait for the download to finish before hearing anything. Only the request
// that actually triggers the download gets the live tee — a request that
// arrives while a download is already in flight just waits for it to land on
// disk and gets served from there (see the /api/audio handler below).
function startAudioDownload(youtubeId: string, streamUrl: string, res?: any): Promise<{ filePath: string; contentType: string }> {
  const promise = (async () => {
    const upstreamOrigin = new URL(streamUrl).origin;
    console.log(`[Audio Cache] Downloading + streaming "${youtubeId}"...`);
    const startedAt = Date.now();

    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': upstreamOrigin + '/',
        'Origin': upstreamOrigin,
      },
    });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    if (res) res.setHeader('Content-Type', contentType);

    const tmpPath = path.join(AUDIO_CACHE_DIR, `${youtubeId}.tmp-${Date.now()}`);
    const finalPath = path.join(AUDIO_CACHE_DIR, `${youtubeId}.audio`);
    const metaPath = path.join(AUDIO_CACHE_DIR, `${youtubeId}.json`);
    const fileStream = fs.createWriteStream(tmpPath);
    const nodeStream = Readable.fromWeb(response.body as any);

    if (res) {
      res.on('error', () => { /* client disconnected — let the disk write continue so we still cache it */ });
    }

    return await new Promise<{ filePath: string; contentType: string }>((resolve, reject) => {
      nodeStream.on('error', (e) => { fileStream.destroy(e); reject(e); });
      fileStream.on('error', (e) => {
        try { fs.unlinkSync(tmpPath); } catch {}
        reject(e);
      });
      fileStream.on('finish', () => {
        try {
          fs.renameSync(tmpPath, finalPath);
          fs.writeFileSync(metaPath, JSON.stringify({ contentType }));
          console.log(`[Audio Cache] Cached "${youtubeId}" to disk in ${Date.now() - startedAt}ms`);
          resolve({ filePath: finalPath, contentType });
          computeWaveform(youtubeId, finalPath).catch((e) => console.warn(`[Waveform] Failed for "${youtubeId}":`, e.message));
        } catch (e) {
          reject(e);
        }
      });
      nodeStream.pipe(fileStream);
      if (res) nodeStream.pipe(res);
    });
  })().finally(() => audioDownloadInFlight.delete(youtubeId));

  audioDownloadInFlight.set(youtubeId, promise);
  return promise;
}

// Resolves a YouTube ID to a direct upstream audio URL.
// NOTE: URLs from step 1/3 are googlevideo.com links bound to the resolving
// server's IP (YouTube's CDN rejects requests from a different IP than the
// one that requested the URL) — callers that hand the URL to a remote client
// MUST proxy the bytes (see /api/audio) rather than passing it through raw.
async function resolveAudioStreamUrl(youtubeId: string): Promise<string | null> {
  // 1. Try youtube-dl-exec first (fastest, uses yt-dlp which bypasses bot blocks natively)
  try {
    console.log(`[YouTube Stream] Resolving stream for video ID: "${youtubeId}" using youtube-dl-exec...`);

    // iOS AVPlayer can't decode Opus/WebM — force an m4a/AAC audio track
    const options: any = { getUrl: true, format: 'bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio' };
    const cookiesPath = path.resolve(process.cwd(), 'youtube.com_cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      options.cookies = cookiesPath;
    }

    const streamUrl = await youtubedl(`https://www.youtube.com/watch?v=${youtubeId}`, options);

    if (streamUrl && typeof streamUrl === 'string') {
      console.log(`[YouTube Stream] Successfully resolved stream URL for video ID: "${youtubeId}"`);
      return streamUrl;
    }
    throw new Error('No audio format URL found in youtube-dl response');
  } catch (err: any) {
    console.warn(`[YouTube Stream] youtube-dl failed to resolve "${youtubeId}" (${err.message}). Falling back to Savenow...`);
  }

  // 2. Try Savenow.to (proxy fallback, takes ~20-30s if not cached)
  try {
    console.log(`[YouTube Stream] Resolving stream for video ID: "${youtubeId}" using Savenow API...`);
    const streamUrl = await resolveViaSavenow(youtubeId);
    if (streamUrl) {
      console.log(`[YouTube Stream] Successfully resolved stream URL via Savenow for "${youtubeId}"`);
      return streamUrl;
    }
  } catch (savenowErr: any) {
    console.warn(`[YouTube Stream] Savenow resolution failed for "${youtubeId}":`, savenowErr.message);
  }

  // 3. Fallback to Piped instances
  console.log(`[YouTube Stream] Trying Piped API fallbacks...`);

  const pipedInstances = [
    'https://pipedapi.lunar.icu',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.chg.gg',
    'https://pipedapi.ox.0y.at',
    'https://pipedapi.kavin.rocks'
  ];

  for (const inst of pipedInstances) {
    try {
      console.log(`[YouTube Stream] Fallback: trying Piped instance: ${inst}`);
      const response = await fetch(`${inst}/streams/${youtubeId}`);
      if (response.ok) {
        const data = (await response.json()) as any;
        if (data && data.audioStreams && data.audioStreams.length > 0) {
          // Prefer an m4a/AAC stream — iOS AVPlayer can't decode Opus/WebM
          const m4aStream = data.audioStreams.find((s: any) => (s.mimeType || '').includes('mp4') || (s.codec || '').startsWith('mp4a'));
          const streamUrl = (m4aStream || data.audioStreams[0]).url;
          if (streamUrl) {
            console.log(`[YouTube Stream] Success! Resolved stream URL via Piped instance: ${inst}`);
            return streamUrl;
          }
        }
      }
    } catch (pipedErr: any) {
      console.log(`[YouTube Stream] Piped instance ${inst} failed: ${pipedErr.message}`);
    }
  }

  console.error(`[YouTube Stream] All fallback systems failed for video ID: "${youtubeId}"`);
  return null;
}

// 5. Stream: Resolve YouTube ID to a direct audio stream URL (debug/inspection use —
// the app should prefer /api/audio, since this raw URL may be IP-locked to this server).
app.get('/api/stream', async (req, res) => {
  const { youtubeId } = req.query;
  if (!youtubeId) {
    return res.status(400).json({ error: 'youtubeId parameter is required' });
  }

  const streamUrl = await resolveAudioStreamUrl(youtubeId as string);
  if (streamUrl) {
    return res.json({ streamUrl });
  }
  res.status(500).json({ error: 'All streaming resolution methods failed' });
});

// 5b. Audio: Resolve + proxy the actual audio bytes to the client.
// This is what the app should use for playback — it sidesteps YouTube's
// IP-locked googlevideo URLs entirely (this server does both the resolve
// AND the fetch, so the IPs always match) and supports Range requests so
// expo-av can seek natively over plain HTTP instead of relying on a
// YouTube iframe's seekTo().
app.get('/api/audio', async (req, res) => {
  const { youtubeId } = req.query;
  if (!youtubeId) {
    return res.status(400).json({ error: 'youtubeId parameter is required' });
  }

  const id = youtubeId as string;

  const serveFromDisk = (filePath: string, contentType: string) => {
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        console.error(`[Audio Proxy] sendFile failed for "${id}":`, err.message);
      }
    });
  };

  try {
    const cached = getCachedAudioFile(id);
    if (cached) {
      return serveFromDisk(cached.filePath, cached.contentType);
    }

    // A download for this track is already streaming to a previous
    // requester (e.g. a Range request that arrived while it was in
    // flight) — wait for it to land on disk rather than starting a
    // second parallel download, then serve the finished file.
    const alreadyDownloading = audioDownloadInFlight.get(id);
    if (alreadyDownloading) {
      const { filePath, contentType } = await alreadyDownloading;
      return serveFromDisk(filePath, contentType);
    }

    const streamUrl = await resolveAudioStreamUrl(id);
    if (!streamUrl) {
      return res.status(502).json({ error: 'All streaming resolution methods failed' });
    }

    // Streams live to `res` while simultaneously writing to disk for next time.
    // nodeStream.pipe(res) ends the response itself once the source ends.
    await startAudioDownload(id, streamUrl, res);
  } catch (err: any) {
    console.error(`[Audio Proxy] Failed for "${id}":`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: err.message || 'Audio proxy failed' });
    }
  }
});

// 5c. Preload: cache a whole playlist's audio to disk ahead of time, so
// playing it later skips the resolve wait entirely. Responds immediately
// with how many tracks were queued; downloads run one at a time in the
// background (sequential, not parallel, to avoid hammering yt-dlp/Savenow
// with a burst of simultaneous requests for a big playlist).
app.post('/api/preload', async (req, res) => {
  const { youtubeIds } = req.body;
  if (!Array.isArray(youtubeIds) || youtubeIds.length === 0) {
    return res.status(400).json({ error: 'youtubeIds array is required' });
  }

  const ids: string[] = youtubeIds.filter((id: any) => typeof id === 'string' && id);
  const alreadyCached = ids.filter((id) => getCachedAudioFile(id)).length;
  const inProgress = ids.filter((id) => !getCachedAudioFile(id) && audioDownloadInFlight.has(id)).length;
  const toQueue = ids.filter((id) => !getCachedAudioFile(id) && !audioDownloadInFlight.has(id));

  res.json({ queued: toQueue.length, alreadyCached, inProgress });

  (async () => {
    console.log(`[Preload] Starting background preload of ${toQueue.length} track(s)`);
    for (const id of toQueue) {
      if (getCachedAudioFile(id) || audioDownloadInFlight.has(id)) continue;
      try {
        const streamUrl = await resolveAudioStreamUrl(id);
        if (!streamUrl) {
          console.error(`[Preload] Could not resolve "${id}"`);
          continue;
        }
        await startAudioDownload(id, streamUrl);
      } catch (e: any) {
        console.error(`[Preload] Failed for "${id}":`, e.message);
      }
    }
    console.log(`[Preload] Finished background preload batch`);
  })();
});

// 5d. Waveform: real amplitude envelope for the player's visualizer.
// Only available once the track is cached (computed right after caching
// finishes) — returns 202 while it's still pending so the client can fall
// back to a generic animation instead of erroring.
app.get('/api/waveform', async (req, res) => {
  const { youtubeId } = req.query;
  if (!youtubeId) {
    return res.status(400).json({ error: 'youtubeId parameter is required' });
  }
  const id = youtubeId as string;

  if (!getCachedAudioFile(id)) {
    return res.status(202).json({ error: 'Audio not cached yet' });
  }

  const waveformPath = path.join(AUDIO_CACHE_DIR, `${id}.waveform.json`);
  if (!fs.existsSync(waveformPath)) {
    return res.status(202).json({ error: 'Waveform still computing' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(waveformPath, 'utf-8'));
    res.json({ points: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 6. Playlists: Get all playlists for logged user
app.get('/api/playlists', authenticateToken, async (req: any, res) => {
  try {
    const db = getDb();
    const playlists = await db.all('SELECT * FROM playlists WHERE user_id = ?', [req.user.id]);
    res.json(playlists);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Playlists: Create a new playlist
app.post('/api/playlists', authenticateToken, async (req: any, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  try {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO playlists (user_id, name) VALUES (?, ?)',
      [req.user.id, name]
    );
    res.status(201).json({ id: result.lastID, user_id: req.user.id, name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Playlists: Delete playlist
app.delete('/api/playlists/:id', authenticateToken, async (req: any, res) => {
  const playlistId = req.params.id;

  try {
    const db = getDb();
    const playlist = await db.get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, req.user.id]);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    await db.run('DELETE FROM playlists WHERE id = ?', [playlistId]);
    res.json({ message: 'Playlist deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Playlists: Get tracks in a playlist
app.get('/api/playlists/:id/tracks', authenticateToken, async (req: any, res) => {
  const playlistId = req.params.id;

  try {
    const db = getDb();
    // Verify ownership
    const playlist = await db.get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, req.user.id]);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const tracks = await db.all('SELECT * FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
    res.json(tracks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Playlists: Add track to a playlist
app.post('/api/playlists/:id/tracks', authenticateToken, async (req: any, res) => {
  const playlistId = req.params.id;
  const { title, artist, duration, thumbnail, youtubeId } = req.body;

  if (!title || !artist || !duration) {
    return res.status(400).json({ error: 'Track title, artist, and duration are required' });
  }

  try {
    const db = getDb();
    // Verify ownership
    const playlist = await db.get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, req.user.id]);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const result = await db.run(
      `INSERT INTO playlist_tracks (playlist_id, title, artist, duration, thumbnail, youtube_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [playlistId, title, artist, duration, thumbnail || '', youtubeId || '']
    );

    res.status(201).json({
      id: result.lastID,
      playlist_id: playlistId,
      title,
      artist,
      duration,
      thumbnail,
      youtube_id: youtubeId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Playlists: Delete track from a playlist
app.delete('/api/playlists/:id/tracks/:trackId', authenticateToken, async (req: any, res) => {
  const { id: playlistId, trackId } = req.params;

  try {
    const db = getDb();
    // Verify ownership of the playlist
    const playlist = await db.get('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, req.user.id]);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    await db.run('DELETE FROM playlist_tracks WHERE id = ? AND playlist_id = ?', [trackId, playlistId]);
    res.json({ message: 'Track removed from playlist' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

interface ImportedTrack {
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  youtubeId?: string;
}

// Ported from the web client (src/renderer.ts importYouTubePlaylist) — reads
// the public RSS feed YouTube exposes for any public playlist, no API key needed.
async function importYouTubePlaylist(playlistId: string): Promise<{ name: string; tracks: ImportedTrack[] }> {
  const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo acceder a la playlist de YouTube. Asegúrate de que sea pública y que el ID sea correcto.');
  const xmlText = await response.text();

  let playlistName = 'Imported YouTube Playlist';
  const feedTitleMatch = xmlText.match(/<feed[^>]*>[\s\S]*?<title>([^<]+)<\/title>/i);
  if (feedTitleMatch) {
    playlistName = feedTitleMatch[1];
  }

  const tracks: ImportedTrack[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch;
  while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
    const entryXml = entryMatch[1];

    const idMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)
                 || entryXml.match(/<id>yt:video:([^<]+)<\/id>/i);
    const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/i);
    const authorMatch = entryXml.match(/<author>[\s\S]*?<name>([^<]+)<\/name>/i);

    if (idMatch && titleMatch) {
      const videoId = idMatch[1].trim();
      const title = titleMatch[1].trim();
      const artist = authorMatch ? authorMatch[1].trim() : 'Artista Desconocido';

      tracks.push({
        title,
        artist,
        duration: 180,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        youtubeId: videoId,
      });
    }
  }

  if (tracks.length === 0) {
    throw new Error('No se encontraron canciones en el canal RSS de la playlist de YouTube. ¿Es pública?');
  }

  return { name: playlistName, tracks };
}

// Reads Spotify's public embed page, which ships a __NEXT_DATA__ script tag
// with the playlist's tracks, no Spotify auth needed. YouTube IDs are
// resolved lazily at play time (same as any other Spotify-sourced track in
// this app). The web client (src/renderer.ts) has an older version of this
// that matches a `<script id="resource">` tag Spotify no longer serves —
// this is the current page shape as of testing this endpoint.
async function importSpotifyPlaylist(playlistId: string): Promise<{ name: string; tracks: ImportedTrack[] }> {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo acceder a la playlist de Spotify. Asegúrate de que sea pública.');
  const html = await response.text();

  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!match) throw new Error('No se pudieron extraer los metadatos de la playlist de Spotify.');

  let entity: any;
  try {
    const data = JSON.parse(match[1]);
    entity = data.props?.pageProps?.state?.data?.entity;
  } catch (e) {
    console.error('Error parsing Spotify embed contents:', e);
    throw new Error('Error al analizar los metadatos de la playlist de Spotify.');
  }

  if (!entity || !Array.isArray(entity.trackList)) {
    throw new Error('No se pudieron extraer las canciones de la playlist de Spotify.');
  }

  const playlistName = entity.name || 'Imported Spotify Playlist';
  const coverArt = entity.coverArt?.sources?.[0]?.url || '';

  const tracks: ImportedTrack[] = entity.trackList
    .filter((t: any) => t.title)
    .map((t: any) => ({
      title: t.title,
      artist: t.subtitle || 'Artista Desconocido',
      duration: Math.floor((t.duration || 180000) / 1000),
      thumbnail: coverArt,
    }));

  return { name: playlistName, tracks };
}

// 12. Playlists: Import a public Spotify or YouTube playlist by URL
app.post('/api/playlists/import', authenticateToken, async (req: any, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    const spotifyMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
    const youtubeMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);

    let result: { name: string; tracks: ImportedTrack[] };
    if (spotifyMatch) {
      result = await importSpotifyPlaylist(spotifyMatch[1]);
    } else if (youtubeMatch) {
      result = await importYouTubePlaylist(youtubeMatch[1]);
    } else {
      return res.status(400).json({ error: 'Formato de enlace no reconocido. Debe ser una playlist de Spotify o YouTube.' });
    }

    if (!result.tracks || result.tracks.length === 0) {
      return res.status(400).json({ error: 'La playlist no contiene canciones o es privada.' });
    }

    const db = getDb();
    const playlistResult = await db.run('INSERT INTO playlists (user_id, name) VALUES (?, ?)', [req.user.id, result.name]);
    const playlistId = playlistResult.lastID;

    for (const track of result.tracks) {
      await db.run(
        `INSERT INTO playlist_tracks (playlist_id, title, artist, duration, thumbnail, youtube_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [playlistId, track.title, track.artist, track.duration, track.thumbnail || '', track.youtubeId || '']
      );
    }

    res.status(201).json({ id: playlistId, name: result.name, trackCount: result.tracks.length });
  } catch (err: any) {
    console.error('[Playlist Import] Failed:', err.message);
    res.status(500).json({ error: err.message || 'No se pudo importar la playlist.' });
  }
});

// Start Server
async function start() {
  await initDatabase();
  await initYoutube();

  app.listen(Number(PORT), HOST, () => {
    console.log(`Waisify Server running on http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Error starting server:', err);
});
