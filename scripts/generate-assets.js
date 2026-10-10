const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const SOURCE_IMAGE = 'C:\\Users\\wahid\\.gemini\\antigravity\\brain\\5723a21e-0292-45db-abb8-3fcae0f48ab8\\media__1779368652211.jpg';
const WORKSPACE_DIR = 'c:\\Users\\wahid\\Downloads\\scanMaster_ai';

async function generate() {
  console.log('[Assets Pipeline] Starting premium asset generation...');

  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error(`[Assets Pipeline] ERROR: Source image not found at ${SOURCE_IMAGE}`);
    process.exit(1);
  }

  // 1. Create target directories if they don't exist
  const publicDir = path.join(WORKSPACE_DIR, 'public');
  const assetsDir = path.join(WORKSPACE_DIR, 'assets');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  // 2. Setup sharp targets
  const targets = [
    { file: path.join(publicDir, 'icon-192.png'), size: 192 },
    { file: path.join(publicDir, 'icon-512.png'), size: 512 },
    { file: path.join(publicDir, 'logo-512.png'), size: 512 },
    { file: path.join(publicDir, 'logo.png'), size: 512 },
    { file: path.join(publicDir, 'splash-icon.png'), size: 512 },
    { file: path.join(assetsDir, 'icon.png'), size: 1024 },
  ];

  for (const target of targets) {
    console.log(`[Assets Pipeline] Generating ${path.basename(target.file)} (${target.size}x${target.size})...`);
    await sharp(SOURCE_IMAGE)
      .resize(target.size, target.size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background if any padding is added
      })
      .png()
      .toFile(target.file);
  }

  // 3. Generate high-resolution splash.png (2732x2732) with a beautiful deep dark navy background
  console.log('[Assets Pipeline] Generating centered 2732x2732 splash.png...');
  const splashPath = path.join(assetsDir, 'splash.png');
  const splashIconPath = path.join(assetsDir, 'splash-icon.png');

  // Also save a 512x512 splash-icon in assets
  await sharp(SOURCE_IMAGE).resize(512, 512).png().toFile(splashIconPath);

  // Resize icon to 768x768 for splash composite
  const splashIconBuffer = await sharp(SOURCE_IMAGE)
    .resize(768, 768, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  // Create solid dark navy canvas (#131324 matching premium dark theme background)
  await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: { r: 19, g: 19, b: 36, alpha: 1 } // #131324
    }
  })
    .composite([{ input: splashIconBuffer, gravity: 'center' }])
    .png()
    .toFile(splashPath);

  console.log('[Assets Pipeline] Saved source icon.png and splash.png in assets/');

  // 4. Run @capacitor/assets to generate Android density mipmaps/drawables
  console.log('[Assets Pipeline] Installing and executing @capacitor/assets generate --android...');
  try {
    // Run npx @capacitor/assets generate --android
    execSync('npx @capacitor/assets generate --android', {
      cwd: WORKSPACE_DIR,
      stdio: 'inherit',
      shell: true
    });
    console.log('[Assets Pipeline] SUCCESS: Android densities successfully generated.');
  } catch (err) {
    console.warn('[Assets Pipeline] WARNING: Local npx generate failed, attempting fallback run...', err.message);
    try {
      execSync('npx -y @capacitor/assets generate --android', {
        cwd: WORKSPACE_DIR,
        stdio: 'inherit',
        shell: true
      });
      console.log('[Assets Pipeline] SUCCESS: Android densities successfully generated (fallback).');
    } catch (err2) {
      console.error('[Assets Pipeline] ERROR: Failed to run @capacitor/assets generate.', err2.message);
    }
  }

  console.log('[Assets Pipeline] Finished successfully.');
}

generate().catch(err => {
  console.error('[Assets Pipeline] Fatal Error in assets generation:', err);
  process.exit(1);
});
