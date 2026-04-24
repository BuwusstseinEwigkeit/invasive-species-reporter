/**
 * Fallback: try alternative Baike URL patterns for failed species.
 * Run: node server/scripts/download-fallback.js
 */
const fs = require("fs");
const path = require("path");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const OUTPUT_DIR = path.join(__dirname, "..", "static", "species");

async function tryFetch(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  return { status: res.status, body: await res.text() };
}

async function download(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

function findBkimgUrls(text) {
  const urls = [];
  const re = /https:\/\/bkimg[^"' \t\n\r>)]+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const clean = m[0].replace(/\?.*$/, "");
    if (!clean.includes("baike.png") && clean.length > 50 && urls.indexOf(clean) === -1) {
      urls.push(clean);
    }
  }
  return urls;
}

function findLemmaId(text) {
  const patterns = [
    /lemmaId[":]+\s*(\d+)/i,
    /\/item\/[^/]+\/(\d+)/,
    /data-lemmaid[":]+(\d+)/i,
    /lemma_id[":]+\s*(\d+)/i
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m[1];
  }
  return null;
}

async function saveImage(url, filepath, label) {
  try {
    const buf = await download(url);
    if (buf.length > 15000) {
      fs.writeFileSync(filepath, buf);
      console.log("  [OK] " + label + ": " + (buf.length / 1024).toFixed(1) + " KB");
      return true;
    }
    console.log("  [SMALL] " + label + ": " + buf.length + " bytes");
    return false;
  } catch (e) {
    console.log("  [ERR] " + label + ": " + e.message);
    return false;
  }
}

async function tryAll(name, speciesId, knownIds) {
  const filepath = path.join(OUTPUT_DIR, speciesId + ".jpg");
  if (fs.existsSync(filepath) && fs.statSync(filepath).size > 20000) {
    console.log(speciesId + " (" + name + "): already has image, skipping");
    return;
  }

  console.log("\n" + speciesId + " (" + name + "):");

  // First, fetch the page to find all possible IDs
  const initRes = await tryFetch("https://baike.baidu.com/item/" + encodeURIComponent(name));
  const pageId = findLemmaId(initRes.body);
  const allIds = [...new Set([...knownIds, pageId].filter(Boolean))];
  console.log("  Found IDs: " + (allIds.length ? allIds.join(", ") : "none"));

  // Generate URLs to try
  const urlsToTry = [];
  for (const id of allIds) {
    urlsToTry.push("https://baike.baidu.com/item/" + encodeURIComponent(name) + "/" + id);
    urlsToTry.push("https://baike.baidu.com/view/" + id);
    urlsToTry.push("https://baike.baidu.com/api/lemma?lemmaId=" + id);
  }

  for (const url of urlsToTry) {
    try {
      const { body } = await tryFetch(url);
      const bkimg = findBkimgUrls(body);
      if (bkimg.length > 0) {
        console.log("  " + url.substring(0, 70) + " -> " + bkimg.length + " bkimg URLs");
        for (const imgUrl of bkimg.slice(0, 5)) {
          if (await saveImage(imgUrl, filepath, imgUrl.substring(0, 60))) return;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  console.log("  FAILED: no image found");
}

async function main() {
  await tryAll("福寿螺", "species-002", ["4201051"]);
  await tryAll("薇甘菊", "species-011", []);
  console.log("\nDone!");
}

main().catch(console.error);
