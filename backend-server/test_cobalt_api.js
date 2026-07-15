async function test() {
  try {
    const res = await fetch('https://instances.cobalt.best/api/instances');
    console.log('Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Instances count:', data.length);
      if (data && data.length > 0) {
        console.log('First 5 instances data:', JSON.stringify(data.slice(0, 5), null, 2));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
