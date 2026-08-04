module.exports = {
  apps: [
    {
      name: 'expertise-api',
      script: 'npm',
      args: 'run start:api',
      env: {
        NODE_ENV: 'production'
      },
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      restart_delay: 3000,
      max_memory_restart: '1G'
    },
    {
      name: 'expertise-worker',
      script: 'npm',
      args: 'run start:worker',
      env: {
        NODE_ENV: 'production'
      },
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      restart_delay: 3000,
      max_memory_restart: '500M'
    }
  ]
};
