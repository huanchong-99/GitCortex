#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

const DEV_ASSETS_SEED = path.join(__dirname, "..", "dev_assets_seed");
const DEV_ASSETS = path.join(__dirname, "..", "dev_assets");

// Fixed development ports - always use these
const FIXED_FRONTEND_PORT = 23457;
const FIXED_BACKEND_PORT = 23456;

/**
 * Check if a port is available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: "localhost" });
    sock.on("connect", () => {
      sock.destroy();
      resolve(false);
    });
    sock.on("error", () => resolve(true));
  });
}

/**
 * Allocate ports for development - always use fixed ports
 */
async function allocatePorts() {
  const ports = {
    frontend: FIXED_FRONTEND_PORT,
    backend: FIXED_BACKEND_PORT,
    timestamp: new Date().toISOString(),
  };

  const frontendAvailable = await isPortAvailable(ports.frontend);
  const backendAvailable = await isPortAvailable(ports.backend);

  if (process.argv[2] === "get") {
    if (!frontendAvailable || !backendAvailable) {
      console.log(
        `Port availability check failed: frontend:${ports.frontend}=${frontendAvailable}, backend:${ports.backend}=${backendAvailable}`
      );
    }

    console.log("Using fixed dev ports:");
    console.log(`Frontend: ${ports.frontend}`);
    console.log(`Backend: ${ports.backend}`);
  }

  return ports;
}

/**
 * Get ports (allocate if needed)
 */
async function getPorts() {
  const ports = await allocatePorts();
  copyDevAssets();
  return ports;
}

/**
 * Copy dev_assets_seed to dev_assets
 */
function copyDevAssets() {
  try {
    if (!fs.existsSync(DEV_ASSETS)) {
      // Copy dev_assets_seed to dev_assets
      fs.cpSync(DEV_ASSETS_SEED, DEV_ASSETS, { recursive: true });

      if (process.argv[2] === "get") {
        console.log("Copied dev_assets_seed to dev_assets");
      }
    }
  } catch (error) {
    console.error("Failed to copy dev assets:", error.message);
  }
}

/**
 * Clear saved ports (no-op since fixed ports are always used)
 */
function clearPorts() {
  console.log("Fixed dev ports are always used; no saved ports to clear");
}

// CLI interface
if (require.main === module) {
  function main() {
    const command = process.argv[2];

    switch (command) {
      case "get": {
        return getPorts().then((ports) => {
          console.log(JSON.stringify(ports));
        });
      }

      case "clear":
        clearPorts();
        return;

      case "frontend": {
        return getPorts().then((ports) => {
          console.log(JSON.stringify(ports.frontend, null, 2));
        });
      }

      case "backend": {
        return getPorts().then((ports) => {
          console.log(JSON.stringify(ports.backend, null, 2));
        });
      }

      default:
        console.log("Usage:");
        console.log(
          "  node setup-dev-environment.js get     - Setup dev environment (ports + assets)"
        );
        console.log(
          "  node setup-dev-environment.js frontend - Get frontend port only"
        );
        console.log(
          "  node setup-dev-environment.js backend  - Get backend port only"
        );
        console.log(
          "  node setup-dev-environment.js clear    - No-op (fixed ports are used)"
        );
        return;
    }
  }

  process.once("unhandledRejection", (error) => {
    console.error(error);
    process.exit(1);
  });
  main();
}

module.exports = { getPorts, clearPorts };
