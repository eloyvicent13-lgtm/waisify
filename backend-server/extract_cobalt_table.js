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
    
    const res = await getRequest(ip, domain, '/');
    console.log('Status:', res.status);
    
    // Look for all API URLs in the HTML (they usually have a specific pattern, or we can look for tables)
    // Find all links containing 'api' or look for table rows
    const lines = res.body.split('\n');
    console.log('Total HTML lines:', lines.length);
    
    // Match any URLs that look like Cobalt APIs (often subdomain 'api' or specific paths)
    const urlPattern = /https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b\/?[a-zA-Z0-9./_?=&-]*/g;
    const urls = res.body.match(urlPattern) || [];
    const uniqueUrls = [...new Set(urls)];
    
    console.log('All unique URLs on page:');
    uniqueUrls.forEach((url, idx) => {
      console.log(`${idx + 1}: ${url}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
