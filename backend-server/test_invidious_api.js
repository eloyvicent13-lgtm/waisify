async function test() {
  try {
    const listRes = await fetch('https://api.invidious.io/instances.json');
    const instances = await listRes.json();
    
    const apiInstances = instances.filter(inst => inst[1].api === true);
    console.log('Total instances with API enabled:', apiInstances.length);
    apiInstances.forEach((inst, idx) => {
      console.log(`${idx + 1}: ${inst[1].uri} (type: ${inst[1].type}, flag: ${inst[1].flag})`);
    });
  } catch (err) {
    console.error(err);
  }
}
test();
