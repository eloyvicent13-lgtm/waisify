async function test() {
  const videoId = 'aBSkvI0CkgU';
  const targetUrl = `https://pipedapi.tokhmi.xyz/streams/${videoId}`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
  
  console.log('Querying proxy:', proxyUrl);
  
  try {
    const res = await fetch(proxyUrl);
    console.log('Proxy Response status:', res.status);
    
    if (res.ok) {
      const data = await res.json();
      const audioStreams = data.audioStreams || [];
      console.log('  Audio streams found via proxy:', audioStreams.length);
      if (audioStreams.length > 0) {
        console.log('  ✅ SUCCESS! Resolved stream URL via proxy:');
        console.log('  Stream URL (truncated):', audioStreams[0].url.substring(0, 100));
      } else {
        console.log('  No audio streams found in response.');
      }
    } else {
      console.log('  Failed to get ok status from proxy.');
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
  }
}

test();
