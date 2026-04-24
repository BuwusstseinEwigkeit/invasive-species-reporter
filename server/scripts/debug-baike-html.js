/**
 * Debug: analyze Baike page HTML to find image patterns.
 * Run: node server/scripts/debug-baike-html.js
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function check(name) {
  const res = await fetch("https://baike.baidu.com/item/" + encodeURIComponent(name), {
    headers: { "User-Agent": UA }
  });
  const text = await res.text();

  console.log(`${name}:`);
  console.log("  Title:", ((text.match(/<title>([^<]+)<\/title>/) || ["", ""])[1] || "").substring(0, 60));
  console.log("  HTML size:", text.length, "bytes");

  // Check for image-related content
  const checks = [
    { label: "img tag with src", re: /<img[^>]+src="([^"]+\.(jpg|png|jpeg))"[^>]*>/gi },
    { label: "website.json.image", re: /"image"\s*:\s*"([^"]+)"/gi },
    { label: "og:image", re: /og:image[^>]+content="([^"]+)"/gi },
    { label: "bkimg URL", re: /https?:\/\/bkimg[^"' \t\n\r>)]+/g },
    { label: "any jpg in src", re: /src="([^"]+\.jpg)"/gi },
  ];

  for (const check of checks) {
    const matches = [];
    let m;
    while ((m = check.re.exec(text)) !== null) {
      if (matches.indexOf(m[1] || m[0]) === -1) {
        matches.push(m[1] || m[0]);
      }
      if (matches.length >= 5) break;
    }
    if (matches.length > 0) {
      console.log(`  ${check.label}: ${matches.length} unique`);
      matches.slice(0, 3).forEach(u => console.log(`    ${u.substring(0, 120)}`));
    }
  }

  // Check if page contains a redirect or error message
  const errorPatterns = ["404", "页面不存在", "您所访问的页面", "redirect"];
  for (const pat of errorPatterns) {
    if (text.includes(pat)) {
      const idx = text.indexOf(pat);
      console.log(`  Found "${pat}" at pos ${idx}: ...${text.substring(Math.max(0, idx - 20), idx + 50)}...`);
    }
  }

  // print small snippet around any URL
  const urlPattern = /https?:\/\/[^"' \t\n\r<>]{10,100}\.(jpg|png|jpeg|webp)/gi;
  const urlMatch = urlPattern.exec(text);
  if (urlMatch) {
    const idx = urlMatch.index;
    console.log(`  First image URL around pos ${idx}: ...${text.substring(Math.max(0, idx - 30), idx + 100)}...`);
  } else {
    console.log("  No image URLs found in entire page");
    // Print middle portion of page to see what's there
    const mid = Math.floor(text.length / 2);
    console.log(`  Mid-page snippet (500 chars around ${mid}):`);
    console.log(`  ${text.substring(mid - 100, mid + 400).substring(0, 500)}`);
  }
}

async function main() {
  await check("福寿螺");
  console.log("\n---\n");
  await check("薇甘菊");
}

main().catch(console.error);
