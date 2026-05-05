module.exports = {
  apps: [
    {
      name: 'chatflow-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'chatflow-worker',
      script: 'scripts/worker.js',
      instances: 2,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
