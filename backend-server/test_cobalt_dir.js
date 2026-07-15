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
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
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
  const domain = 'cobalt.directory';
  try {
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    
    // Fetch main page HTML
    const res = await getRequest(ip, domain, '/');
    console.log('Status:', res.status);
    console.log('HTML snippet (first 1000 chars):', res.body.substring(0, 1000));
    
    // Look for domains or links matching cobalt patterns in HTML
    const matches = res.body.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g) || [];
    console.log('Total URLs found in page:', matches.length);
    const unique = [...new Set(matches)];
    console.log('Unique URLs snippet:', unique.slice(0, 20));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
