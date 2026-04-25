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

async function requestRecognition(body, signal) {
  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(DEFAULT_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.ZHIPU_API_KEY}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response.json();
      }

      const errorText = await response.text();

      // 429: Rate limited - treat as temporary, retry with backoff
      // 500-599: Server error - retry with backoff
      // Other: Don't retry (4xx client errors)
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Zhipu request failed: ${response.status} ${errorText}`);
        lastError.statusCode = response.status;
        lastError.isRetryable = true;

        if (attempt < MAX_RETRIES - 1) {
          // Check for Retry-After header
          const retryAfter = response.headers.get("Retry-After");
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1500 * (attempt + 1);
          console.log(`[recognition] Zhipu retryable error, waiting ${delay}ms before retry ${attempt + 1}/${MAX_RETRIES}`);
          await sleep(delay);
          continue;
        }
      } else {
        // 4xx client errors - don't retry
        lastError = new Error(`Zhipu request failed: ${response.status} ${errorText}`);
        lastError.statusCode = response.status;
        lastError.isRetryable = false;
        throw lastError;
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError") {
        lastError = new Error("Zhipu request timeout (30s)");
        lastError.statusCode = 504;
        lastError.isRetryable = true;
      } else {
        lastError = err;
        lastError.isRetryable = true;
      }

      if (lastError.isRetryable && attempt < MAX_RETRIES - 1) {
        await sleep(500);
        continue;
      }

      throw lastError;
    }
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

// --- Python microservice provider ---

const PYTHON_RECOGNITION_URL = process.env.PYTHON_RECOGNITION_URL || "";

async function recognizeWithPython({ filePath, mimeType, speciesList }) {
  if (!PYTHON_RECOGNITION_URL) {
    throw new Error("PYTHON_RECOGNITION_URL is not configured.");
  }

  const fs = require("fs");
  const imageBuffer = fs.readFileSync(filePath);
  const base64Image = imageBuffer.toString("base64");

  const response = await fetch(`${PYTHON_RECOGNITION_URL}/recognize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_base64: base64Image,
      mime_type: mimeType || "image/jpeg",
      species_list: speciesList
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Python service failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`Python service error: ${result.error}`);
  }

  return {
    matchedSpeciesId: result.matchedSpeciesId || "",
    matchedSpeciesName: result.matchedSpeciesName || "",
    confidence: Number(result.confidence || 0),
    summary: result.summary || "",
    topCandidates: Array.isArray(result.topCandidates) ? result.topCandidates.slice(0, 3) : []
  };
}

// --- Moonshot/Kimi (cloud vision) provider ---

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY || "";
const MOONSHOT_BASE_URL = process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1/chat/completions";
const MOONSHOT_MODEL = process.env.MOONSHOT_MODEL || "moonshot-v1-8k-vision-preview";

async function recognizeWithMoonshot({ imageBuffer, mimeType, speciesList }) {
  if (!MOONSHOT_API_KEY) {
    throw new Error("MOONSHOT_API_KEY is not configured.");
  }

  const base64Image = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

  const response = await fetch(MOONSHOT_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MOONSHOT_API_KEY}`
    },
    body: JSON.stringify({
      model: MOONSHOT_MODEL,
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
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Moonshot request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const parsed = extractJson(extractTextFromResponse(payload));

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

  // Provider chain: Zhipu (primary) -> Moonshot (cloud fallback) -> Python (Docker microservice) -> Mock
  const providers = [
    { name: "zhipu", fn: recognizeWithZhipu }
  ];

  // Moonshot/Kimi as first cloud fallback (set MOONSHOT_API_KEY to enable)
  if (MOONSHOT_API_KEY) {
    providers.push({ name: "moonshot", fn: recognizeWithMoonshot });
  }

  // Python Docker microservice (set PYTHON_RECOGNITION_URL to enable, e.g. http://localhost:5100)
  if (PYTHON_RECOGNITION_URL) {
    providers.push({ name: "python", fn: recognizeWithPython });
  }

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

      // Skip to next provider for these cases:
      // 1. Missing API key - provider not configured
      // 2. AbortError/timeout - network issue, try next provider
      // 3. Non-retryable errors (4xx client errors except 429)
      if (error.message.includes("API_KEY is not configured")) {
        console.log(`[recognition] ${provider.name} API key not configured, falling back`);
        continue;
      }

      // If error has isRetryable flag, check it
      if (error.isRetryable === false) {
        // Non-retryable error (e.g., 4xx client error), don't try other providers for this cause
        console.log(`[recognition] ${provider.name} returned non-retryable error, giving up`);
        throw error;
      }

      // For retryable errors (timeout, 5xx), wait then try next provider
      console.log(`[recognition] ${provider.name} error is retryable, falling back to next provider`);
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
