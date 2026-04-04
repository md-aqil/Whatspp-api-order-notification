module.exports = {
  apps: [
    {
      name: 'whatsapp-commerce-hub',
      script: '.next/standalone/server.js',
      cwd: '/var/www/whatsapp-commerce-hub',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/whatsapp-commerce-hub-error.log',
      out_file: '/var/log/pm2/whatsapp-commerce-hub-out.log',
      merge_logs: true,
    },
  ],
};
