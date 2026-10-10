/**
 * Script to generate all app icon sizes from the source Scan Master icon.
 * Uses sharp (already installed in the project).
 * 
 * Generates:
 * - public/icon-192.png (192x192 for PWA)
 * - public/icon-512.png (512x512 for PWA)
 * - public/logo-512.png (512x512 logo)
 * - public/logo.png (192x192 logo)
 * - android mipmap icons at all densities
 * - android adaptive icon foreground at all densities
 * - public/splash-icon.png (384x384 for splash screen)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.resolve('C:/Users/wahid/Downloads/scan master.png');
const PROJECT = path.resolve('C:/Users/wahid/Downloads/scanMaster_ai');

async function generateIcons() {
  console.log('Reading source icon:', SOURCE);
  
  if (!fs.existsSync(SOURCE)) {
    console.error('Source icon not found:', SOURCE);
    process.exit(1);
  }

  const sourceBuffer = fs.readFileSync(SOURCE);
  const metadata = await sharp(sourceBuffer).metadata();
  console.log(`Source: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

  // ── PWA & Web icons ──────────────────────────────────────────────
  const webIcons = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'logo-512.png', size: 512 },
    { name: 'logo.png', size: 192 },
    { name: 'splash-icon.png', size: 384 },
  ];

  for (const icon of webIcons) {
    const outPath = path.join(PROJECT, 'public', icon.name);
    await sharp(sourceBuffer)
      .resize(icon.size, icon.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`✓ ${icon.name} (${icon.size}x${icon.size})`);
  }

  // ── Android Launcher Icons (ic_launcher.png) ─────────────────────
  // These are the regular launcher icons
  const mipmapSizes = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const mipmap of mipmapSizes) {
    const dir = path.join(PROJECT, 'android', 'app', 'src', 'main', 'res', mipmap.dir);
    
    // ic_launcher.png — square launcher icon
    await sharp(sourceBuffer)
      .resize(mipmap.size, mipmap.size, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));
    console.log(`✓ ${mipmap.dir}/ic_launcher.png (${mipmap.size}x${mipmap.size})`);

    // ic_launcher_round.png — round launcher icon
    // Create a circular version using a circle mask
    const roundedBuffer = await sharp(sourceBuffer)
      .resize(mipmap.size, mipmap.size, { fit: 'cover' })
      .png()
      .toBuffer();

    // Create circle mask
    const circle = Buffer.from(
      `<svg width="${mipmap.size}" height="${mipmap.size}">
        <circle cx="${mipmap.size/2}" cy="${mipmap.size/2}" r="${mipmap.size/2}" fill="white"/>
      </svg>`
    );
    
    await sharp(roundedBuffer)
      .composite([{
        input: await sharp(circle).resize(mipmap.size, mipmap.size).png().toBuffer(),
        blend: 'dest-in'
      }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));
    console.log(`✓ ${mipmap.dir}/ic_launcher_round.png (${mipmap.size}x${mipmap.size} round)`);

    // ic_launcher_foreground.png — adaptive icon foreground
    // Android adaptive icons need 108dp foreground with the icon in the inner 72dp safe zone
    // That's 66.7% of the canvas, centered
    const fgSize = Math.round(mipmap.size * (108 / 48));  // Scale to adaptive icon size
    const iconInner = Math.round(fgSize * 0.6);  // Icon occupies ~60% of the canvas

    const innerIcon = await sharp(sourceBuffer)
      .resize(iconInner, iconInner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Create transparent canvas and composite the icon centered
    await sharp({
      create: {
        width: fgSize,
        height: fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{
        input: innerIcon,
        gravity: 'center'
      }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));
    console.log(`✓ ${mipmap.dir}/ic_launcher_foreground.png (${fgSize}x${fgSize})`);
  }

  // ── Android notification icon (small, white silhouette) ──────────
  // Notification icons should be white on transparent background
  // We'll just use a simple version of the icon
  for (const mipmap of mipmapSizes) {
    const dir = path.join(PROJECT, 'android', 'app', 'src', 'main', 'res', mipmap.dir);
    const notiSize = Math.round(mipmap.size * 0.6); // Notification icons are smaller
    
    const notiDir = path.join(PROJECT, 'android', 'app', 'src', 'main', 'res', mipmap.dir.replace('mipmap', 'drawable'));
    if (!fs.existsSync(notiDir)) {
      fs.mkdirSync(notiDir, { recursive: true });
    }
  }

  // ── Splash screen drawable ───────────────────────────────────────
  // High-res icon for splash screen background
  const splashDrawableDir = path.join(PROJECT, 'android', 'app', 'src', 'main', 'res', 'drawable');
  if (!fs.existsSync(splashDrawableDir)) {
    fs.mkdirSync(splashDrawableDir, { recursive: true });
  }
  
  await sharp(sourceBuffer)
    .resize(288, 288, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(splashDrawableDir, 'splash_icon.png'));
  console.log(`✓ drawable/splash_icon.png (288x288)`);

  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
