const https = require('https');

const token = process.env.VERCEL_TOKEN || 'vca_4F2abYTlSBQ...';
const deploymentId = 'dpl_7bVZtgnCZBjorRzH8ZaMifiLZwb';
// Try the latest one from vercel ls
const deploymentId2 = 'dpl_7bVrZtgnCZBjorRzH8ZaMifiLZwb';

function getDeployment(id) {
  return new Promise((resolve, reject) => {
    const url = `https://api.vercel.com/v1/deployments/${id}`;
    const req = https.get(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch(e) {
          resolve({ raw: data.substring(0, 1000) });
        }
      });
    });
    req.on('error', reject);
  });
}

async function main() {
  try {
    console.log('=== Deployment dpl_7bVrZtgnCZBjorRzH8ZaMifiLZwb ===');
    const d1 = await getDeployment('dpl_7bVrZtgnCZBjorRzH8ZaMifiLZwb');
    console.log('Status:', d1.status);
    console.log('Ready:', d1.ready);
    console.log('Created:', d1.createdAt);
    console.log('Failure:', d1.failureReason || d1.error?.message || 'none');
    console.log('Name:', d1.name);
    console.log('URL:', d1.url);
    console.log('---');
    
    console.log('=== Recent deployments ===');
    const recent = await getDeployment('dpl_7bVZtgnCZBjorRzH8ZaMifiLZwb');
    console.log(JSON.stringify(recent, null, 2).substring(0, 1500));
  } catch(e) {
    console.log('Error:', e.message);
  }
}

main();