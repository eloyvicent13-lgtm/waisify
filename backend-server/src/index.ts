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

// Cache of resolved upstream URLs, keyed by youtubeId. A single track load
// over HTTP triggers several requests (the initial load + subsequent Range
// requests as the player buffers/seeks) — without this, every single one of
// those would re-run the whole yt-dlp -> Savenow -> Piped chain from
// scratch in parallel, each paying the full ~20-30s Savenow tax, so audio
// would never arrive in time to actually start playing.
const resolvedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const inFlightResolutions = new Map<string, Promise<string | null>>();
const STREAM_CACHE_TTL_MS = 20 * 60 * 1000; // upstream URLs are typically valid for hours; 20min is a safe reuse window

async function getCachedAudioStreamUrl(youtubeId: string): Promise<string | null> {
  const cached = resolvedUrlCache.get(youtubeId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  let inFlight = inFlightResolutions.get(youtubeId);
  if (!inFlight) {
    inFlight = resolveAudioStreamUrl(youtubeId).finally(() => {
      inFlightResolutions.delete(youtubeId);
    });
    inFlightResolutions.set(youtubeId, inFlight);
  }

  const url = await inFlight;
  if (url) {
    resolvedUrlCache.set(youtubeId, { url, expiresAt: Date.now() + STREAM_CACHE_TTL_MS });
  }
  return url;
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

  try {
    const id = youtubeId as string;
    let streamUrl = await getCachedAudioStreamUrl(id);
    if (!streamUrl) {
      return res.status(502).json({ error: 'All streaming resolution methods failed' });
    }

    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    if (req.headers.range) {
      upstreamHeaders['Range'] = req.headers.range as string;
    }

    let upstream = await fetch(streamUrl, { headers: upstreamHeaders });

    // Cached URL may have expired/been revoked upstream (403/404) — evict and re-resolve once.
    if (upstream.status === 403 || upstream.status === 404) {
      console.warn(`[Audio Proxy] Cached URL stale for "${id}" (status ${upstream.status}), re-resolving...`);
      resolvedUrlCache.delete(id);
      streamUrl = await getCachedAudioStreamUrl(id);
      if (!streamUrl) {
        return res.status(502).json({ error: 'All streaming resolution methods failed' });
      }
      upstream = await fetch(streamUrl, { headers: upstreamHeaders });
    }

    if (!upstream.ok && upstream.status !== 206) {
      console.error(`[Audio Proxy] Upstream fetch failed for "${id}": ${upstream.status}`);
      return res.status(502).json({ error: `Upstream fetch failed with status ${upstream.status}` });
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    if (!upstream.body) {
      return res.end();
    }
    Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (err: any) {
    console.error(`[Audio Proxy] Failed for "${youtubeId}":`, err.message);
    res.status(500).json({ error: 'Audio proxy failed' });
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
