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

async function test() {
  const domain = 'cobalt.canine.tools';
  const videoId = 'aBSkvI0CkgU';
  const postData = JSON.stringify({
    url: 'https://www.youtube.com/watch?v=' + videoId,
    videoQuality: 'max',
    audioFormat: 'mp3',
    downloadMode: 'audio',
    formatted: false
  });
  
  const paths = ['/api', '/api/', '/api/json', '/'];
  try {
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    
    for (const path of paths) {
      console.log(`\nTesting POST ${path} on ${domain} ...`);
      const result = await cobaltPost(ip, domain, path, postData);
      console.log(`  Status: ${result.status}`);
      console.log(`  Body:`, typeof result.body === 'object' ? JSON.stringify(result.body).substring(0, 300) : result.body.substring(0, 300));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
