const https = require('https');

async function resolveDoh(domain) {
  const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
  const data = await res.json();
  if (data.Answer && data.Answer.length > 0) {
    // Return all IPs
    return data.Answer.map(ans => ans.data);
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
  const videoId = 'aBSkvI0CkgU';
  const instances = [
    'api.piped.yt',
    'pipedapi.lunar.icu',
    'pipedapi.tokhmi.xyz',
    'pipedapi.chg.gg'
  ];
  
  for (const domain of instances) {
    console.log(`\nTesting Piped instance: ${domain} ...`);
    try {
      const ips = await resolveDoh(domain);
      const ip = ips[0];
      console.log(`  IP resolved: ${ip}`);
      
      const result = await getRequest(ip, domain, `/streams/${videoId}`);
      console.log(`  Response Status: ${result.status}`);
      
      if (result.status === 200 && result.body) {
        const audioStreams = result.body.audioStreams || [];
        console.log(`  Audio Streams: ${audioStreams.length}`);
        if (audioStreams.length > 0) {
          console.log('  ✅ SUCCESS! Resolved stream URL:', audioStreams[0].url ? 'YES' : 'NO');
          if (audioStreams[0].url) {
            console.log('  Stream URL (truncated):', audioStreams[0].url.substring(0, 120));
            return; // We found a working one!
          }
        }
      } else {
        console.log('  Error response:', typeof result.body === 'object' ? JSON.stringify(result.body).substring(0, 200) : result.body.substring(0, 200));
      }
    } catch (err) {
      console.log('  Failed on instance:', err.message);
    }
  }
}

test();
