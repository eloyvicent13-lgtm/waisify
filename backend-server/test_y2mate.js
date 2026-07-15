async function test() {
  const videoId = 'aBSkvI0CkgU';
  console.log('Testing y2mate AJAX API for video:', videoId);
  
  try {
    // 1. Analyze video details
    const analyzeUrl = 'https://www.y2mate.com/mates/analyzeV2/ajax';
    const analyzeRes = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: `k_query=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}&k_page=home&hl=en&q_auto=1`
    });
    
    if (!analyzeRes.ok) throw new Error('Analyze request failed: ' + analyzeRes.statusText);
    const analyzeData = await analyzeRes.json();
    
    if (analyzeData.status !== 'ok') {
      throw new Error('Analyze returned non-ok status: ' + JSON.stringify(analyzeData));
    }
    
    console.log('  Video Title:', analyzeData.title);
    
    // Find the best audio format key (usually in links.mp3 or links.audio)
    const mp3Links = analyzeData.links?.mp3 || {};
    const audioLinks = analyzeData.links?.audio || {};
    
    let bestAudio = null;
    // Look for mp3 first (prefer 128kbps or similar)
    for (const key of Object.keys(mp3Links)) {
      const f = mp3Links[key];
      if (f.f === 'mp3') {
        bestAudio = f;
        break;
      }
    }
    
    // Fallback to audio links (m4a, webm)
    if (!bestAudio) {
      for (const key of Object.keys(audioLinks)) {
        const f = audioLinks[key];
        if (f.f === 'm4a' || f.f === 'webm' || f.f === 'mp3') {
          bestAudio = f;
          break;
        }
      }
    }
    
    if (!bestAudio) {
      throw new Error('No audio formats found in links: ' + JSON.stringify(analyzeData.links));
    }
    
    console.log('  Found audio format:', bestAudio.q, 'key:', bestAudio.k);
    
    // 2. Convert and get download URL
    const convertUrl = 'https://www.y2mate.com/mates/convertV2/ajax';
    const convertRes = await fetch(convertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: `vid=${encodeURIComponent(videoId)}&k=${encodeURIComponent(bestAudio.k)}`
    });
    
    if (!convertRes.ok) throw new Error('Convert request failed: ' + convertRes.statusText);
    const convertData = await convertRes.json();
    
    if (convertData.status !== 'ok') {
      throw new Error('Convert returned non-ok status: ' + JSON.stringify(convertData));
    }
    
    console.log('  ✅ Success! direct audio URL resolved:', convertData.dlink);
  } catch (err) {
    console.error('  ❌ Error:', err.message);
  }
}

test();
