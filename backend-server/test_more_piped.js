const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const instances = [
  'https://pipedapi.hostux.net',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.ducks.party',
  'https://pipedapi.privacydev.net',
  'https://pipedapi.swg.rocks',
  'https://pipedapi.astart.su',
  'https://pipedapi.reallyawesomelink.co',
  'https://pipedapi.sync.bz',
  'https://piped-api.lont.space',
  'https://pipedapi.col1g.icu'
];

async function test() {
  const videoId = 'aBSkvI0CkgU';
  console.log('Testing wider list of Piped instances for video:', videoId);
  
  for (const inst of instances) {
    console.log(`Querying ${inst} ...`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      
      const res = await fetch(`${inst}/streams/${videoId}`, { signal: controller.signal });
      clearTimeout(timeout);
      
      console.log(`  Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const audio = data.audioStreams || [];
        console.log(`  Audio streams found: ${audio.length}`);
        if (audio.length > 0) {
          console.log('  ✅ SUCCESS! Direct Stream URL:', audio[0].url.substring(0, 80));
          // Don't exit early, let's find ALL working ones so we can build a highly robust list!
        }
      }
    } catch (e) {
      console.log('  Failed:', e.message);
    }
  }
}

test();
