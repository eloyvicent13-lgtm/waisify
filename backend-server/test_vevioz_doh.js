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
        resolve({
          status: response.statusCode,
          body: body
        });
      });
    });
    
    request.on('error', reject);
    request.end();
  });
}

async function test() {
  const domain = 'api.vevioz.com';
  const videoId = 'aBSkvI0CkgU';
  try {
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    
    const res = await getRequest(ip, domain, `/api/button/mp3/${videoId}`);
    console.log('Status:', res.status);
    console.log('HTML Length:', res.body.length);
    
    // Look for href links in HTML
    const matches = res.body.match(/href="([^"]+)"/gi) || [];
    console.log('Href matches found:', matches.length);
    matches.forEach(m => console.log('  -', m));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
