/**
 * Generate product placeholder PNG icons for shop items.
 * Run: node scripts/gen-product-icons.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "server", "static", "products");

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

function drawRect(buf, w, h, x1, y1, x2, y2, r, g, b) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const o = y * (w * 4 + 1) + 1 + x * 4;
        buf[o] = r; buf[o+1] = g; buf[o+2] = b; buf[o+3] = 255;
      }
    }
  }
}

function productPng(w, h, drawFn) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = 0; raw[o+1] = 0; raw[o+2] = 0; raw[o+3] = 0;
    }
  }
  if (drawFn) drawFn(raw, w, h);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, createChunk("IHDR", ihdr), createChunk("IDAT", zlib.deflateSync(raw)), createChunk("IEND", Buffer.alloc(0))]);
}

const SZ = 200;
const GRN = [48, 93, 60];
const LGRN = [100, 150, 100];
const WHT = [255, 255, 255];
const GOLD = [218, 165, 32];

fs.mkdirSync(OUT, { recursive: true });

// Product 1: 外来物种识别手册 — book icon (rectangle with center line)
const p1 = productPng(SZ, SZ, (buf, w, h) => {
  drawRect(buf, w, h, 40, 30, 160, 170, GRN[0], GRN[1], GRN[2]);
  drawRect(buf, w, h, 45, 35, 155, 165, LGRN[0], LGRN[1], LGRN[2]);
  drawRect(buf, w, h, 60, 70, 140, 75, WHT[0], WHT[1], WHT[2]);
  drawRect(buf, w, h, 60, 90, 140, 95, WHT[0], WHT[1], WHT[2]);
  drawRect(buf, w, h, 60, 110, 120, 115, WHT[0], WHT[1], WHT[2]);
});
fs.writeFileSync(path.join(OUT, "product-001.png"), p1);

// Product 2: 生态田野笔记本 — notebook icon
const p2 = productPng(SZ, SZ, (buf, w, h) => {
  drawRect(buf, w, h, 50, 25, 150, 175, GRN[0], GRN[1], GRN[2]);
  drawRect(buf, w, h, 55, 30, 145, 170, WHT[0], WHT[1], WHT[2]);
  drawRect(buf, w, h, 60, 55, 140, 60, LGRN[0], LGRN[1], LGRN[2]);
  drawRect(buf, w, h, 60, 75, 140, 80, LGRN[0], LGRN[1], LGRN[2]);
  drawRect(buf, w, h, 60, 95, 140, 100, LGRN[0], LGRN[1], LGRN[2]);
  drawRect(buf, w, h, 60, 115, 140, 120, LGRN[0], LGRN[1], LGRN[2]);
  drawRect(buf, w, h, 130, 25, 135, 175, GRN[0], GRN[1], GRN[2]);
});
fs.writeFileSync(path.join(OUT, "product-002.png"), p2);

// Product 3: 哨点徽章 — badge/shield icon
const p3 = productPng(SZ, SZ, (buf, w, h) => {
  // Shield shape using circle
  drawCircle(buf, w, h, 100, 100, 70, GOLD[0], GOLD[1], GOLD[2]);
  drawCircle(buf, w, h, 100, 100, 55, GRN[0], GRN[1], GRN[2]);
  drawCircle(buf, w, h, 100, 100, 40, GOLD[0], GOLD[1], GOLD[2]);
  // Center dot
  drawCircle(buf, w, h, 100, 100, 15, WHT[0], WHT[1], WHT[2]);
});
fs.writeFileSync(path.join(OUT, "product-003.png"), p3);

// Product 4: 数据导出权限 — data/chart icon
const p4 = productPng(SZ, SZ, (buf, w, h) => {
  // Bar chart bars
  drawRect(buf, w, h, 50, 120, 70, 160, GRN[0], GRN[1], GRN[2]);
  drawRect(buf, w, h, 80, 90, 100, 160, GRN[0], GRN[1], GRN[2]);
  drawRect(buf, w, h, 110, 60, 130, 160, GRN[0], GRN[1], GRN[2]);
  drawRect(buf, w, h, 140, 40, 160, 160, GRN[0], GRN[1], GRN[2]);
  // Baseline
  drawRect(buf, w, h, 35, 160, 165, 165, LGRN[0], LGRN[1], LGRN[2]);
  // Arrow up
  drawRect(buf, w, h, 130, 22, 135, 40, GRN[0], GRN[1], GRN[2]);
  drawRect(buf, w, h, 125, 28, 140, 33, GRN[0], GRN[1], GRN[2]);
});
fs.writeFileSync(path.join(OUT, "product-004.png"), p4);

console.log("Generated 4 product icons in", OUT);
