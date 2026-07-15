const https = require('https');

async function resolveDoh(domain) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
    const data = await res.json();
    if (data.Answer && data.Answer.length > 0) {
      return data.Answer[0].data;
    }
  } catch (e) {}
  return null;
}

function getRequest(ip, domain, path) {
  const options = {
    hostname: ip || domain,
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
  
  return new Promise((resolve) => {
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
    
    request.on('error', () => resolve({ status: 500, body: '' }));
    request.end();
  });
}

const instances = [
  'cobalt.meowing.de',
  'cobalt.clxxped.lol',
  'qwkuns.me',
  'cobalt.eversiege.network',
  'cobalt.liubquanti.click',
  'cobalt.xenon.zone',
  'cobalt.cjs.nz'
];

async function scanInstance(domain) {
  console.log(`\n--- Scanning instance: ${domain} ---`);
  const ip = await resolveDoh(domain);
  if (!ip) {
    console.log(`  Failed to resolve IP for ${domain}`);
    return null;
  }
  
  const homepage = await getRequest(ip, domain, '/');
  if (homepage.status !== 200) {
    console.log(`  Homepage returned status ${homepage.status}`);
    return null;
  }
  
  // Find all modulepreload links or scripts
  const linkRegex = /href="(\/_app\/immutable\/[^"]+\.js)"/gi;
  let match;
  const chunks = [];
  while ((match = linkRegex.exec(homepage.body)) !== null) {
    chunks.push(match[1]);
  }
  
  // Also look for scripts
  const scriptRegex = /src="(\/_app\/immutable\/[^"]+\.js)"/gi;
  while ((match = scriptRegex.exec(homepage.body)) !== null) {
    chunks.push(match[1]);
  }
  
  const uniqueChunks = [...new Set(chunks)];
  console.log(`  Found ${uniqueChunks.length} chunks to scan.`);
  
  const backendsFound = [];
  // Scan all chunks sequentially
  for (const chunk of uniqueChunks) {
    const res = await getRequest(ip, domain, chunk);
    if (res.status === 200) {
      const urls = res.body.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b\/?[a-zA-Z0-9./_?=&-]*/g) || [];
      const filtered = urls.filter(u => {
        const lower = u.toLowerCase();
        return !lower.includes('svelte.dev') && 
               !lower.includes('github') && 
               !lower.includes('schema') && 
               !lower.includes('w3.org') && 
               !lower.includes('fonts') && 
               !lower.includes('cloudflare') &&
               !lower.includes('turnstile') &&
               !lower.includes(domain); // Exclude the frontend domain itself
      });
      
      if (filtered.length > 0) {
        filtered.forEach(u => backendsFound.push(u));
      }
    }
  }
  
  const uniqueBackends = [...new Set(backendsFound)];
  console.log(`  Results for ${domain}:`, uniqueBackends);
  return uniqueBackends;
}

async function run() {
  for (const domain of instances) {
    await scanInstance(domain);
  }
}

run();
