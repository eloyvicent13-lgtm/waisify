const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

async function test() {
  const videoId = 'aBSkvI0CkgU';
  const instances = [
    'https://pipedapi.lunar.icu',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.kavin.rocks'
  ];
  
  console.log('Testing Piped APIs with IPv4-first DNS order...');
  
  for (const inst of instances) {
    console.log(`Querying ${inst} ...`);
    try {
      const res = await fetch(`${inst}/streams/${videoId}`);
      console.log(`  Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const audio = data.audioStreams || [];
        console.log(`  Audio streams found: ${audio.length}`);
        if (audio.length > 0) {
          console.log('  ✅ SUCCESS! Direct Stream URL:', audio[0].url.substring(0, 80));
          return;
        }
      }
    } catch (e) {
      console.log('  Failed:', e.message);
    }
  }
}

test();
