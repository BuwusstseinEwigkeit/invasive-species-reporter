/**
 * Generate simple 81×81 PNG tab bar icons for WeChat Mini Program.
 * Run: node scripts/gen-tab-icons.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "miniprogram", "images");

function crc32(buf) {
  return zlib.crc32(buf) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeB, data]);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeB, data, crcB]);
}

function solidPng(w, h, r, g, b) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", zlib.deflateSync(raw)),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* Draw a filled circle in the center of an RGBA buffer */
function drawCircle(buf, w, h, cx, cy, radius, r, g, b) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        const o = y * (w * 4 + 1) + 1 + x * 4;
        buf[o] = r;
        buf[o + 1] = g;
        buf[o + 2] = b;
        buf[o + 3] = 255;
      }
    }
  }
}

/* Draw a simple house shape */
function drawHouse(buf, w, h, color) {
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2) + 4;
  const half = 14;
  // Roof triangle
  for (let y = cy - half; y <= cy; y++) {
    const spread = Math.round((y - (cy - half)) * 1.2);
    for (let x = cx - spread; x <= cx + spread; x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const o = y * (w * 4 + 1) + 1 + x * 4;
        buf[o] = color[0]; buf[o+1] = color[1]; buf[o+2] = color[2]; buf[o+3] = 255;
      }
    }
  }
  // Walls
  for (let y = cy; y < cy + half && y < h; y++) {
    for (let x = cx - half/2; x <= cx + half/2 && x < w; x++) {
      if (x >= 0) {
        const o = y * (w * 4 + 1) + 1 + x * 4;
        buf[o] = color[0]; buf[o+1] = color[1]; buf[o+2] = color[2]; buf[o+3] = 255;
      }
    }
  }
}

function iconPng(w, h, fgR, fgG, fgB, bgR, bgG, bgB, drawFn) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  // Fill background
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = bgR; raw[o+1] = bgG; raw[o+2] = bgB; raw[o+3] = 0; // transparent bg
    }
  }
  if (drawFn) drawFn(raw, w, h, [fgR, fgG, fgB]);
  // If no drawFn, paint a solid circle as the icon
  if (!drawFn) {
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    drawCircle(raw, w, h, cx, cy, Math.floor(w / 3), fgR, fgG, fgB);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", zlib.deflateSync(raw)),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* Draw a simple person silhouette (head + body) */
function drawPerson(buf, w, h, color) {
  const cx = Math.floor(w / 2);
  const headCy = Math.floor(h / 2) - 6;
  const bodyCy = Math.floor(h / 2) + 10;
  // Head circle
  drawCircle(buf, w, h, cx, headCy, 7, color[0], color[1], color[2]);
  // Body (triangle-ish)
  for (let y = headCy + 7; y < bodyCy + 10 && y < h; y++) {
    const progress = (y - (headCy + 7)) / (bodyCy + 10 - (headCy + 7));
    const halfWidth = Math.round(6 + progress * 4);
    for (let x = cx - halfWidth; x <= cx + halfWidth && x < w; x++) {
      if (x >= 0) {
        const o = y * (w * 4 + 1) + 1 + x * 4;
        buf[o] = color[0]; buf[o+1] = color[1]; buf[o+2] = color[2]; buf[o+3] = 255;
      }
    }
  }
}

const GREEN = "#305d3c";
const GREY = "#9e9e9e";
const greenR = 48, greenG = 93, greenB = 60;
const greyR = 158, greyG = 158, greyB = 158;

fs.mkdirSync(OUT, { recursive: true });

// Home (house icon - default grey, selected green)
const homeDef = iconPng(81, 81, greyR, greyG, greyB, 0,0,0, (buf,w,h,c) => drawHouse(buf,w,h,c));
const homeSel = iconPng(81, 81, greenR, greenG, greenB, 0,0,0, (buf,w,h,c) => drawHouse(buf,w,h,c));
fs.writeFileSync(path.join(OUT, "tab-home.png"), homeDef);
fs.writeFileSync(path.join(OUT, "tab-home-sel.png"), homeSel);
console.log("  tab-home.png + tab-home-sel.png");

// Map (circle default grey, selected green)
const mapDef = iconPng(81,81, greyR,greyG,greyB, 0,0,0, null);
const mapSel = iconPng(81,81, greenR,greenG,greenB, 0,0,0, null);
fs.writeFileSync(path.join(OUT, "tab-map.png"), mapDef);
fs.writeFileSync(path.join(OUT, "tab-map-sel.png"), mapSel);
console.log("  tab-map.png + tab-map-sel.png");

// Report (circle default grey, selected green)
const repDef = iconPng(81,81, greyR,greyG,greyB, 0,0,0, null);
const repSel = iconPng(81,81, greenR,greenG,greenB, 0,0,0, null);
fs.writeFileSync(path.join(OUT, "tab-report.png"), repDef);
fs.writeFileSync(path.join(OUT, "tab-report-sel.png"), repSel);
console.log("  tab-report.png + tab-report-sel.png");

// Profile (person silhouette - default grey, selected green)
const profDef = iconPng(81,81, greyR,greyG,greyB, 0,0,0, (buf,w,h,c) => drawPerson(buf,w,h,c));
const profSel = iconPng(81,81, greenR,greenG,greenB, 0,0,0, (buf,w,h,c) => drawPerson(buf,w,h,c));
fs.writeFileSync(path.join(OUT, "tab-profile.png"), profDef);
fs.writeFileSync(path.join(OUT, "tab-profile-sel.png"), profSel);
console.log("  tab-profile.png + tab-profile-sel.png");

console.log("Done! Generated 8 icon files in", OUT);
