async function test() {
  const videoId = 'aBSkvI0CkgU';
  console.log('Fetching active Invidious instances...');
  
  try {
    const listRes = await fetch('https://api.invidious.io/instances.json');
    const instances = await listRes.json();
    
    // Get all HTTPS instances
    const activeInstances = instances
      .filter(inst => inst[1].type === 'https')
      .map(inst => inst[1].uri);
    
    console.log(`Found ${activeInstances.length} active Invidious instances.`);
    
    // Try the first 15 instances to resolve the stream
    for (let i = 0; i < Math.min(15, activeInstances.length); i++) {
      const uri = activeInstances[i];
      console.log(`Testing instance ${i + 1}/${Math.min(15, activeInstances.length)}: ${uri} ...`);
      try {
        const videoRes = await fetch(`${uri}/api/v1/videos/${videoId}`);
        if (!videoRes.ok) throw new Error('Failed to fetch video info: ' + videoRes.status);
        const data = await videoRes.json();
        
        const audioFormats = (data.adaptiveFormats || []).filter(f => f.type.startsWith('audio/'));
        console.log(`  Adaptive Formats: ${(data.adaptiveFormats || []).length}, Audio Formats: ${audioFormats.length}`);
        
        if (audioFormats.length > 0) {
          // Find the best audio format
          const best = audioFormats[0];
          console.log('  ✅ SUCCESS! Resolved audio stream URL:', best.url ? 'YES' : 'NO');
          if (best.url) {
            console.log('  Stream URL (truncated):', best.url.substring(0, 120));
            return;
          }
        }
      } catch (err) {
        console.log('  Failed on instance:', err.message);
      }
    }
  } catch (err) {
    console.error('Invidious lookup error:', err);
  }
}

test();
