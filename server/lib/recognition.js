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

async function recognizeWithZhipu({ imageBuffer, mimeType, speciesList }) {
  ensureRecognitionEnabled();

  const base64Image = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
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

// --- Ollama (local model) provider ---

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || "";

async function recognizeWithOllama({ imageBuffer, mimeType, speciesList }) {
  if (!OLLAMA_VISION_MODEL) {
    throw new Error("OLLAMA_VISION_MODEL is not configured.");
  }

  const base64Image = imageBuffer.toString("base64");
  const promptText = `${buildPrompt(speciesList)}\n\n请识别这张图中的疑似外来物种，并按要求返回 JSON。`;

  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: promptText,
          images: [base64Image]
        }
      ],
      stream: false,
      options: {
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const text = (payload.message && payload.message.content) || "";
  const parsed = extractJson(text);

  return {
    matchedSpeciesId: parsed.matchedSpeciesId || "",
    matchedSpeciesName: parsed.matchedSpeciesName || "",
    confidence: Number(parsed.confidence || 0),
    summary: parsed.summary || "",
    topCandidates: Array.isArray(parsed.topCandidates) ? parsed.topCandidates.slice(0, 3) : []
  };
}

// --- Mock provider ---

async function recognizeWithMock({ speciesList }) {
  // Mock provider: randomly select from speciesList with low confidence
  // Used as fallback when other providers fail
  if (!speciesList || speciesList.length === 0) {
    return {
      matchedSpeciesId: "",
      matchedSpeciesName: "",
      confidence: 0,
      summary: "无法识别：物种列表为空",
      topCandidates: []
    };
  }

  // Randomly select 1-3 candidates
  const shuffled = [...speciesList].sort(() => Math.random() - 0.5);
  const numCandidates = Math.min(1 + Math.floor(Math.random() * 3), shuffled.length);
  const candidates = shuffled.slice(0, numCandidates);

  // Main match is first candidate with low confidence
  const mainCandidate = candidates[0];
  const confidence = 0.3 + Math.random() * 0.3; // 0.3-0.6

  return {
    matchedSpeciesId: mainCandidate.id,
    matchedSpeciesName: mainCandidate.chineseName,
    confidence: confidence,
    summary: `模拟识别结果：可能为${mainCandidate.chineseName}（${mainCandidate.latinName}），置信度较低，请人工审核。`,
    topCandidates: candidates.map((species, idx) => ({
      speciesId: species.id,
      speciesName: species.chineseName,
      confidence: confidence * (0.8 - idx * 0.2) // decreasing confidence
    }))
  };
}

async function recognizeSpeciesFromImage({ filePath, mimeType, speciesList }) {
  // Prepare image once for all providers
  const preparedImage = await prepareImageForRecognition(filePath, mimeType);
  const imageBuffer = Buffer.from(preparedImage.base64Data, "base64");

  // Primary chain: Zhipu (cloud) -> mock (degraded fallback)
  const providers = [
    { name: "zhipu", fn: recognizeWithZhipu }
  ];

  // Optional: Ollama local model for dev/testing only (set OLLAMA_VISION_MODEL to enable)
  if (OLLAMA_VISION_MODEL) {
    providers.push({ name: "ollama", fn: recognizeWithOllama });
  }

  // Always have mock as final fallback
  providers.push({ name: "mock", fn: recognizeWithMock });

  let lastError = null;

  for (const provider of providers) {
    try {
      console.log(`[recognition] trying provider: ${provider.name}`);
      const result = await provider.fn({
        imageBuffer,
        mimeType: preparedImage.mimeType,
        speciesList
      });

      if (result.confidence > 0) {
        console.log(`[recognition] provider ${provider.name} succeeded with confidence ${result.confidence}`);
        return result;
      }
    } catch (error) {
      console.error(`[recognition] provider ${provider.name} failed:`, error.message);
      lastError = error;

      // If Zhipu fails due to missing API key, skip to next provider
      if (provider.name === "zhipu" && error.message.includes("ZHIPU_API_KEY is not configured")) {
        console.log(`[recognition] ZHIPU_API_KEY not configured, falling back to next provider`);
        continue;
      }

      // For other errors, wait a bit before trying next provider
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // All providers failed
  if (lastError) {
    throw lastError;
  }

  // Final fallback: use mock even if it "failed" (shouldn't happen)
  console.log(`[recognition] all providers failed, using mock as final fallback`);
  return recognizeWithMock({ speciesList });
}

module.exports = {
  recognizeSpeciesFromImage
};
