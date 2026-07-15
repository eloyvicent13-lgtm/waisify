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
    
    const homepage = await getRequest(ip, domain, '/');
    console.log('Homepage status:', homepage.status);
    
    // Find all modulepreload links
    const linkRegex = /href="(\/_app\/immutable\/[^"]+\.js)"/gi;
    let match;
    const chunks = [];
    while ((match = linkRegex.exec(homepage.body)) !== null) {
      chunks.push(match[1]);
    }
    
    // Also add start/app entry files
    chunks.push('/_app/immutable/entry/start.3aExkw-p.js');
    chunks.push('/_app/immutable/entry/app.CIQNTbu1.js');
    
    const uniqueChunks = [...new Set(chunks)];
    console.log(`Found ${uniqueChunks.length} unique preloaded chunks to scan.`);
    
    for (const chunk of uniqueChunks) {
      console.log(`Scanning: ${chunk} ...`);
      const res = await getRequest(ip, domain, chunk);
      if (res.status === 200) {
        // Search for any URL that starts with http/https
        const urls = res.body.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b\/?[a-zA-Z0-9./_?=&-]*/g) || [];
        const filtered = urls.filter(u => !u.includes('svelte.dev') && !u.includes('github') && !u.includes('schema') && !u.includes('w3.org') && !u.includes('fonts'));
        if (filtered.length > 0) {
          console.log(`  ✅ Found URLs in ${chunk}:`);
          [...new Set(filtered)].forEach(u => console.log('    -', u));
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
