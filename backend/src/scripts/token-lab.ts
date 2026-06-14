import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

import { loadConfig } from "../config.js";

interface TokenExperiment {
  name: string;
  prompt: string;
}

const experiments: TokenExperiment[] = [
  {
    name: "short-en",
    prompt: "Explain an LLM token in one short sentence."
  },
  {
    name: "short-vi",
    prompt: "Giải thích token của mô hình ngôn ngữ trong đúng một câu ngắn."
  },
  {
    name: "code",
    prompt: "Explain this TypeScript code briefly: const total = prices.reduce((a, b) => a + b, 0);"
  },
  {
    name: "long-vi",
    prompt: `${"Một hệ thống AI production cần theo dõi latency, token usage, chi phí và lỗi provider. ".repeat(40)}Tóm tắt nội dung trên trong một câu.`
  }
];

const config = loadConfig();
if (!config.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is required for the token lab");
}

const client = new GoogleGenAI({
  apiKey: config.GEMINI_API_KEY,
  httpOptions: { timeout: config.LLM_TIMEOUT_SECONDS * 1_000 }
});

const model = await client.models.get({ model: config.GEMINI_MODEL });
console.log("Model context limits");
console.table({
  model: model.name ?? config.GEMINI_MODEL,
  inputTokenLimit: model.inputTokenLimit ?? "unknown",
  outputTokenLimit: model.outputTokenLimit ?? "unknown"
});

const results = [];
for (const experiment of experiments) {
  const wordCount = experiment.prompt.trim().split(/\s+/u).length;
  const characterCount = [...experiment.prompt].length;
  const count = await client.models.countTokens({
    model: config.GEMINI_MODEL,
    contents: experiment.prompt
  });

  const startedAt = performance.now();
  const response = await client.models.generateContent({
    model: config.GEMINI_MODEL,
    contents: experiment.prompt,
    config: {
      systemInstruction: "Answer concisely in the same language as the user.",
      maxOutputTokens: 200
    }
  });

  results.push({
    experiment: experiment.name,
    characters: characterCount,
    words: wordCount,
    countedInputTokens: count.totalTokens ?? 0,
    billedInputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    thinkingTokens: response.usageMetadata?.thoughtsTokenCount ?? 0,
    totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    latencyMs: Math.round(performance.now() - startedAt)
  });
}

console.log("Token experiments");
console.table(results);

