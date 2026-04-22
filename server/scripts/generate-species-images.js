const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Colors for different categories
const CATEGORY_COLORS = {
  "植物": { r: 76, g: 175, b: 80 },   // Green
  "动物": { r: 33, g: 150, b: 243 }    // Blue
};

const DEFAULT_COLOR = { r: 158, g: 158, b: 158 }; // Gray

const SPECIES_DATA = [
  {
    id: "species-001",
    chineseName: "加拿大一枝黄花",
    latinName: "Solidago canadensis",
    category: "植物",
    riskLevel: "高"
  },
  {
    id: "species-002",
    chineseName: "福寿螺",
    latinName: "Pomacea canaliculata",
    category: "动物",
    riskLevel: "高"
  },
  {
    id: "species-003",
    chineseName: "红耳龟",
    latinName: "Trachemys scripta elegans",
    category: "动物",
    riskLevel: "中"
  },
  {
    id: "species-004",
    chineseName: "水葫芦",
    latinName: "Eichhornia crassipes",
    category: "植物",
    riskLevel: "高"
  },
  {
    id: "species-005",
    chineseName: "空心莲子草",
    latinName: "Alternanthera philoxeroides",
    category: "植物",
    riskLevel: "高"
  },
  {
    id: "species-006",
    chineseName: "互花米草",
    latinName: "Spartina alterniflora",
    category: "植物",
    riskLevel: "高"
  },
  {
    id: "species-007",
    chineseName: "克氏原螯虾",
    latinName: "Procambarus clarkii",
    category: "动物",
    riskLevel: "中"
  },
  {
    id: "species-008",
    chineseName: "牛蛙",
    latinName: "Lithobates catesbeianus",
    category: "动物",
    riskLevel: "中"
  },
  {
    id: "species-009",
    chineseName: "清道夫",
    latinName: "Pterygoplichthys pardalis",
    category: "动物",
    riskLevel: "中"
  },
  {
    id: "species-010",
    chineseName: "豚草",
    latinName: "Ambrosia artemisiifolia",
    category: "植物",
    riskLevel: "高"
  },
  {
    id: "species-011",
    chineseName: "薇甘菊",
    latinName: "Mikania micrantha",
    category: "植物",
    riskLevel: "高"
  },
  {
    id: "species-012",
    chineseName: "巴西龟",
    latinName: "Trachemys scripta elegans",
    category: "动物",
    riskLevel: "中"
  }
];

async function generatePlaceholderImage(species, outputPath) {
  const width = 300;
  const height = 200;

  // Get color based on category
  const color = CATEGORY_COLORS[species.category] || DEFAULT_COLOR;

  // Create solid color image
  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="rgb(${color.r}, ${color.g}, ${color.b})"/>
      <text x="50%" y="40%" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="white" font-weight="bold">
        ${species.chineseName}
      </text>
      <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="white">
        ${species.latinName}
      </text>
      <text x="50%" y="70%" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="white">
        ${species.category} | 风险:${species.riskLevel}
      </text>
      <text x="50%" y="85%" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="rgba(255,255,255,0.7)">
        占位图片 - 外来物种识别
      </text>
    </svg>
  `;

  try {
    const buffer = Buffer.from(svg);
    await sharp(buffer)
      .resize(width, height)
      .jpeg({ quality: 80 })
      .toFile(outputPath);

    console.log(`Generated: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to generate ${outputPath}:`, error.message);
    return false;
  }
}

async function main() {
  const speciesDir = path.join(__dirname, "../uploads/species");

  // Ensure directory exists
  if (!fs.existsSync(speciesDir)) {
    fs.mkdirSync(speciesDir, { recursive: true });
  }

  console.log(`Generating species placeholder images in ${speciesDir}...`);

  let successCount = 0;
  for (const species of SPECIES_DATA) {
    const outputPath = path.join(speciesDir, `${species.id}.jpg`);
    const success = await generatePlaceholderImage(species, outputPath);
    if (success) successCount++;
  }

  console.log(`\nDone! Generated ${successCount}/${SPECIES_DATA.length} images.`);

  // Generate mapping file for reference
  const mapping = SPECIES_DATA.map(species => ({
    id: species.id,
    chineseName: species.chineseName,
    localUrl: `/uploads/species/${species.id}.jpg`,
    originalUrl: "" // Will be populated later
  }));

  fs.writeFileSync(
    path.join(speciesDir, "species-images.json"),
    JSON.stringify(mapping, null, 2),
    "utf8"
  );

  console.log(`\nTo update species data, replace avatar URLs with:\n`);
  mapping.forEach(item => {
    console.log(`  ${item.id}: "${item.localUrl}"`);
  });
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generatePlaceholderImage };