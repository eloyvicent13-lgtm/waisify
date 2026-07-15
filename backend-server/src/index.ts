import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDatabase, getDb } from './database';

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
    const { Innertube } = await eval("import('youtubei.js')");
    youtube = await Innertube.create();
    console.log('youtubei.js Innertube client initialized successfully');
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

// 5. Stream: Resolve YouTube ID to direct audio stream URL
app.get('/api/stream', async (req, res) => {
  const { youtubeId } = req.query;
  if (!youtubeId) {
    return res.status(400).json({ error: 'youtubeId parameter is required' });
  }

  try {
    if (!youtube) {
      return res.status(503).json({ error: 'YouTube client is initializing' });
    }

    console.log(`[YouTube Stream] Resolving stream for video ID: "${youtubeId}"`);
    
    // Use getInfo with IOS client to bypass signature decryption blocks and retrieve direct format URLs
    let info;
    try {
      info = await youtube.getInfo(youtubeId as string, { client: 'IOS' });
    } catch (e) {
      console.log('[YouTube Stream] IOS client resolution failed, falling back to default client...', e);
      info = await youtube.getInfo(youtubeId as string);
    }
    
    // Attempt best quality audio
    let format = info.chooseFormat({ type: 'audio', quality: 'best' });
    
    // Fallback 1: Any audio format
    if (!format || !format.url) {
      console.log(`[YouTube Stream] Best audio quality not found for "${youtubeId}", trying any audio...`);
      format = info.chooseFormat({ type: 'audio', quality: 'any' });
    }
    
    // Fallback 2: Any combined video/audio stream if pure audio is blocked/unavailable
    if (!format || !format.url) {
      console.log(`[YouTube Stream] Pure audio streams unavailable for "${youtubeId}", trying mixed video/audio...`);
      format = info.chooseFormat({ type: 'video+audio', quality: 'any' });
    }

    if (!format || !format.url) {
      return res.status(404).json({ error: 'Audio stream not found' });
    }

    res.json({ streamUrl: format.url });
  } catch (err: any) {
    console.error('Streaming resolution error:', err);
    res.status(500).json({ error: err.message });
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
