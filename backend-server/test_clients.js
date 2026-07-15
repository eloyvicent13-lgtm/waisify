const { Innertube } = require('youtubei.js');

async function test() {
  const clients = ['ANDROID', 'YTMUSIC', 'TVHTML5', 'TV', 'IOS', 'WEB', 'MWEB', 'MUSIC'];
  
  try {
    const youtube = await Innertube.create();
    
    for (const client of clients) {
      console.log(`\nTesting client: ${client}...`);
      try {
        const info = await youtube.getInfo('LK6VPvHR-38', { client: client });
        const format = info.chooseFormat({ type: 'audio', quality: 'best' });
        
        if (format) {
          console.log(`  Format found! itag: ${format.itag}`);
          // Access format.url (which might be automatically deciphered by chooseFormat if player is loaded)
          console.log(`  Direct URL: ${format.url ? 'YES' : 'NO'}`);
          
          if (!format.url) {
            // Try deciphering manually
            try {
              const url = await format.decipher(youtube.session.player);
              console.log(`  Deciphered URL: ${url ? 'YES' : 'NO'}`);
            } catch (decErr) {
              console.log(`  Decipher failed: ${decErr.message}`);
            }
          }
        } else {
          console.log('  No audio format found.');
        }
      } catch (err) {
        console.error(`  Error for client ${client}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

test();
