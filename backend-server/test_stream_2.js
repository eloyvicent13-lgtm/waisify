const { Innertube } = require('youtubei.js');

async function test() {
  try {
    const youtube = await Innertube.create();
    const info = await youtube.getInfo('LK6VPvHR-38');
    
    if (info.streaming_data) {
      const audioFormats = (info.streaming_data.adaptive_formats || []).filter(f => f.mime_type.startsWith('audio/'));
      if (audioFormats.length > 0) {
        console.log('First Audio Format Keys:', Object.keys(audioFormats[0]));
        console.log('First Audio Format Info:', JSON.stringify(audioFormats[0], null, 2));
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
