const { Innertube, Platform } = require('youtubei.js');
const vm = require('vm');

// Use Node vm module to evaluate data.output!
Platform.shim.eval = async (data, env) => {
  return vm.runInNewContext(data.output);
};

async function test() {
  const clients = ['YTMUSIC', 'TV', 'ANDROID'];
  
  try {
    const youtube = await Innertube.create();
    
    for (const client of clients) {
      console.log(`\nTesting client: ${client}...`);
      try {
        const info = await youtube.getInfo('LK6VPvHR-38', { client: client });
        const format = info.chooseFormat({ type: 'audio', quality: 'best' });
        
        if (format) {
          console.log('  Format found! itag:', format.itag);
          console.log('  URL before decipher:', format.url ? 'YES' : 'NO');
          
          const url = await format.decipher(youtube.session.player);
          console.log('  Deciphered URL (truncated):', url ? url.substring(0, 100) : 'EMPTY');
          if (url) {
            console.log(`  ✅ SUCCESS! Decrypted URL using client: ${client}`);
          }
        } else {
          console.log('  No audio format found.');
        }
      } catch (err) {
        console.error(`  Error for client ${client}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
