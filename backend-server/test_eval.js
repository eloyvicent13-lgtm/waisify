const { Innertube, Platform } = require('youtubei.js');

// Provide custom evaluator
Platform.shim.eval = async (code) => {
  return new Function(code)();
};

async function test() {
  console.log('Testing with Platform.shim.eval configured...');
  try {
    const youtube = await Innertube.create();
    
    // We test with ANDROID client since it returns encrypted formats that need deciphering but is not blocked by YouTube
    console.log('Testing ANDROID client...');
    const info = await youtube.getInfo('LK6VPvHR-38', { client: 'ANDROID' });
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    
    if (format) {
      console.log('Format found! itag:', format.itag);
      console.log('URL before decipher:', format.url);
      
      const url = await format.decipher(youtube.session.player);
      console.log('Deciphered URL (truncated):', url ? url.substring(0, 120) : 'EMPTY');
      console.log('✅ Success! We got a deciphered URL using ANDROID client!');
    } else {
      console.log('No audio format found.');
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}

test();
