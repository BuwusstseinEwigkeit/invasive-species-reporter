/**
 * Generate improved species images with gradients, patterns, and icons.
 * Run: node server/scripts/generate-better-species-images.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUTPUT_DIR = path.join(__dirname, "..", "static", "species");

const CATEGORY_STYLES = {
  "植物": { colors: ["#2e7d32", "#66bb6a"], icon: "🌿" },
  "动物": { colors: ["#1565c0", "#42a5f5"], icon: "🐾" }
};

const SPECIES = [
  { id: "species-001", chineseName: "加拿大一枝黄花", latinName: "Solidago canadensis", category: "植物", riskLevel: "高" },
  { id: "species-002", chineseName: "福寿螺", latinName: "Pomacea canaliculata", category: "动物", riskLevel: "高" },
  { id: "species-003", chineseName: "红耳龟", latinName: "Trachemys scripta elegans", category: "动物", riskLevel: "中" },
  { id: "species-004", chineseName: "水葫芦", latinName: "Eichhornia crassipes", category: "植物", riskLevel: "高" },
  { id: "species-005", chineseName: "空心莲子草", latinName: "Alternanthera philoxeroides", category: "植物", riskLevel: "高" },
  { id: "species-006", chineseName: "互花米草", latinName: "Spartina alterniflora", category: "植物", riskLevel: "高" },
  { id: "species-007", chineseName: "克氏原螯虾", latinName: "Procambarus clarkii", category: "动物", riskLevel: "中" },
  { id: "species-008", chineseName: "牛蛙", latinName: "Lithobates catesbeianus", category: "动物", riskLevel: "中" },
  { id: "species-009", chineseName: "清道夫", latinName: "Pterygoplichthys pardalis", category: "动物", riskLevel: "中" },
  { id: "species-010", chineseName: "豚草", latinName: "Ambrosia artemisiifolia", category: "植物", riskLevel: "高" },
  { id: "species-011", chineseName: "薇甘菊", latinName: "Mikania micrantha", category: "植物", riskLevel: "高" },
  { id: "species-012", chineseName: "巴西龟", latinName: "Trachemys scripta elegans", category: "动物", riskLevel: "中" }
];

function getRiskColor(level) {
  switch (level) {
    case "高": return "#e53935";
    case "中": return "#fb8c00";
    case "低": return "#43a047";
    default: return "#757575";
  }
}

function buildSvg(species, style) {
  const c1 = style.colors[0];
  const c2 = style.colors[1];
  const riskColor = getRiskColor(species.riskLevel);
  const icon = style.icon;

  return `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${c1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${c2};stop-opacity:1" />
      </linearGradient>
      <linearGradient id="overlay" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" style="stop-color:rgba(0,0,0,0.4);stop-opacity:1" />
        <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#bg)" rx="0" ry="0"/>
    <rect width="400" height="300" fill="url(#overlay)" rx="0" ry="0"/>

    <!-- Decorative circles -->
    <circle cx="320" cy="60" r="80" fill="rgba(255,255,255,0.06)" />
    <circle cx="50" cy="240" r="50" fill="rgba(255,255,255,0.06)" />
    <circle cx="380" cy="220" r="40" fill="rgba(255,255,255,0.05)" />

    <!-- Icon -->
    <text x="40" y="70" font-size="48" fill="rgba(255,255,255,0.3)">${icon}</text>

    <!-- Category badge -->
    <rect x="300" y="18" width="82" height="32" rx="16" fill="rgba(255,255,255,0.2)" />
    <text x="341" y="40" text-anchor="middle" font-family="sans-serif" font-size="14" fill="white">${species.category}</text>

    <!-- Chinese name -->
    <text x="40" y="150" font-family="sans-serif" font-size="40" font-weight="bold" fill="white">${species.chineseName}</text>

    <!-- Latin name (italic) -->
    <text x="40" y="180" font-family="serif" font-size="18" font-style="italic" fill="rgba(255,255,255,0.85)">${species.latinName}</text>

    <!-- Risk badge -->
    <rect x="40" y="200" width="90" height="28" rx="14" fill="${riskColor}" />
    <text x="85" y="220" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="bold" fill="white">风险 ${species.riskLevel}</text>
  </svg>`;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let count = 0;
  for (const species of SPECIES) {
    const style = CATEGORY_STYLES[species.category] || CATEGORY_STYLES["植物"];
    const svg = buildSvg(species, style);
    const outputPath = path.join(OUTPUT_DIR, `${species.id}.jpg`);

    await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(outputPath);
    console.log(`[${++count}/${SPECIES.length}] Generated ${species.id} — ${species.chineseName}`);
  }

  console.log("\nDone! All species images regenerated.");
}

main().catch(console.error);
