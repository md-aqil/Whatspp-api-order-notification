const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('Cloudflare Tunnel Diagnostic Script\n');

// Check 1: cloudflared installation
console.log('1. Checking cloudflared installation...');
exec('cloudflared --version', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ cloudflared is not installed or not in PATH');
    console.log('Please install cloudflared from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/');
    return;
  }
  
  console.log('✅ cloudflared is installed');
  console.log(stdout);
  
  // Check 2: Config file existence
  console.log('\n2. Checking config file...');
  const configPath = path.join(__dirname, 'tunnel-config', 'config.yaml');
  if (fs.existsSync(configPath)) {
    console.log('✅ config.yaml exists');
    
    // Read config file
    const configContent = fs.readFileSync(configPath, 'utf8');
    console.log('Config file content:');
    console.log(configContent);
  } else {
    console.error('❌ config.yaml not found');
    return;
  }
  
  // Check 3: Credentials file existence
  console.log('\n3. Checking credentials file...');
  const credentialsPath = path.join(__dirname, 'tunnel-config', 'credentials.json');
  if (fs.existsSync(credentialsPath)) {
    console.log('✅ credentials.json exists');
    
    // Read and validate credentials file
    try {
      const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
      const credentials = JSON.parse(credentialsContent);
      console.log('Credentials file content:');
      console.log(JSON.stringify(credentials, null, 2));
      
      if (credentials.TunnelID) {
        console.log(`\n✅ Tunnel ID: ${credentials.TunnelID}`);
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
  
  // Check 4: Compare tunnel IDs
  console.log('\n4. Comparing tunnel IDs...');
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
    const credentials = JSON.parse(credentialsContent);
    
    // Extract tunnel ID from config (this is a simple extraction, might need refinement)
    const configLines = configContent.split('\n');
    let configTunnelId = '';
    for (const line of configLines) {
      if (line.trim().startsWith('tunnel:')) {
        configTunnelId = line.split(':')[1].trim();
        break;
      }
    }
    
    if (configTunnelId === credentials.TunnelID) {
      console.log('✅ Tunnel IDs match between config.yaml and credentials.json');
    } else {
      console.error('❌ Tunnel IDs do not match:');
      console.error(`   config.yaml: ${configTunnelId}`);
      console.error(`   credentials.json: ${credentials.TunnelID}`);
      return;
    }
  } catch (error) {
    console.error('❌ Error comparing tunnel IDs:', error.message);
    return;
  }
  
  // Check 5: Test connectivity
  console.log('\n5. Testing basic connectivity...');
  exec('ping -n 1 1.1.1.1', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Network connectivity issue');
      console.error('Please check your internet connection');
    } else {
      console.log('✅ Network connectivity is working');
    }
    
    console.log('\n✅ All diagnostic checks completed');
    console.log('\nTo start the tunnel, run:');
    console.log('start-tunnel.bat');
  });
});