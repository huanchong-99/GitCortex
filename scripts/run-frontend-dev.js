#!/usr/bin/env node

const path = require("node:path");
const { spawn } = require("node:child_process");

function resolveNpmCommand(args) {
  if (process.platform !== "win32") {
    return { command: "npm", args };
  }

  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return { command: process.execPath, args: [npmExecPath, ...args] };
  }

  return { command: "cmd.exe", args: ["/d", "/s", "/c", "npm", ...args] };
}

function main() {
  const port = String(process.env.FRONTEND_PORT || "23457");
  const env = {
    ...process.env,
    FRONTEND_PORT: port,
  };
  const npmArgs = ["run", "dev", "--", "--port", port, "--host"];
  const resolved = resolveNpmCommand(npmArgs);

  const child = spawn(resolved.command, resolved.args, {
    cwd: path.join(__dirname, "..", "frontend"),
    stdio: "inherit",
    env,
  });

  child.on("error", (err) => {
    console.error(`[frontend:dev] failed to start: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main();
