/**
 * Download a distinct image for 巴西龟 (different from 红耳龟).
 * Run: node server/scripts/download-baxigui.js
 */
const fs = require("fs");
const path = require("path");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const OUTPUT = path.join(__dirname, "..", "static", "species", "species-012.jpg");

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  return res.text();
}

async function fetchBuf(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

function findBkimg(text) {
  const urls = [];
  const re = /https:\/\/bkimg[^"' \t\n\r>)]+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const clean = m[0].replace(/\?.*$/, "");
    if (clean.length > 50 && !clean.includes("baike.png") && urls.indexOf(clean) === -1) {
      urls.push(clean);
    }
  }
  return urls;
}

async function main() {
  console.log("Finding 巴西龟 lemma ID...");
  const html = await fetchText("https://baike.baidu.com/item/" + encodeURIComponent("巴西龟"));
  const idMatch = html.match(/\/item\/[^/]+\/(\d+)/);
  const lemmaId = idMatch ? idMatch[1] : null;
  console.log("  Lemma ID: " + lemmaId);

  if (!lemmaId) { console.log("No lemma ID found"); return; }

  // Try old-style page format (has images in static HTML)
  console.log("Trying old-style Baike page...");
  const oldHtml = await fetchText("https://baike.baidu.com/item/巴西龟/" + lemmaId);
  const urls = findBkimg(oldHtml);
  console.log("  Found " + urls.length + " bkimg URLs");

  // Try each URL until we get one that's different from 红耳龟
  const species003Path = path.join(__dirname, "..", "static", "species", "species-003.jpg");
  const species003Size = fs.existsSync(species003Path) ? fs.statSync(species003Path).size : 0;
  console.log("  species-003 (红耳龟) size: " + species003Size + " bytes");

  for (const url of urls.slice(0, 5)) {
    try {
      const buf = await fetchBuf(url);
      if (buf.length > 20000 && Math.abs(buf.length - species003Size) > 1000) {
        fs.writeFileSync(OUTPUT, buf);
        console.log("  Downloaded distinct image: " + (buf.length / 1024).toFixed(1) + " KB");
        return;
      }
      console.log("  Skipping (size " + buf.length + " too close to 红耳龟 or too small)");
    } catch (e) {
      console.log("  Error: " + e.message.substring(0, 60));
    }
  }

  console.log("Could not find distinct image");
}

main().catch(console.error);
