const https = require('https');

async function resolveDoh(domain) {
  const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
  const data = await res.json();
  if (data.Answer && data.Answer.length > 0) {
    return data.Answer[0].data;
  }
  throw new Error('DNS lookup failed for ' + domain);
}

function postRequest(ip, domain, path, postData) {
  const options = {
    hostname: ip,
    port: 443,
    path: path,
    method: 'POST',
    headers: {
      'Host': domain,
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Length': Buffer.byteLength(postData),
      'Origin': `https://${domain}`,
      'Referer': `https://${domain}/`
    },
    servername: domain,
    rejectUnauthorized: false
  };
  
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let body = '';
      response.on('data', (chunk) => body += chunk);
      response.on('end', () => {
        try {
          resolve({
            status: response.statusCode,
            body: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: response.statusCode,
            body: body
          });
        }
      });
    });
    
    request.on('error', reject);
    request.write(postData);
    request.end();
  });
}

async function test() {
  const domain = 'yt1s.com';
  const videoId = 'aBSkvI0CkgU';
  
  try {
    console.log('Resolving IP for:', domain);
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    
    // 1. Search video details
    const searchBody = `q=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}&vt=home`;
    console.log('Searching video on YT1S...');
    const searchResult = await postRequest(ip, domain, '/api/ajaxSearch/index', searchBody);
    console.log('Search Result Status:', searchResult.status, 'Body status:', searchResult.body?.status);
    
    if (searchResult.body?.status !== 'ok') {
      throw new Error('Search failed: ' + JSON.stringify(searchResult.body));
    }
    
    // Find first mp3 format key
    const mp3Links = searchResult.body.links?.mp3 || {};
    let firstKey = null;
    for (const key of Object.keys(mp3Links)) {
      firstKey = mp3Links[key].k;
      break;
    }
    
    if (!firstKey) {
      const audioLinks = searchResult.body.links?.audio || {};
      for (const key of Object.keys(audioLinks)) {
        firstKey = audioLinks[key].k;
        break;
      }
    }
    
    if (!firstKey) throw new Error('No audio format keys found');
    console.log('Found format key:', firstKey);
    
    // 2. Convert and get download URL
    const convertBody = `vid=${encodeURIComponent(videoId)}&k=${encodeURIComponent(firstKey)}`;
    console.log('Converting on YT1S...');
    const convertResult = await postRequest(ip, domain, '/api/ajaxConvert/convert', convertBody);
    console.log('Convert Result Status:', convertResult.status, 'Body status:', convertResult.body?.status);
    console.log('✅ Direct Audio Link:', convertResult.body?.dlink || 'NONE');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

test();
