/**
 * Debug: print raw Baike page snippet to understand image URL patterns.
 * Run: node server/scripts/debug-baike-raw.js
 */
const https = require("https");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9"
      }
    }, (res) => {
      let data = [];
      res.on("data", (c) => data.push(c));
      res.on("end", () => resolve(Buffer.concat(data)));
    }).on("error", reject);
  });
}

async function main() {
  const html = await httpGet("https://baike.baidu.com/item/" + encodeURIComponent("福寿螺"));
  const text = html.toString();

  // Print sections around "img" and "image" and "bkimg"
  const keywords = ["img", "image", "src", "picture", "pic"];
  for (const kw of keywords) {
    let idx = text.indexOf(kw);
    if (idx >= 0) {
      console.log(`\n=== Found "${kw}" at position ${idx} ===`);
      console.log(text.substring(Math.max(0, idx - 50), idx + 200));
    }
  }

  // Also try to find any URL-like patterns
  console.log("\n=== Any image-like URLs ===");
  const urlRe = /https?:\/\/[^"'\s<>)]+\.(jpg|jpeg|png|gif|webp)/gi;
  const matches = text.match(urlRe) || [];
  const unique = [...new Set(matches)];
  unique.slice(0, 10).forEach((u) => console.log(`  ${u.substring(0, 120)}`));
  if (unique.length === 0) console.log("  No image URLs found at all");

  // Check response size
  console.log(`\nResponse size: ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB`);
  console.log(`Status/error keywords: ${text.includes("404") ? "404 " : ""}${text.includes("404") ? "" : ""}`);
}

main().catch(console.error);
