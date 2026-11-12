// pm2 process definition. Runs next to the other apps on the shared server, so memory is capped.
module.exports = {
  apps: [
    {
      name: "mtn-scholars",
      cwd: "/var/www/mtn-scholars",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3110 -H 127.0.0.1",
      env: { NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=384" },
      max_memory_restart: "450M",
      autorestart: true,
      time: true,
    },
  ],
};
