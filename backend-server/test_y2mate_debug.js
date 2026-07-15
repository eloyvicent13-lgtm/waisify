async function test() {
  const videoId = 'aBSkvI0CkgU';
  try {
    const res = await fetch('https://www.y2mate.com/');
    console.log('Homepage status:', res.status);
  } catch (err) {
    console.error('Full connection error:', err);
  }
}
test();
