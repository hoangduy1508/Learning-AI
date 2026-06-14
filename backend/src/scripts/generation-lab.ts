import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

import { loadConfig } from "../config.js";

interface GenerationOptions {
  name: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

const config = loadConfig();
if (!config.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is required for the generation lab");
}

const client = new GoogleGenAI({
  apiKey: config.GEMINI_API_KEY,
  httpOptions: { timeout: config.LLM_TIMEOUT_SECONDS * 1_000 }
});

const minimumRequestIntervalMs = 13_000;
let lastRequestStartedAt = 0;

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function respectFreeTierRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastRequestStartedAt;
  if (lastRequestStartedAt > 0 && elapsed < minimumRequestIntervalMs) {
    await wait(minimumRequestIntervalMs - elapsed);
  }
  lastRequestStartedAt = Date.now();
}

async function generate(options: GenerationOptions) {
  await respectFreeTierRateLimit();
  const startedAt = performance.now();
  let response;
  try {
    response = await client.models.generateContent({
      model: config.GEMINI_MODEL,
      contents: options.prompt,
      config: {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens ?? 120,
        stopSequences: options.stopSequences,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 429) {
      throw error;
    }

    console.log("Rate limit reached; waiting 30 seconds before one retry.");
    await wait(30_000);
    lastRequestStartedAt = Date.now();
    response = await client.models.generateContent({
      model: config.GEMINI_MODEL,
      contents: options.prompt,
      config: {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens ?? 120,
        stopSequences: options.stopSequences,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
  }

  const text = response.text ?? "";
  return {
    experiment: options.name,
    temperature: options.temperature ?? "default",
    maxOutputTokens: options.maxOutputTokens ?? 120,
    finishReason: response.candidates?.[0]?.finishReason ?? "unknown",
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    latencyMs: Math.round(performance.now() - startedAt),
    output: text.replace(/\s+/gu, " ").trim().slice(0, 180)
  };
}

console.log("1. System instruction controls role and response style");
console.table([
  await generate({
    name: "beginner-role",
    prompt: "Explain what an API is.",
    systemInstruction: "Teach a 10-year-old using one simple analogy. Use one sentence.",
    temperature: 0
  }),
  await generate({
    name: "senior-role",
    prompt: "Explain what an API is.",
    systemInstruction:
      "Answer a senior backend engineer. Focus on contracts, boundaries, and failure modes. Use one sentence.",
    temperature: 0
  })
]);

console.log("2. Temperature influences sampling diversity");
const creativePrompt =
  "Write one short product name for an AI assistant that searches internal company documents.";
console.table([
  await generate({ name: "temperature-0", prompt: creativePrompt, temperature: 0 }),
  await generate({ name: "temperature-1.5-a", prompt: creativePrompt, temperature: 1.5 }),
  await generate({ name: "temperature-1.5-b", prompt: creativePrompt, temperature: 1.5 })
]);

console.log("3. maxOutputTokens is a hard generation budget");
const explanationPrompt =
  "Explain retrieval-augmented generation in approximately 100 words without using a list.";
console.table([
  await generate({
    name: "output-limit-12",
    prompt: explanationPrompt,
    temperature: 0,
    maxOutputTokens: 12
  }),
  await generate({
    name: "output-limit-100",
    prompt: explanationPrompt,
    temperature: 0,
    maxOutputTokens: 100
  })
]);

console.log("4. A stop sequence ends generation when the marker is produced");
console.table([
  await generate({
    name: "stop-sequence",
    prompt: "Output exactly this text and nothing else: alpha STOP_MARKER beta",
    temperature: 0,
    stopSequences: ["STOP_MARKER"]
  })
]);
