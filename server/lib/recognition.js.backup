const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DEFAULT_MODEL = process.env.ZHIPU_MODEL || "glm-4.6v-flash";
const DEFAULT_BASE_URL =
  process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MAX_RETRIES = Number(process.env.ZHIPU_MAX_RETRIES || 3);

function ensureRecognitionEnabled() {
  if (!process.env.ZHIPU_API_KEY) {
    const error = new Error("ZHIPU_API_KEY is not configured.");
    error.statusCode = 503;
    throw error;
  }
}

function getMimeType(filePath, fallbackMimeType) {
  if (fallbackMimeType) {
    return fallbackMimeType;
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".png") {
    return "image/png";
  }

  if (ext === ".webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

function buildPrompt(speciesList) {
  const options = speciesList
    .map(
      (item) =>
        `${item.id} | ${item.chineseName} | ${item.latinName} | ${item.category} | 风险:${item.riskLevel}`
    )
    .join("\n");

  return [
    "你是外来物种识别助手。",
    "任务是在给定候选物种列表里判断图片最可能对应的物种，而不是自由发挥。",
    "如果图片不足以支持判断，也要明确说明，并把 confidence 压低。",
    "输出必须是严格 JSON，不要 markdown，不要解释。",
    "JSON 结构如下：",
    '{"matchedSpeciesId":"","matchedSpeciesName":"","confidence":0,"summary":"","topCandidates":[{"speciesId":"","speciesName":"","confidence":0}]}',
    "confidence 取 0 到 1 之间的小数。",
    "topCandidates 最多给 3 个。",
    "候选物种列表：",
    options
  ].join("\n");
}

function extractTextFromResponse(payload) {
  const message = payload && payload.choices && payload.choices[0] && payload.choices[0].message;

  if (!message) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Recognition service did not return JSON.");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestRecognition(body) {
  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetch(DEFAULT_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ZHIPU_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      return response.json();
    }

    const errorText = await response.text();
    lastError = new Error(`Zhipu request failed: ${response.status} ${errorText}`);
    lastError.statusCode = response.status === 429 ? 503 : 502;

    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES - 1) {
      await sleep(1500 * (attempt + 1));
      continue;
    }

    throw lastError;
  }

  throw lastError;
}

async function prepareImageForRecognition(filePath, mimeType) {
  const transformer = sharp(filePath, {
    failOn: "none"
  }).rotate();

  const metadata = await transformer.metadata();
  const longestEdge = Math.max(metadata.width || 0, metadata.height || 0);

  let pipeline = sharp(filePath, {
    failOn: "none"
  }).rotate();

  if (longestEdge > 1280) {
    pipeline = pipeline.resize({
      width: metadata.width >= metadata.height ? 1280 : null,
      height: metadata.height > metadata.width ? 1280 : null,
      fit: "inside",
      withoutEnlargement: true
    });
  }

  const outputBuffer = await pipeline.jpeg({
    quality: 72,
    mozjpeg: true
  }).toBuffer();

  return {
    mimeType: "image/jpeg",
    base64Data: outputBuffer.toString("base64"),
    originalMimeType: getMimeType(filePath, mimeType)
  };
}

async function recognizeSpeciesFromImage({ filePath, mimeType, speciesList }) {
  ensureRecognitionEnabled();

  const preparedImage = await prepareImageForRecognition(filePath, mimeType);
  const base64Image = `data:${preparedImage.mimeType};base64,${preparedImage.base64Data}`;

  const payload = await requestRecognition({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${buildPrompt(speciesList)}\n\n请识别这张图中的疑似外来物种，并按要求返回 JSON。`
          },
          {
            type: "image_url",
            image_url: {
              url: base64Image
            }
          }
        ]
      }
    ],
    thinking: {
      type: "disabled"
    },
    temperature: 0.1
  });
  const parsed = extractJson(extractTextFromResponse(payload));

  return {
    matchedSpeciesId: parsed.matchedSpeciesId || "",
    matchedSpeciesName: parsed.matchedSpeciesName || "",
    confidence: Number(parsed.confidence || 0),
    summary: parsed.summary || "",
    topCandidates: Array.isArray(parsed.topCandidates) ? parsed.topCandidates.slice(0, 3) : []
  };
}

module.exports = {
  recognizeSpeciesFromImage
};
