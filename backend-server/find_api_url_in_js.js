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
    '/_app/immutable/chunks/DuwI8YP4.js',
    '/_app/immutable/entry/app.CIQNTbu1.js',
    '/_app/immutable/chunks/DM2sQlHp.js',
    '/_app/immutable/chunks/BxetLeNL.js'
  ];
  
  try {
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    
    for (const chunk of chunks) {
      console.log(`\nFetching chunk: ${chunk} ...`);
      const res = await getRequest(ip, domain, chunk);
      if (res.status === 200) {
        const urls = res.body.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b\/?[a-zA-Z0-9./_?=&-]*/g) || [];
        const unique = [...new Set(urls)].filter(u => !u.includes('github') && !u.includes('schema') && !u.includes('fonts'));
        console.log(`  Found ${unique.length} potential URLs:`);
        unique.forEach(u => console.log('    -', u));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
