module.exports = {
  apps: [
    {
      name: 'whatsapp-commerce-hub',
      script: '.next/standalone/server.js',
      cwd: '/var/www/whatsapp-commerce-hub',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};

