const https = require('https');

async function resolveDoh(domain) {
  const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
  const data = await res.json();
  if (data.Answer && data.Answer.length > 0) {
    return data.Answer[0].data;
  }
  throw new Error('DNS lookup failed for ' + domain);
}

async function test() {
  const domain = 'co.wuk.sh';
  const videoId = 'aBSkvI0CkgU';
  
  try {
    console.log('Resolving IP for:', domain);
    const ip = await resolveDoh(domain);
    console.log('IP resolved:', ip);
    
    console.log('Querying Cobalt API on:', ip);
    
    // Perform POST request to Cobalt API by IP, setting the Host header
    const postData = JSON.stringify({
      url: 'https://www.youtube.com/watch?v=' + videoId,
      isAudioOnly: true,
      aFormat: 'mp3'
    });
    
    const options = {
      hostname: ip,
      port: 443,
      path: '/api/json',
      method: 'POST',
      headers: {
        'Host': domain,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Length': Buffer.byteLength(postData)
      },
      // Cloudflare requires SNI (Server Name Indication), so we pass the original domain name
      servername: domain,
      rejectUnauthorized: false // Ignore certificate mismatch if any
    };
    
    const req = new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let body = '';
        response.on('data', (chunk) => body += chunk);
        response.on('end', () => {
          try {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: JSON.parse(body)
            });
          } catch (e) {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: body
            });
          }
        });
      });
      
      request.on('error', reject);
      request.write(postData);
      request.end();
    });
    
    const result = await req;
    console.log('Response Status:', result.status);
    console.log('Response Body:', result.body);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
