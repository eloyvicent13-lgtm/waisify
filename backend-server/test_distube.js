const ytdl = require('@distube/ytdl-core');

async function test() {
  const videoId = 'aBSkvI0CkgU';
  console.log('Testing @distube/ytdl-core for video:', videoId);
  
  try {
    const info = await ytdl.getInfo(videoId);
    // Find the best audio format
    const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
    
    if (format && format.url) {
      console.log('  ✅ SUCCESS! Resolved direct stream URL using @distube/ytdl-core!');
      console.log('  Stream URL (truncated):', format.url.substring(0, 120));
    } else {
      console.log('  No audio formats found.');
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
  }
}

test();
