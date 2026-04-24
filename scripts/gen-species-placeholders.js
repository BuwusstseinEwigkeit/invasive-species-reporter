/**
 * Generate placeholder species images for newly added species (013-020).
 * Run: node scripts/gen-species-placeholders.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "server", "static", "species");

function crc32(buf) { return zlib.crc32(buf) >>> 0; }

function createChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeB, data]);
  const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeB, data, crcB]);
}

function drawCircle(buf, w, h, cx, cy, radius, r, g, b) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        const o = y * (w * 4 + 1) + 1 + x * 4;
        buf[o] = r; buf[o+1] = g; buf[o+2] = b; buf[o+3] = 255;
      }
    }
  }
}

function drawLetter(buf, w, h, startX, startY, charCode, colorR, colorG, colorB) {
  // Simple pixel font for digits
  const font = {
    "0": [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    "1": [[0,0,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
    "2": [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
    "3": [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
    "4": [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
    "5": [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
    "6": [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
    "7": [[1,1,1],[0,0,1],[0,1,0],[1,0,0],[0,0,0]],
    "8": [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
    "9": [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]]
  };
  const pattern = font[charCode];
  if (!pattern) return;
  for (let r = 0; r < pattern.length; r++) {
    for (let c = 0; c < pattern[r].length; c++) {
      if (pattern[r][c]) {
        for (let dy = 0; dy < 8; dy++) {
          for (let dx = 0; dx < 8; dx++) {
            const x = startX + c * 8 + dx;
            const y = startY + r * 8 + dy;
            if (x >= 0 && x < w && y >= 0 && y < h) {
              const o = y * (w * 4 + 1) + 1 + x * 4;
              buf[o] = colorR; buf[o+1] = colorG; buf[o+2] = colorB; buf[o+3] = 255;
            }
          }
        }
      }
    }
  }
}

function speciesPng(w, h, bgR, bgG, bgB, letter) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = 0; raw[o+1] = 0; raw[o+2] = 0; raw[o+3] = 0;
    }
  }
  // Background circle
  drawCircle(raw, w, h, 60, 60, 54, bgR, bgG, bgB);
  if (letter) {
    drawLetter(raw, w, h, 40, 35, letter, 255, 255, 255);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, createChunk("IHDR", ihdr), createChunk("IDAT", zlib.deflateSync(raw)), createChunk("IEND", Buffer.alloc(0))]);
}

const SZ = 120;
const colors = [
  [180, 50, 50],   // 013 red
  [100, 60, 30],   // 014 brown
  [200, 180, 50],  // 015 yellow
  [150, 100, 50],  // 016 tan
  [50, 120, 180],  // 017 blue
  [50, 150, 80],   // 018 green
  [120, 180, 50],  // 019 lime
  [180, 100, 30]   // 020 orange
];

fs.mkdirSync(OUT, { recursive: true });

for (let i = 0; i < 8; i++) {
  const num = 13 + i;
  const idx = num.toString();
  const c = colors[i];
  const png = speciesPng(SZ, SZ, c[0], c[1], c[2], idx);
  fs.writeFileSync(path.join(OUT, `species-${String(num).padStart(3, "0")}.jpg`), png);
  console.log(`  species-${String(num).padStart(3, "0")}.jpg`);
}

console.log("Done! Generated 8 species placeholder images in", OUT);
