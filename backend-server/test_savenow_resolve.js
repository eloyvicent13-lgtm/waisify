const https = require('https');

async function resolveDoh(domain) {
  const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
  const data = await res.json();
  if (data.Answer && data.Answer.length > 0) {
    return data.Answer[0].data;
  }
  throw new Error('DNS lookup failed for ' + domain);
}

function getRequest(ip, domain, path) {
  const options = {
    hostname: ip,
    port: 443,
    path: path,
    method: 'GET',
    headers: {
      'Host': domain,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
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
    request.end();
  });
}

async function test() {
  const domain = 'p.savenow.to';
  const videoId = 'aBSkvI0CkgU';
  try {
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    
    // 1. Trigger download
    const downloadPath = `/api/v2/download?button=1&format=mp3&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`;
    console.log('Triggering download:', downloadPath);
    const startRes = await getRequest(ip, domain, downloadPath);
    console.log('Start Status:', startRes.status);
    console.log('Start Response:', startRes.body);
    
    if (startRes.body && startRes.body.id) {
      const id = startRes.body.id;
      // 2. Poll progress
      console.log('Polling progress for ID:', id);
      const poll = async () => {
        const progRes = await getRequest(ip, domain, `/api/progress?id=${id}`);
        console.log('  Progress Response:', progRes.body);
        if (progRes.body && progRes.body.success === 1 && progRes.body.download_url) {
          console.log('  ✅ SUCCESS! Resolved Stream URL:', progRes.body.download_url);
          return;
        }
        if (progRes.body && progRes.body.success === 1 && progRes.body.progress === 1000) {
          console.log('  Done, but download_url is missing.');
          return;
        }
        setTimeout(poll, 1500);
      };
      await poll();
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
