const { exec } = require('child_process');

console.log('Testing Cloudflare Tunnel Connection...\n');

// Test 1: Check if we can access the tunnel endpoint
console.log('1. Testing tunnel endpoint accessibility...');

// We'll use a simple HTTP request to check if the tunnel is working
const https = require('https');

const options = {
  hostname: 'lcsw.dpdns.org',
  port: 443,
  path: '/',
  method: 'GET',
  timeout: 5000
};

const req = https.request(options, (res) => {
  console.log(`✅ Tunnel endpoint is accessible. Status code: ${res.statusCode}`);
  
  // Test 2: Check cloudflared process
  console.log('\n2. Checking if cloudflared process is running...');
  exec('tasklist /fi "imagename eq cloudflared.exe"', (error, stdout, stderr) => {
    if (stdout.includes('cloudflared.exe')) {
      console.log('✅ cloudflared process is running');
    } else {
      console.log('ℹ️  cloudflared process not found (this is normal if tunnel is not running)');
    }
    
    console.log('\n✅ Tunnel testing completed');
  });
});

req.on('error', (e) => {
  console.log(`❌ Tunnel endpoint is not accessible: ${e.message}`);
  console.log('This is expected if the tunnel is not currently running');
  
  // Test 2: Check cloudflared process
  console.log('\n2. Checking if cloudflared process is running...');
  exec('tasklist /fi "imagename eq cloudflared.exe"', (error, stdout, stderr) => {
    if (stdout.includes('cloudflared.exe')) {
      console.log('✅ cloudflared process is running');
    } else {
      console.log('ℹ️  cloudflared process not found (this is normal if tunnel is not running)');
    }
    
    console.log('\n✅ Tunnel testing completed');
  });
});

req.on('timeout', () => {
  console.log('❌ Tunnel endpoint request timed out');
  req.destroy();
});

req.end();