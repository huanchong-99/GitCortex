#!/usr/bin/env node

const path = require("path");
const { spawn } = require("child_process");
const { getPorts } = require("./setup-dev-environment");

const children = new Set();
let shuttingDown = false;

/**
 * Stop all child processes and exit
 */
function stop(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("\n[dev] Shutting down...");

  for (const child of children) {
    if (!child.killed) {
      // Windows doesn't support SIGTERM, use 'taskkill' or just kill()
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", child.pid, "/f", "/t"]);
      } else {
        child.kill("SIGTERM");
      }
    }
  }

  // Force exit after 5 seconds if processes don't stop
  setTimeout(() => {
    console.log("[dev] Force exit");
    process.exit(code ?? 0);
  }, 5000);
}

/**
 * Resolve command and args for Windows compatibility
 */
function resolveCommand(command, args) {
  if (process.platform !== "win32") {
    return { command, args };
  }

  if (command === "npm") {
    const npmExecPath = process.env.npm_execpath;
    if (npmExecPath) {
      return { command: process.execPath, args: [npmExecPath, ...args] };
    }
    return { command: "cmd.exe", args: ["/d", "/s", "/c", "npm", ...args] };
  }

  return { command, args };
}

/**
 * Run a command with proper error handling
 */
function run(name, command, args, options) {
  const resolved = resolveCommand(command, args);
  console.log(
    `[dev] Starting ${name}: ${resolved.command} ${resolved.args.join(" ")}`
  );

  const child = spawn(resolved.command, resolved.args, {
    stdio: "inherit",
    ...options
  });

  children.add(child);

  child.on("error", (err) => {
    console.error(`[dev] Failed to start ${name}: ${err.message}`);
    stop(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      console.error(`[dev] ${name} exited unexpectedly (code: ${code}, signal: ${signal})`);
      stop(code ?? 1);
    }
  });

  return child;
}

// Handle termination signals
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// Handle Windows Ctrl+C
if (process.platform === "win32") {
  require("readline")
    .createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    .on("SIGINT", () => stop(0));
}

/**
 * Main entry point
 */
async function main() {
  try {
    console.log("[dev] Setting up development environment...");

    const ports = await getPorts();

    console.log(`[dev] Frontend port: ${ports.frontend}`);
    console.log(`[dev] Backend port: ${ports.backend}`);

    const env = {
      ...process.env,
      FRONTEND_PORT: String(ports.frontend),
      BACKEND_PORT: String(ports.backend),
      DISABLE_WORKTREE_ORPHAN_CLEANUP: "1",
      RUST_LOG: "debug",
    };

    // Start backend
    run(
      "backend",
      "cargo",
      ["watch", "-w", "crates", "-x", "run --bin server"],
      { env }
    );

    // Start frontend
    run(
      "frontend",
      "npm",
      ["run", "dev", "--", "--port", String(ports.frontend), "--host"],
      {
        env,
        cwd: path.join(__dirname, "..", "frontend")
      }
    );

    console.log("[dev] Development servers started successfully");
    console.log("[dev] Press Ctrl+C to stop");
  } catch (err) {
    console.error("[dev] Failed to start development environment:", err);
    process.exit(1);
  }
}

main();
