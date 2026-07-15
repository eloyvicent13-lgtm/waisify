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
  try {
    const ip = await resolveDoh(domain);
    const code = await getRequest(ip, domain, '/js/loader/domain-fallback.js');
    console.log(code.substring(0, 1500));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
