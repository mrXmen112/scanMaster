/**
 * Build script for Capacitor APK (static export mode)
 * 
 * 1. Temporarily moves API routes out of the way (they're served by the deployed server)
 * 2. Builds Next.js with output: 'export'
 * 3. Restores API routes after build
 * 
 * Cross-platform compatible (Windows + Linux/macOS).
 * Uses recursive copy + delete instead of rename to avoid EPERM on Windows.
 * 
 * Usage: node scripts/build-apk.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

// Load .env and .env.production files
const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envProdPath = path.join(rootDir, '.env.production');

const envVars = {
  ...loadEnvFile(envPath),
  ...loadEnvFile(envProdPath)
};

// Merge with existing environment
Object.assign(process.env, envVars);

const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
const backupDir = path.join(__dirname, '..', 'src', 'app', '_api_backup');
// Static export cannot compile middleware, so it is moved aside too.
const middlewareFile = path.join(__dirname, '..', 'src', 'middleware.ts');
const middlewareBackup = path.join(__dirname, '..', 'src', '_middleware_backup.ts');

/**
 * Recursively copy a directory tree.
 */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Recursively delete a directory tree.
 */
function deleteDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function moveApi() {
  if (fs.existsSync(apiDir)) {
    console.log('📦 Moving server routes out of build...');
    deleteDirRecursive(backupDir);
    copyDirRecursive(apiDir, path.join(backupDir, 'api'));
    deleteDirRecursive(apiDir);
    console.log('✅ Server routes backed up.');
  }
}

function restoreApi() {
  if (fs.existsSync(backupDir)) {
    console.log('📦 Restoring API routes...');
    deleteDirRecursive(apiDir);
    copyDirRecursive(path.join(backupDir, 'api'), apiDir);
    deleteDirRecursive(backupDir);
    console.log('✅ API routes restored.');
  }
  if (fs.existsSync(middlewareBackup)) {
    fs.copyFileSync(middlewareBackup, middlewareFile);
    fs.unlinkSync(middlewareBackup);
    console.log('✅ Middleware restored.');
  }
}

/**
 * Move middleware aside for the static export build.
 */
function moveMiddleware() {
  if (fs.existsSync(middlewareFile)) {
    console.log('📦 Moving middleware out of build...');
    if (fs.existsSync(middlewareBackup)) fs.unlinkSync(middlewareBackup);
    fs.copyFileSync(middlewareFile, middlewareBackup);
    fs.unlinkSync(middlewareFile);
  }
}

async function main() {
  try {
    // Step 0: Check critical environment variables
    console.log('🔍 Checking environment variables...');
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl || apiBaseUrl.includes('undefined')) {
      console.error('❌ CRITICAL: NEXT_PUBLIC_API_BASE_URL is not set!');
      console.error('   Set it in .env file: NEXT_PUBLIC_API_BASE_URL=https://scanmaster-ai.vercel.app');
      process.exit(1);
    }
    console.log(`✅ API Base URL: ${apiBaseUrl}`);

    // Step 1: Move API routes + middleware out of the way
    moveApi();
    moveMiddleware();

    // Step 2: Build with export mode and production environment
    console.log('🔨 Building Next.js (static export mode for Capacitor)...');
    execSync('npx next build', {
      stdio: 'inherit',
      env: { 
        ...process.env, 
        NEXT_BUILD_MODE: 'export',
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_BASE_URL: apiBaseUrl
      },
    });

    console.log('✅ Static export build complete! Output in out/ directory.');
    console.log(`✅ API calls will route to: ${apiBaseUrl}`);
  } catch (err) {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
  } finally {
    // Step 3: Always restore API routes
    restoreApi();
  }
}

main();
