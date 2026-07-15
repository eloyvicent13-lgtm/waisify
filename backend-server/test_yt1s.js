async function test() {
  const videoId = 'aBSkvI0CkgU';
  console.log('Testing YT1S API for video:', videoId);
  
  try {
    // 1. Search video info to get token
    const searchRes = await fetch('https://yt1s.com/api/ajaxSearch/index', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: `q=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}&vt=home`
    });
    
    const searchData = await searchRes.json();
    console.log('Search Status:', searchData.status);
    
    if (searchData.status !== 'ok') {
      throw new Error('Search failed: ' + JSON.stringify(searchData));
    }
    
    // Extract mp3 format key
    const mp3Links = searchData.links?.mp3 || {};
    let firstKey = null;
    for (const key of Object.keys(mp3Links)) {
      firstKey = mp3Links[key].k;
      break;
    }
    
    if (!firstKey) {
      // Fallback to any audio key
      const audioLinks = searchData.links?.audio || {};
      for (const key of Object.keys(audioLinks)) {
        firstKey = audioLinks[key].k;
        break;
      }
    }
    
    if (!firstKey) throw new Error('No audio format keys found');
    console.log('Found format key:', firstKey);
    
    // 2. Convert to get download link
    const convertRes = await fetch('https://yt1s.com/api/ajaxConvert/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: `vid=${encodeURIComponent(videoId)}&k=${encodeURIComponent(firstKey)}`
    });
    
    const convertData = await convertRes.json();
    console.log('Convert Status:', convertData.status);
    console.log('Download URL (truncated):', convertData.dlink ? convertData.dlink.substring(0, 100) : 'NONE');
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
