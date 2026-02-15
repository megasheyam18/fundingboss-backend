const axios = require('axios');

async function checkUrl(projectName) {
    const url = `https://api.sheety.co/8158302f4f8bfc807bc480429465b087/${projectName}/sheet1`;
    console.log(`Checking: ${url}`);
    try {
        const response = await axios.get(url);
        console.log(`✅ SUCCESS: ${projectName} - Status: ${response.status}`);
        return true;
    } catch (error) {
        console.log(`❌ FAILED: ${projectName} - Status: ${error.response ? error.response.status : error.message}`);
        return false;
    }
}

async function verify() {
    await checkUrl('harishProject');
    await checkUrl('Harish-project');
}

verify();
