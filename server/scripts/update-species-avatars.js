const fs = require("fs");
const path = require("path");

const mockDataPath = path.join(__dirname, "../data/mock-data.js");

// Read the file
let content = fs.readFileSync(mockDataPath, "utf8");

// Mapping of species IDs to local avatar paths
const avatarMapping = {
  "species-001": "/uploads/species/species-001.jpg",
  "species-002": "/uploads/species/species-002.jpg",
  "species-003": "/uploads/species/species-003.jpg",
  "species-004": "/uploads/species/species-004.jpg",
  "species-005": "/uploads/species/species-005.jpg",
  "species-006": "/uploads/species/species-006.jpg",
  "species-007": "/uploads/species/species-007.jpg",
  "species-008": "/uploads/species/species-008.jpg",
  "species-009": "/uploads/species/species-009.jpg",
  "species-010": "/uploads/species/species-010.jpg",
  "species-011": "/uploads/species/species-011.jpg",
  "species-012": "/uploads/species/species-012.jpg"
};

// Replace each avatar URL
for (const [speciesId, localPath] of Object.entries(avatarMapping)) {
  // Find the avatar line for this species
  // Pattern: avatar: "https://commons.wikimedia.org/...",
  const avatarPattern = new RegExp(`(\\s+avatar:\\s*")[^"]+(",?\\s*//?\\s*${speciesId}?)`, "gi");

  // Try to match with potential trailing comment
  let match;
  let newContent = "";
  let lastIndex = 0;
  const regex = new RegExp(`(\\s+avatar:\\s*")[^"]+(".*)`, "g");

  // Simple approach: find the species block and replace within it
  const speciesPattern = new RegExp(`(id:\\s*"${speciesId}"[\\s\\S]*?avatar:\\s*")[^"]+(")`, "g");

  if (speciesPattern.test(content)) {
    content = content.replace(speciesPattern, `$1${localPath}$2`);
    console.log(`Updated avatar for ${speciesId}`);
  } else {
    console.warn(`Could not find species ${speciesId} avatar field`);
  }
}

// Also update the reports that use Wikimedia URLs
// Replace report image URLs with local species images where appropriate
const reportUpdates = {
  "report-1001": "species-001",
  "report-1002": "species-002"
};

for (const [reportId, speciesId] of Object.entries(reportUpdates)) {
  const reportPattern = new RegExp(`(id:\\s*"${reportId}"[\\s\\S]*?imageUrl:\\s*")[^"]+(")`, "g");
  const localPath = `/uploads/species/${speciesId}.jpg`;

  if (reportPattern.test(content)) {
    content = content.replace(reportPattern, `$1${localPath}$2`);
    console.log(`Updated report image for ${reportId}`);
  }
}

// Write back
fs.writeFileSync(mockDataPath, content, "utf8");
console.log("\nUpdated mock-data.js with local avatar paths");
console.log("Note: Original Wikimedia URLs have been replaced with local placeholder images");