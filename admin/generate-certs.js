const devcert = require('devcert');
const fs = require('fs');

async function main() {
  console.log('🏗️  Starting certificate generation...');
  try {
    const ssl = await devcert.certificateFor('localhost');
    if (!fs.existsSync('ssl')) {
      fs.mkdirSync('ssl', { recursive: true });
    }
    fs.writeFileSync('ssl/key.pem', ssl.key);
    fs.writeFileSync('ssl/cert.pem', ssl.cert);
    console.log('✅ Certs generated successfully in ssl/ directory!');
  } catch (err) {
    console.error('❌ Error generating certs:', err);
    process.exit(1);
  }
}

main();
