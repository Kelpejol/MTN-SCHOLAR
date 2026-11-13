// pm2 process definition for ONE colour of the blue/green deploy (see deploy/deploy.sh).
// blue = port 3110, green = port 3111. Memory is capped because the server is shared.
const color = process.env.APP_COLOR || "blue";
const port = process.env.APP_PORT || (color === "green" ? "3111" : "3110");

module.exports = {
  apps: [
    {
      name: `mtn-scholars-${color}`,
      cwd: process.env.APP_CWD || __dirname,
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${port} -H 127.0.0.1`,
      env: { NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=384" },
      max_memory_restart: "450M",
      autorestart: true,
      time: true,
    },
  ],
};
