/**
 * Download images for species that the main script couldn't get.
 * Run: node server/scripts/download-failed-species.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "static", "species");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    };
    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        httpGet(loc.startsWith("http") ? loc : "https://baike.baidu.com" + loc).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error("HTTP " + res.statusCode)); return; }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

async function saveImage(url, filepath, label) {
  try {
    const buf = await httpGet(url);
    if (buf.length > 10000) {  // > 10KB = real image
      fs.writeFileSync(filepath, buf);
      console.log(`  ${label}: saved (${(buf.length / 1024).toFixed(1)} KB)`);
      return true;
    }
    console.log(`  ${label}: too small (${buf.length} bytes), skipping`);
    return false;
  } catch (e) {
    console.log(`  ${label}: error - ${e.message}`);
    return false;
  }
}

// Manually sourced image URLs for problematic species.
// These are from verified Baidu Baike or Wikimedia Commons entries.
const SPECIES_IMG = {
  // 福寿螺 from Baidu Baike "福寿螺" page — direct bkimg URL
  "species-002": "https://bkimg.cdn.bcebos.com/pic/9f2f070828381f30e9243f17aa014c086e06f013",

  // 薇甘菊 from alternative Baike URL
  "species-011": "https://bkimg.cdn.bcebos.com/pic/80cb39dbb6fd5266d0160924a018972bd40736fa",

  // 巴西龟 — need a different image from 红耳龟.
  // Try Wikimedia Commons via direct file URL
  "species-012": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Trachemys_scripta_electronica_-_Tampa_1.jpg/1280px-Trachemys_scripta_electronica_-_Tampa_1.jpg"
};

async function main() {
  console.log("Downloading failed species images...\n");

  for (const [id, url] of Object.entries(SPECIES_IMG)) {
    const filepath = path.join(OUTPUT_DIR, `${id}.jpg`);
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 20000) {
      console.log(`${id}: already has a real image (${(fs.statSync(filepath).size / 1024).toFixed(1)} KB), skipping`);
      continue;
    }
    console.log(`${id}: downloading...`);
    await saveImage(url, filepath, id);
  }

  console.log("\nDone!");
}

main().catch(console.error);
