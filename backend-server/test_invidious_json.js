async function test() {
  try {
    const listRes = await fetch('https://api.invidious.io/instances.json');
    const instances = await listRes.json();
    console.log('Instances structure (keys):', Object.keys(instances).slice(0, 5));
    console.log('First instance entry:', JSON.stringify(instances[0], null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
