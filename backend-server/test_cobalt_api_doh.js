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
      'Accept': 'application/json',
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
  const domain = 'instances.cobalt.best';
  try {
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    const res = await getRequest(ip, domain, '/api/instances');
    console.log('Status:', res.status);
    if (res.status === 200 && Array.isArray(res.body)) {
      console.log('Found instances:', res.body.length);
      const active = res.body.filter(inst => inst.frontend === true || inst.api === true);
      console.log('Active instances count:', active.length);
      console.log('First 10 active instances:', active.slice(0, 10).map(i => i.url));
    } else {
      console.log('Response body:', res.body);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
