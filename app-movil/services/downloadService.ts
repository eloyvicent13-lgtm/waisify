import { 
  documentDirectory, 
  makeDirectoryAsync, 
  getInfoAsync, 
  readAsStringAsync, 
  writeAsStringAsync, 
  createDownloadResumable, 
  deleteAsync 
} from 'expo-file-system/legacy';
import axios from 'axios';
import { Track } from './api';

const API_BASE = 'http://149.202.84.78:8150';
const DOWNLOADS_DIR = (documentDirectory || '') + 'downloads/';
const METADATA_FILE = DOWNLOADS_DIR + 'metadata.json';

interface DownloadedTrack extends Track {
  localUrl: string;
}

// Ensure the downloads directory exists
async function ensureDirExists() {
  const dirInfo = await getInfoAsync(DOWNLOADS_DIR);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
  }
}

// Get all downloaded tracks
export async function getDownloadedTracks(): Promise<DownloadedTrack[]> {
  await ensureDirExists();
  const fileInfo = await getInfoAsync(METADATA_FILE);
  if (!fileInfo.exists) {
    return [];
  }
  try {
    const content = await readAsStringAsync(METADATA_FILE);
    return JSON.parse(content);
  } catch (e) {
    console.error('Error reading downloads metadata:', e);
    return [];
  }
}

// Check if a track is downloaded
export async function isDownloaded(trackId: string): Promise<boolean> {
  const tracks = await getDownloadedTracks();
  return tracks.some((t) => t.id === trackId);
}

// Get the local file path for a track ID
export function getLocalTrackPath(trackId: string): string {
  const safeId = trackId.replace(/[^a-zA-Z0-9]/g, '_');
  return DOWNLOADS_DIR + safeId + '.mp3';
}

// Download a track
export async function downloadTrack(track: Track, onProgress?: (progress: number) => void): Promise<DownloadedTrack> {
  await ensureDirExists();
  
  let youtubeId = track.youtubeId;
  if (!youtubeId) {
    const res = await axios.get(`${API_BASE}/api/resolve?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`);
    youtubeId = res.data.youtubeId;
    track.youtubeId = youtubeId;
  }

  if (!youtubeId) {
    throw new Error('Could not resolve track to download');
  }

  // Proxied through our backend (not a raw googlevideo URL) so it isn't
  // IP-locked to whoever resolved it.
  const streamUrl = `${API_BASE}/api/audio?youtubeId=${youtubeId}`;

  const localUrl = getLocalTrackPath(track.id);

  const downloadResumable = createDownloadResumable(
    streamUrl,
    localUrl,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      if (onProgress) {
        onProgress(isNaN(progress) ? 0 : progress);
      }
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('Download failed');
  }

  const downloaded: DownloadedTrack = {
    ...track,
    localUrl: result.uri,
  };

  const currentDownloads = await getDownloadedTracks();
  const filtered = currentDownloads.filter((t) => t.id !== track.id);
  filtered.push(downloaded);
  await writeAsStringAsync(METADATA_FILE, JSON.stringify(filtered));

  return downloaded;
}

// Delete a downloaded track
export async function deleteDownloadedTrack(trackId: string) {
  await ensureDirExists();
  const localUrl = getLocalTrackPath(trackId);
  
  const fileInfo = await getInfoAsync(localUrl);
  if (fileInfo.exists) {
    await deleteAsync(localUrl, { idempotent: true });
  }

  const currentDownloads = await getDownloadedTracks();
  const filtered = currentDownloads.filter((t) => t.id !== trackId);
  await writeAsStringAsync(METADATA_FILE, JSON.stringify(filtered));
}
