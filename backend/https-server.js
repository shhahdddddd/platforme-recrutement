const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Try to use selfsigned package for certificate generation
let selfsigned;
try {
    selfsigned = require('selfsigned');
} catch (e) {
    console.log('📦 Installing selfsigned package...');
    execSync('npm install --save-dev selfsigned', { stdio: 'inherit' });
    selfsigned = require('selfsigned');
}

// Certificate configuration
const certDir = path.join(__dirname, 'ssl');
const certPath = path.join(certDir, 'cert.pem');
const keyPath = path.join(certDir, 'key.pem');

if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
}

let options;

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('🔐 Generating self-signed SSL certificate...');
    try {
        const attrs = [
            { name: 'commonName', value: 'localhost' },
            { name: 'countryName', value: 'TN' },
            { shortName: 'ST', value: 'Tunis' },
            { name: 'localityName', value: 'Tunis' },
            { name: 'organizationName', value: 'RecrutiTN' }
        ];

        const pems = selfsigned.generate(attrs, {
            keySize: 2048,
            days: 365,
            algorithm: 'sha256',
            extensions: [
                {
                    name: 'basicConstraints',
                    cA: true
                },
                {
                    name: 'keyUsage',
                    keyCertSign: true,
                    digitalSignature: true,
                    nonRepudiation: true,
                    keyEncipherment: true,
                    dataEncipherment: true
                },
                {
                    name: 'extKeyUsage',
                    serverAuth: true,
                    clientAuth: true,
                    codeSigning: true,
                    timeStamping: true
                },
                {
                    name: 'subjectAltName',
                    altNames: [
                        {
                            type: 2, // DNS
                            value: 'localhost'
                        },
                        {
                            type: 7, // IP
                            ip: '127.0.0.1'
                        }
                    ]
                }
            ]
        });

        fs.writeFileSync(keyPath, pems.private);
        fs.writeFileSync(certPath, pems.cert);
        console.log('✅ SSL certificate generated successfully!');

        options = {
            key: pems.private,
            cert: pems.cert
        };
    } catch (error) {
        console.error('❌ Error generating SSL certificate:', error.message);
        process.exit(1);
    }
} else {
    options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
}

const LARAVEL_PORT = 8001; // Laravel will run on 8001
const HTTPS_PORT = 8000;   // HTTPS proxy on 8000

// Create HTTPS proxy server
const server = https.createServer(options, (req, res) => {
    // Handle OPTIONS requests for CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    const proxyReq = http.request({
        hostname: '127.0.0.1',
        port: LARAVEL_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
    }, (proxyRes) => {
        // Forward status code
        const headers = { ...proxyRes.headers };

        // Only add CORS headers if the backend didn't provide them
        if (!headers['access-control-allow-origin']) {
            headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
            headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
            headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept';
            headers['Access-Control-Allow-Credentials'] = 'true';
        }

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('❌ Proxy error:', err.message);
        res.writeHead(502, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            success: false,
            message: 'Backend server not available. Make sure Laravel is running on port ' + LARAVEL_PORT
        }));
    });

    req.pipe(proxyReq);
});

server.listen(HTTPS_PORT, () => {
    console.log('\n🚀 HTTPS Proxy Server Started!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 HTTPS Proxy: https://localhost:${HTTPS_PORT}`);
    console.log(`🔄 Forwarding to: http://127.0.0.1:${LARAVEL_PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  Important:');
    console.log(`   1. Laravel should be running on port ${LARAVEL_PORT}`);
    console.log('   2. Accept the self-signed certificate in your browser');
    console.log('   3. In Chrome/Edge: type "thisisunsafe" on the warning page');
    console.log('\n💡 Press Ctrl+C to stop the server\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down HTTPS proxy server...');
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});
