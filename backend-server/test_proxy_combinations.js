const proxies = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://proxy.cors.sh/'
];

const instances = [
  'https://pipedapi.lunar.icu',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.ox.0y.at',
  'https://pipedapi.kavin.rocks'
];

async function test() {
  const videoId = 'aBSkvI0CkgU';
  
  for (const proxy of proxies) {
    for (const inst of instances) {
      const targetUrl = `${inst}/streams/${videoId}`;
      const url = `${proxy}${encodeURIComponent(targetUrl)}`;
      console.log(`Testing combination: Proxy: ${proxy} + Inst: ${inst} ...`);
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        
        console.log('  Status:', res.status);
        if (res.ok) {
          const data = await res.json();
          const audioStreams = data.audioStreams || [];
          console.log(`  ✅ SUCCESS! Audio streams: ${audioStreams.length}`);
          if (audioStreams.length > 0) {
            console.log('  Stream URL:', audioStreams[0].url.substring(0, 100));
            return;
          }
        }
      } catch (err) {
        console.log('  Failed:', err.message);
      }
    }
  }
}

test();
