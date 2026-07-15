const { Innertube } = require('youtubei.js');

async function test() {
  try {
    const youtube = await Innertube.create();
    const info = await youtube.getInfo('LK6VPvHR-38');
    
    // Choose format
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    console.log('Format chosen (itag):', format.itag);
    console.log('Format URL before decipher:', format.url);
    
    // Check if decipher method exists
    console.log('decipher exists:', typeof format.decipher === 'function');
    
    // Let's inspect where player class is
    console.log('youtube session keys:', Object.keys(youtube.session || {}));
    
    // Try to decipher using the player instance
    if (youtube.session && youtube.session.player) {
      console.log('Player instance found on youtube.session.player');
      const url = await format.decipher(youtube.session.player);
      console.log('Deciphered URL (truncated):', url ? url.substring(0, 120) : 'EMPTY');
    } else {
      console.log('Player not found on youtube.session.player. Checking other locations...');
      // Check youtube.player, youtube.actions.session.player, etc.
      console.log('youtube keys:', Object.keys(youtube));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
