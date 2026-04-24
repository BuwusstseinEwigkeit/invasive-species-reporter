/**
 * Download real species photos from Baidu Baike (百度百科).
 * Uses Node.js built-in fetch (Node 18+) which auto-decompresses gzip.
 * Run: node server/scripts/download-species-images.js
 */
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "static", "species");

const SPECIES_MAP = [
  { id: "species-001", name: "加拿大一枝黄花" },
  { id: "species-002", name: "福寿螺" },
  { id: "species-003", name: "红耳龟" },
  { id: "species-004", name: "水葫芦" },
  { id: "species-005", name: "空心莲子草" },
  { id: "species-006", name: "互花米草" },
  { id: "species-007", name: "克氏原螯虾" },
  { id: "species-008", name: "牛蛙" },
  { id: "species-009", name: "清道夫鱼" },
  { id: "species-010", name: "豚草" },
  { id: "species-011", name: "薇甘菊" },
  { id: "species-012", name: "巴西龟" }
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function extractOgImage(html) {
  const m = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  return m ? m[1].replace(/\?x-bce-process.*$/, "") : null;
}

function extractAllImageUrls(html) {
  const urls = [];
  // Match all bkimg URLs from the page
  const re = /https:\/\/bkimg\.cdn\.bcebos\.com\/pic\/[a-zA-Z0-9]+/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (!match[0].includes("baike.png") && urls.indexOf(match[0]) === -1) {
      urls.push(match[0]);
    }
  }
  return urls;
}

async function downloadIfReal(url, filepath) {
  try {
    const buf = await fetchBuffer(url);
    if (buf.length > 15000) {
      fs.writeFileSync(filepath, buf);
      console.log(`  Downloaded (${(buf.length / 1024).toFixed(1)} KB)`);
      return true;
    }
    console.log(`  Too small: ${buf.length} bytes`);
    return false;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let success = 0;
  for (let i = 0; i < SPECIES_MAP.length; i++) {
    const entry = SPECIES_MAP[i];
    const filepath = path.join(OUTPUT_DIR, `${entry.id}.jpg`);
    console.log(`[${i + 1}/${SPECIES_MAP.length}] ${entry.name} (${entry.id})`);

    try {
      // Try desktop version first, fall back to mobile
      let html = await fetchText(`https://baike.baidu.com/item/${encodeURIComponent(entry.name)}`);

      let imgUrl = extractOgImage(html);
      let downloaded = false;

      // Try og:image
      if (imgUrl && !imgUrl.includes("baike.png")) {
        console.log(`  og:image found`);
        downloaded = await downloadIfReal(imgUrl, filepath);
      }

      // Try other images on the page
      if (!downloaded) {
        const allUrls = extractAllImageUrls(html);
        console.log(`  Found ${allUrls.length} alternative URLs`);

        for (const url of allUrls.slice(0, 5)) {
          downloaded = await downloadIfReal(url, filepath);
          if (downloaded) break;
        }
      }

      // Try mobile version as last resort
      if (!downloaded) {
        console.log(`  Trying mobile version...`);
        html = await fetchText(`https://baike.baidu.com/item/${encodeURIComponent(entry.name)}?adapt=1`);
        const mobileUrls = extractAllImageUrls(html);
        console.log(`  Found ${mobileUrls.length} URLs on mobile page`);
        for (const url of mobileUrls.slice(0, 5)) {
          downloaded = await downloadIfReal(url, filepath);
          if (downloaded) break;
        }
      }

      if (downloaded) {
        success++;
      } else {
        console.log(`  FAILED: no usable image`);
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }

  console.log(`\nDone! ${success}/${SPECIES_MAP.length} species have real images.`);
}

main().catch(console.error);
