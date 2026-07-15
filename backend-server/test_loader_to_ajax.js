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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    servername: domain,
    rejectUnauthorized: false
  };
  
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let body = '';
      response.on('data', (chunk) => body += chunk);
      response.on('end', () => {
        resolve(body);
      });
    });
    
    request.on('error', reject);
    request.end();
  });
}

async function test() {
  const domain = 'loader.to';
  const videoId = 'aBSkvI0CkgU';
  try {
    const ip = await resolveDoh(domain);
    const html = await getRequest(ip, domain, `/api/card/?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`);
    
    // Scan all <script> tags
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      const content = match[1].trim();
      if (content.includes('fetch') || content.includes('ajax') || content.includes('http') || content.includes('XMLHttpRequest') || content.includes('url') || content.includes('id')) {
        count++;
        console.log(`\n--- Script Block #${count} ---`);
        const lines = content.split('\\n'); lines.forEach((l, i) => { if (l.includes('fetch') || l.includes('get(') || l.includes('api') || l.includes('button')) console.log((i+1) + ': ' + l.trim()); });
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
