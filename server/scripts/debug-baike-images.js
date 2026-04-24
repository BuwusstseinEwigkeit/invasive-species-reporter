/**
 * Debug: find real image URLs from Baike pages for failed species.
 * Run: node server/scripts/debug-baike-images.js
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "static", "species");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml"
      }
    }, (res) => {
      let data = [];
      res.on("data", (c) => data.push(c));
      res.on("end", () => resolve(Buffer.concat(data)));
    }).on("error", reject);
  });
}

async function findRealImages(html) {
  const urls = [];
  // Match any image-looking URL from bkimg cdn
  const re = /https:\/\/bkimg[^"'\s)>]+/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[0].split("?")[0]; // strip query params
    if (!url.includes("baike.png") && !url.includes(".css") && url.length > 50 && urls.indexOf(url) === -1) {
      urls.push(url);
    }
  }
  return urls;
}

async function downloadIfReal(url, filepath) {
  try {
    const buf = await httpGet(url);
    // Real images are > 15KB and not PNG logos
    if (buf.length > 15000 && !buf.toString("utf-8", 1, 10).includes("PNG")) {
      fs.writeFileSync(filepath, buf);
      console.log(`  DOWNLOADED: ${path.basename(filepath)} (${(buf.length / 1024).toFixed(1)} KB)`);
      return true;
    }
    console.log(`  Too small or logo: ${url.substring(0, 80)} (${buf.length} bytes)`);
    return false;
  } catch (e) {
    console.log(`  Error: ${url.substring(0, 60)} - ${e.message}`);
    return false;
  }
}

async function processSpecies(name, speciesId) {
  console.log(`\n=== ${name} (${speciesId}) ===`);

  // Try normal page
  const html1 = await httpGet(`https://baike.baidu.com/item/${encodeURIComponent(name)}`);
  let urls = await findRealImages(html1.toString());
  console.log(`  Desktop version: ${urls.length} potential image URLs`);

  // If no images found, try mobile version
  if (urls.length === 0) {
    const html2 = await httpGet(`https://baike.baidu.com/item/${encodeURIComponent(name)}?adapt=1`);
    urls = await findRealImages(html2.toString());
    console.log(`  Mobile version: ${urls.length} potential image URLs`);
  }

  // Try to download the first real image
  const filepath = path.join(OUTPUT_DIR, `${speciesId}.jpg`);
  for (const url of urls.slice(0, 5)) {
    console.log(`  Trying: ${url.substring(0, 80)}`);
    const ok = await downloadIfReal(url, filepath);
    if (ok) return true;
  }

  return false;
}

async function main() {
  await processSpecies("福寿螺", "species-002");
  await processSpecies("薇甘菊", "species-011");
  await processSpecies("巴西龟", "species-012");
  console.log("\nDone!");
}

main().catch(console.error);
