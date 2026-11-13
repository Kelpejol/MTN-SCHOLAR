// pm2 process definition. Runs next to the other apps on the shared server, so memory is capped.
// cwd is the `current` link that deploy/deploy.sh switches to each new release.
module.exports = {
  apps: [
    {
      name: "mtn-scholars",
      cwd: process.env.APP_CWD || "/var/www/mtn-scholars-app/current",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3110 -H 127.0.0.1",
      env: { NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=384" },
      max_memory_restart: "450M",
      autorestart: true,
      time: true,
    },
  ],
};
