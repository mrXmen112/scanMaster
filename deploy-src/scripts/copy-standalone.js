const { cpSync, existsSync } = require('fs');
const { join } = require('path');

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');

if (existsSync(standalone)) {
  cpSync(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });
  if (existsSync(join(root, 'public'))) {
    cpSync(join(root, 'public'), join(standalone, 'public'), { recursive: true });
  }
  console.log('Copied static assets and public folder into .next/standalone');
} else {
  console.warn('.next/standalone not found; skipping asset copy');
}
