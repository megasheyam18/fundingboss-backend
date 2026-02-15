const axios = require('axios');
const id = '8158302f4f8bfc807bc480429465b087';

async function test(proj, sheet) {
  try {
    const url = `https://api.sheety.co/${id}/${proj}/${sheet}`;
    const res = await axios.get(url);
    console.log(`FOUND: ${proj}/${sheet} - Status: ${res.status}`);
  } catch(e) {
    console.log(`MISSING: ${proj}/${sheet} (${e.response?.status || e.message})`);
  }
}

async function run() {
  console.log('Starting check...');
  await test('harishProject', 'sheet1');
  await test('Harish-project', 'sheet1');
  await test('harishProject', 'Sheet1');
  await test('Harish-project', 'Sheet1'); 
  await test('fundingBoss', 'sheet1');
}
run();
