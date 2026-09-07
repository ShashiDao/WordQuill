const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Elegant Quill & Book icon SVG (Paper & Ink Design System)
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Background rounded canvas for standard icon -->
  <rect width="512" height="512" rx="104" fill="#1B1815" />

  <!-- Open Book Base -->
  <g>
    <!-- Book Pages Backing -->
    <path d="M120 330 C180 320 230 335 256 350 C282 335 332 320 392 330 L392 370 C332 360 282 375 256 390 C230 375 180 360 120 370 Z" fill="#8C8272" />
    <!-- Book Left Page -->
    <path d="M120 310 C180 298 230 315 256 330 L256 368 C230 353 180 338 120 350 Z" fill="#F6F1E7" />
    <!-- Book Right Page -->
    <path d="M392 310 C332 298 282 315 256 330 L256 368 C282 353 332 338 392 350 Z" fill="#EDE6DA" />
    <!-- Book Spine Rib -->
    <line x1="256" y1="330" x2="256" y2="385" stroke="#D98A93" stroke-width="4" stroke-linecap="round" />
  </g>

  <!-- Feather Quill -->
  <g>
    <!-- Quill Feather Body -->
    <path d="M350 110 C345 90 285 130 235 185 C185 240 170 300 172 325 C190 320 230 295 270 245 C310 195 355 130 350 110 Z" fill="#F6F1E7" />
    <!-- Feather Details / Notches -->
    <path d="M260 160 L235 185 M230 200 L205 222 M200 240 L180 260" stroke="#8C8272" stroke-width="3" stroke-linecap="round" />
    <!-- Quill Shaft & Accent Nib -->
    <path d="M350 110 Q260 210 172 325" fill="none" stroke="#D98A93" stroke-width="5" stroke-linecap="round" />
    <path d="M172 325 L165 338 L178 332 Z" fill="#D98A93" />
    <!-- Little ink starlet spark -->
    <circle cx="160" cy="342" r="3.5" fill="#D98A93" />
    <circle cx="152" cy="348" r="2" fill="#D98A93" opacity="0.8" />
  </g>
</svg>
`;

// Maskable icon with 15% safe margin (bleed background)
const svgMaskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Full-bleed background for maskable -->
  <rect width="512" height="512" fill="#1B1815" />

  <!-- Inner safe-zone scaled group (80% scale centered) -->
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <g>
      <path d="M120 330 C180 320 230 335 256 350 C282 335 332 320 392 330 L392 370 C332 360 282 375 256 390 C230 375 180 360 120 370 Z" fill="#8C8272" />
      <path d="M120 310 C180 298 230 315 256 330 L256 368 C230 353 180 338 120 350 Z" fill="#F6F1E7" />
      <path d="M392 310 C332 298 282 315 256 330 L256 368 C282 353 332 338 392 350 Z" fill="#EDE6DA" />
      <line x1="256" y1="330" x2="256" y2="385" stroke="#D98A93" stroke-width="4" stroke-linecap="round" />
    </g>

    <g>
      <path d="M350 110 C345 90 285 130 235 185 C185 240 170 300 172 325 C190 320 230 295 270 245 C310 195 355 130 350 110 Z" fill="#F6F1E7" />
      <path d="M260 160 L235 185 M230 200 L205 222 M200 240 L180 260" stroke="#8C8272" stroke-width="3" stroke-linecap="round" />
      <path d="M350 110 Q260 210 172 325" fill="none" stroke="#D98A93" stroke-width="5" stroke-linecap="round" />
      <path d="M172 325 L165 338 L178 332 Z" fill="#D98A93" />
      <circle cx="160" cy="342" r="3.5" fill="#D98A93" />
      <circle cx="152" cy="348" r="2" fill="#D98A93" opacity="0.8" />
    </g>
  </g>
</svg>
`;

async function run() {
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon.trim());

  await sharp(Buffer.from(svgIcon))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  await sharp(Buffer.from(svgIcon))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  await sharp(Buffer.from(svgMaskable))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  await sharp(Buffer.from(svgIcon))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  await sharp(Buffer.from(svgIcon))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  console.log('Successfully generated all PWA icons!');
}

run().catch(console.error);
