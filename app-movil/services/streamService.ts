import axios from 'axios';

const PIPED_INSTANCES = [
  'https://pipedapi.lunar.icu',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.ox.0y.at',
  'https://pipedapi.kavin.rocks'
];

export async function resolveStreamUrl(youtubeId: string): Promise<string> {
  // 1. Try public Piped instances directly from the device (unblocked by YouTube bot checks for mobile IPs)
  for (const inst of PIPED_INSTANCES) {
    try {
      console.log(`[StreamService] Trying Piped instance: ${inst}`);
      const response = await axios.get(`${inst}/streams/${youtubeId}`, { timeout: 3500 });
      if (response.data && response.data.audioStreams && response.data.audioStreams.length > 0) {
        const streamUrl = response.data.audioStreams[0].url;
        if (streamUrl) {
          console.log(`[StreamService] Successfully resolved via Piped instance: ${inst}`);
          return streamUrl;
        }
      }
    } catch (err: any) {
      console.warn(`[StreamService] Piped instance ${inst} failed:`, err.message);
    }
  }

  // 2. Fallback: Request from backend
  try {
    console.log('[StreamService] Falling back to backend server stream resolution...');
    const streamRes = await axios.get(`http://149.202.84.78:8150/api/stream?youtubeId=${youtubeId}`, { timeout: 35000 });
    return streamRes.data.streamUrl || '';
  } catch (err: any) {
    console.error('[StreamService] Backend stream resolution failed:', err.message);
  }

  return '';
}
