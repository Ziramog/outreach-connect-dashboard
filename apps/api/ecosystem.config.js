module.exports = {
  apps: [
    {
      name: 'outreach-api',
      script: '/home/hermes/workspace/projects/outreach-connect/apps/api/dist/apps/api/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        API_SECRET: '30038fa230438403eeb24caa3c2670d1f62eeb36fcc80f82f7da4eca6b2c9d45',
        AUTH_SESSION_PATH: '/home/hermes/data/baileysconnect',
        DB_PATH: '/home/hermes/data/outreach.db',
        DAEMON_SCRIPT: '/home/hermes/workspace/projects/outreach-connect-daemon/daemon.js',
        ALLOWED_ORIGIN: '*',
        SUPABASE_URL: 'https://mrrieeeilameejhvbccu.supabase.co',
        SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ycmllZWVpbGFtZWVqaHZiY2N1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE0MjE2NywiZXhwIjoyMDkyNzE4MTY3fQ.qvMcTYuwjJQY66SacBZJVGjDPDaPo9Z7QYie2bgZR-Y',
        YCLOUD_WEBHOOK_TOKEN: 'whsec_3778440aa4db44eb82e75780f1e7b28a'
      }
    },
    {
      name: 'outreach-daemon',
      script: '/home/hermes/workspace/projects/outreach-connect-daemon/daemon.js',
      args: 'start',
      cwd: '/home/hermes/workspace/projects/outreach-connect-daemon',
      node_args: '--no-warnings',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        TZ: 'America/Argentina/Cordoba',
        HTTP_PROXY: 'http://022dd721a029802f73a4:221e4f35e3534717@gw.dataimpulse.com:823',
        HTTPS_PROXY: 'http://022dd721a029802f73a4:221e4f35e3534717@gw.dataimpulse.com:823'
      }
    }
  ]
}
