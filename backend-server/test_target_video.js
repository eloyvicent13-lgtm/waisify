const { Innertube, Platform } = require('youtubei.js');

Platform.shim.eval = async (data, env) => {
  return new Function(data.output)();
};

async function test() {
  const videoId = 'aBSkvI0CkgU';
  const clients = ['ANDROID', 'YTMUSIC', 'TV', 'WEB'];
  
  try {
    const youtube = await Innertube.create();
    
    for (const client of clients) {
      console.log(`\nTesting client: ${client}...`);
      try {
        const info = await youtube.getInfo(videoId, { client: client });
        console.log('  Has streaming data:', !!info.streaming_data);
        if (info.streaming_data) {
          const formats = info.streaming_data.adaptive_formats || [];
          console.log('  Formats count:', formats.length);
          const audio = formats.filter(f => f.mime_type.startsWith('audio/'));
          console.log('  Audio formats:', audio.length);
          if (audio.length > 0) {
            const format = info.chooseFormat({ type: 'audio', quality: 'best' });
            console.log('  Selected format itag:', format ? format.itag : 'NONE');
            console.log('  Selected format has url:', format && format.url ? 'YES' : 'NO');
            console.log('  Selected format has signature_cipher:', format && format.signature_cipher ? 'YES' : 'NO');
            console.log('  Selected format has cipher:', format && format.cipher ? 'YES' : 'NO');
            
            if (format) {
              try {
                const url = await format.decipher(youtube.session.player);
                console.log('  Decipher URL worked! URL (truncated):', url ? url.substring(0, 100) : 'EMPTY');
              } catch (decErr) {
                console.log('  Decipher error:', decErr.message);
              }
            }
          }
        }
      } catch (err) {
        console.log('  Error:', err.message);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

test();
