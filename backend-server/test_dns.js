const dns = require('dns');

const domains = [
  'y2mate.is',
  'yt1s.com',
  'yt5s.com',
  '9xbuddy.xyz',
  'tuberip.com',
  'cobalt.tools',
  'api.vevioz.com',
  'y2mate.com'
];

function check(domain) {
  return new Promise((resolve) => {
    dns.resolve(domain, (err, addresses) => {
      if (err) {
        console.log(`❌ DNS lookup for ${domain} failed: ${err.code}`);
        resolve(false);
      } else {
        console.log(`✅ DNS lookup for ${domain} succeeded: ${addresses.join(', ')}`);
        resolve(true);
      }
    });
  });
}

async function run() {
  for (const d of domains) {
    await check(d);
  }
}

run();
