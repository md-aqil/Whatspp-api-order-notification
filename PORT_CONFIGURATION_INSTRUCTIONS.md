# Port Configuration Instructions

## Summary of Changes

To ensure consistent operation and avoid port conflicts, the application has been configured to use port 3000 as the default port.

## Files Updated

1. **package.json** - Updated all development scripts to use port 3000:
   ```json
   "scripts": {
     "dev": "SET NODE_OPTIONS=--max-old-space-size=512 && next dev --hostname 0.0.0.0 --port 3000",
     "dev:no-reload": "next dev --hostname 0.0.0.0 --port 3000",
     "dev:webpack": "next dev --hostname 0.0.0.0 --port 3000"
   }
   ```

2. **tunnel-config\config.yaml** - Updated Cloudflare tunnel to forward to port 3000:
   ```yaml
   ingress:
     # Main application ingress rule
     - hostname: lcsw.dpdns.org
       service: http://localhost:3000
   ```

3. **start-project.bat** - Updated batch file to reference port 3000:
   ```batch
   echo Starting development server on port 3000...
   echo   Local URL: http://localhost:3000
   ```

## Important Instructions

### Before Starting the Application
1. **Always check if port 3000 is already in use:**
   ```cmd
   netstat -ano | findstr :3000
   ```

2. **If port 3000 is in use, terminate the process:**
   ```cmd
   taskkill /PID <process_id> /F
   ```

3. **Never change the default port from 3000** - This ensures consistency across all configurations.

### Starting the Application
1. **Start the development server:**
   ```cmd
   yarn dev
   ```

2. **Start the Cloudflare tunnel:**
   ```cmd
   .\start-tunnel.bat
   ```

## Access Points
- **Local Access:** http://localhost:3000
- **Public Access:** https://lcsw.dpdns.org
- **Webhook URL:** https://lcsw.dpdns.org/api/webhook/shopify

## Troubleshooting
If you encounter a "Bad Gateway" error:
1. Verify that both the application and Cloudflare tunnel are running
2. Check that the ports in package.json and tunnel-config\config.yaml match
3. Restart both services if needed

This configuration ensures that all components work together seamlessly without port conflicts.