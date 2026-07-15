const https = require('https');

async function resolveDoh(domain) {
  const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
  const data = await res.json();
  if (data.Answer && data.Answer.length > 0) {
    return data.Answer[0].data;
  }
  throw new Error('DNS lookup failed for ' + domain);
}

function cobaltPost(ip, domain, path, postData) {
  const options = {
    hostname: ip,
    port: 443,
    path: path,
    method: 'POST',
    headers: {
      'Host': domain,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Length': Buffer.byteLength(postData)
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

const backends = [
  'cobalt-api.meowing.de',
  'cobalt-api.clxxped.lol'
];

async function test() {
  const videoId = 'aBSkvI0CkgU';
  
  const postData = JSON.stringify({
    url: 'https://www.youtube.com/watch?v=' + videoId,
    videoQuality: 'max',
    audioFormat: 'mp3',
    downloadMode: 'audio',
    formatted: false
  });
  
  for (const domain of backends) {
    console.log(`\nTesting Cobalt backend: ${domain} ...`);
    try {
      const ip = await resolveDoh(domain);
      console.log(`  IP resolved: ${ip}`);
      
      const result = await cobaltPost(ip, domain, '/', postData);
      console.log(`  Status: ${result.status}`);
      console.log(`  Body:`, typeof result.body === 'object' ? JSON.stringify(result.body) : result.body);
      
      if (result.status === 200 && result.body && (result.body.status === 'redirect' || result.body.status === 'stream' || result.body.status === 'tunnel') && result.body.url) {
        console.log(`  ✅ SUCCESS! Resolved stream URL:`, result.body.url);
        return;
      }
    } catch (err) {
      console.error(`  Error:`, err.message);
    }
  }
}

test();
