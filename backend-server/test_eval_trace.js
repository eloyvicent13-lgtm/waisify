const { Innertube, Platform } = require('youtubei.js');
const vm = require('vm');

Platform.shim.eval = async (code) => {
  return vm.runInNewContext(code);
};

async function test() {
  try {
    const youtube = await Innertube.create();
    
    console.log('Testing client: YTMUSIC...');
    const info = await youtube.getInfo('LK6VPvHR-38', { client: 'YTMUSIC' });
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    
    if (format) {
      console.log('  Format found! itag:', format.itag);
      const url = await format.decipher(youtube.session.player);
      console.log('  Deciphered URL:', url);
    }
  } catch (err) {
    console.error('Full Error Trace:', err);
  }
}

test();
