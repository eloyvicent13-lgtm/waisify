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
  const domain = 'cobalt.canine.tools';
  try {
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    
    const res = await getRequest(ip, domain, '/');
    console.log('Status:', res.status);
    
    // Print all <script> tags
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(res.body)) !== null) {
      count++;
      const tagHeader = match[0].substring(0, match[0].indexOf('>') + 1);
      console.log(`\nScript #${count} Header: ${tagHeader}`);
      const content = match[1].trim();
      console.log(`Content Snippet (first 400 chars):`, content.substring(0, 400));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
