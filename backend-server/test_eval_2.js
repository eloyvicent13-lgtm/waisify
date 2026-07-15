const { Innertube, Platform } = require('youtubei.js');

Platform.shim.eval = async (code) => {
  return new Function(code)();
};

async function test() {
  try {
    const youtube = await Innertube.create();
    const info = await youtube.getInfo('LK6VPvHR-38', { client: 'ANDROID' });
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    
    if (format) {
      console.log('itag:', format.itag);
      console.log('url:', format.url);
      console.log('signature_cipher:', format.signature_cipher);
      console.log('cipher:', format.cipher);
      
      // Let's print the entire raw format data structure to see if it's there under another name
      console.log('raw keys:', Object.keys(format.raw || {}));
      if (format.raw) {
        console.log('raw url:', format.raw.url);
        console.log('raw signatureCipher:', format.raw.signatureCipher);
        console.log('raw cipher:', format.raw.cipher);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

test();
