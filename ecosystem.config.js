
module.exports = {
  apps: [
    {
      name: 'nepse-api',
      script: 'src/server.js',
      interpreter: 'bun', // Rely on PATH since user installed it globally
      cwd: '/var/www/nepse-api', // Explicit CWD
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      env: {
        PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'true',
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/google-chrome-stable'
      },

      error_file: './logs/api-err.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      watch: false,
      max_memory_restart: '384M', // Lower memory limit for Bun (uses less memory)
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      exp_backoff_restart_delay: 100
      // Note: No node_args needed for Bun
    }
    // Note: Scheduler is now integrated into the server and auto-starts on boot
    // No separate scheduler process needed
  ]
};
