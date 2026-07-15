async function test() {
  const videoId = 'aBSkvI0CkgU';
  
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.yt',
    'https://pipedapi.lunar.icu',
    'https://pipedapi.chg.gg',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.ox.0y.at',
    'https://pipedapi.col1g.icu'
  ];
  
  console.log('Testing Piped API instances for video:', videoId);
  
  for (const inst of instances) {
    console.log(`Testing instance: ${inst} ...`);
    try {
      const res = await fetch(`${inst}/streams/${videoId}`);
      if (!res.ok) throw new Error('Status code: ' + res.status);
      const data = await res.json();
      
      const audioStreams = data.audioStreams || [];
      console.log(`  Audio streams found: ${audioStreams.length}`);
      
      if (audioStreams.length > 0) {
        // Find best audio stream
        const best = audioStreams[0];
        console.log('  ✅ SUCCESS! Resolved stream URL using Piped!');
        console.log('  Stream URL (truncated):', best.url ? best.url.substring(0, 120) : 'NONE');
        return;
      }
    } catch (err) {
      console.log('  Failed on instance:', err.message);
    }
  }
}

test();
