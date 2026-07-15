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
  const chunks = [
    '/_app/immutable/entry/app.CIQNTbu1.js',
    '/_app/immutable/chunks/BxetLeNL.js',
    '/_app/immutable/chunks/DuwI8YP4.js'
  ];
  
  try {
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    
    for (const chunk of chunks) {
      console.log(`\nFetching chunk: ${chunk} ...`);
      const res = await getRequest(ip, domain, chunk);
      console.log('  Status:', res.status);
      
      // Search for fetch requests in the JS code
      const fetchMatches = res.body.match(/fetch\([^)]+\)/g) || [];
      console.log('  Fetch calls found:', fetchMatches.length);
      fetchMatches.slice(0, 10).forEach(m => console.log('    -', m));
      
      // Search for strings containing slash/paths (potential api endpoints)
      const pathMatches = res.body.match(/\/api\/[a-zA-Z0-9_/]*/g) || [];
      console.log('  /api/ paths found:', pathMatches.length);
      pathMatches.slice(0, 10).forEach(m => console.log('    -', m));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
