#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const checkMode = process.argv.includes('--check');
const CARGO_EXECUTABLE = process.platform === 'win32' ? 'cargo.exe' : 'cargo';

console.log(checkMode ? 'Checking SQLx prepared queries...' : 'Preparing database for SQLx...');

const backendDir = path.join(__dirname, '..', 'crates/db');

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function toAbsoluteExecutable(filePath, sourceName) {
  const resolved = path.resolve(filePath);
  if (!path.isAbsolute(resolved) || !isFile(resolved)) {
    throw new Error(`${sourceName} must point to an existing executable file: ${filePath}`);
  }
  return resolved;
}

function resolveCargoPath() {
  if (process.env.CARGO) {
    return toAbsoluteExecutable(process.env.CARGO, 'CARGO');
  }

  const candidateDirs = [
    process.env.CARGO_HOME ? path.join(process.env.CARGO_HOME, 'bin') : null,
    process.env.HOME ? path.join(process.env.HOME, '.cargo', 'bin') : null,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.cargo', 'bin') : null,
  ].filter(Boolean);

  for (const dir of candidateDirs) {
    const candidate = path.join(dir, CARGO_EXECUTABLE);
    if (isFile(candidate)) {
      return candidate;
    }
  }

  const pathEntries = (process.env.PATH || process.env.Path || '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry && path.isAbsolute(entry));

  for (const entry of pathEntries) {
    const candidate = path.join(entry, CARGO_EXECUTABLE);
    if (isFile(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to locate cargo executable with an absolute path. Set CARGO to the full path of cargo.'
  );
}

function sanitizePath(pathValue) {
  if (!pathValue) return '';
  const seen = new Set();
  const safeEntries = [];

  for (const entry of pathValue.split(path.delimiter)) {
    const trimmed = entry.trim();
    if (!trimmed || !path.isAbsolute(trimmed) || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    safeEntries.push(trimmed);
  }

  return safeEntries.join(path.delimiter);
}

function buildCommandEnv(databaseUrl) {
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const pathKey =
    Object.keys(process.env).find((key) => key.toUpperCase() === 'PATH') || 'PATH';

  env[pathKey] = sanitizePath(process.env[pathKey] || '');
  return env;
}

function runCargo(cargoPath, args, databaseUrl) {
  execFileSync(cargoPath, args, {
    cwd: backendDir,
    stdio: 'inherit',
    env: buildCommandEnv(databaseUrl),
  });
}

// Create temporary database file
const dbFile = path.join(backendDir, 'prepare_db.sqlite');
fs.writeFileSync(dbFile, '');

try {
  const cargoPath = resolveCargoPath();

  // Get absolute path (cross-platform)
  const dbPath = path.resolve(dbFile);
  const databaseUrl = `sqlite:${dbPath}`;

  console.log(`Using database: ${databaseUrl}`);

  // Run migrations
  console.log('Running migrations...');
  runCargo(cargoPath, ['sqlx', 'migrate', 'run'], databaseUrl);

  // Prepare queries
  console.log(checkMode ? 'Checking prepared queries...' : 'Preparing queries...');
  const prepareArgs = checkMode ? ['sqlx', 'prepare', '--check'] : ['sqlx', 'prepare'];
  runCargo(cargoPath, prepareArgs, databaseUrl);

  console.log(checkMode ? 'SQLx check complete!' : 'Database preparation complete!');

} finally {
  // Clean up temporary file
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }
}
