const { exec } = require('child_process');
const path = require('path');

console.log('Testing Cloudflare Tunnel Configuration...\n');

// Test 1: Check if cloudflared is installed
exec('cloudflared --version', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ cloudflared is not installed or not in PATH');
    console.log('Please install cloudflared from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/');
    return;
  }
  
  console.log('✅ cloudflared is installed');
  console.log(stdout);
  
  // Test 2: Check config file
  const configPath = path.join(__dirname, 'tunnel-config', 'config.yaml');
  const fs = require('fs');
  if (fs.existsSync(configPath)) {
    console.log('✅ config.yaml exists');
  } else {
    console.error('❌ config.yaml not found');
    return;
  }
  
  // Test 3: Check credentials file
  const credentialsPath = path.join(__dirname, 'tunnel-config', 'credentials.json');
  if (fs.existsSync(credentialsPath)) {
    console.log('✅ credentials.json exists');
    
    // Read and validate credentials file
    try {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      if (credentials.TunnelID) {
        console.log(`✅ Tunnel ID: ${credentials.TunnelID}`);
      } else {
        console.error('❌ Tunnel ID not found in credentials file');
        return;
      }
    } catch (parseError) {
      console.error('❌ Failed to parse credentials.json');
      return;
    }
  } else {
    console.error('❌ credentials.json not found');
    return;
  }
  
  console.log('\n✅ All configuration files are present and valid');
  console.log('\nTo start the tunnel, run:');
  console.log('start-tunnel.bat');
});