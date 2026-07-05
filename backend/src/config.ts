import "dotenv/config";

import { z } from "zod";

const booleanEnvironmentValue = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return value;
}, z.boolean());

const environmentSchema = z
  .object({
    APP_ENV: z.string().default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().positive().default(8000),
    LLM_PROVIDER: z.enum(["fake", "openai", "gemini"]).default("fake"),
    LLM_FALLBACK_PROVIDER: z.enum(["none", "fake", "openai", "gemini"]).default("none"),
    LLM_TIMEOUT_SECONDS: z.coerce.number().positive().default(30),
    LLM_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
    LLM_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(0).default(250),
    LLM_RETRY_MAX_DELAY_MS: z.coerce.number().int().min(0).default(2_000),
    LLM_RETRY_JITTER_RATIO: z.coerce.number().min(0).max(1).default(0.2),
    CHAT_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(20),
    CHAT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    CHAT_CACHE_TTL_MS: z.coerce.number().int().min(0).default(0),
    OPENAI_INPUT_USD_PER_1M_TOKENS: z.coerce.number().min(0).default(0),
    OPENAI_OUTPUT_USD_PER_1M_TOKENS: z.coerce.number().min(0).default(0),
    OPENAI_THINKING_USD_PER_1M_TOKENS: z.coerce.number().min(0).default(0),
    GEMINI_INPUT_USD_PER_1M_TOKENS: z.coerce.number().min(0).default(0),
    GEMINI_OUTPUT_USD_PER_1M_TOKENS: z.coerce.number().min(0).default(0),
    GEMINI_THINKING_USD_PER_1M_TOKENS: z.coerce.number().min(0).default(0),
    FILE_TOOL_ALLOWED_ROOTS: z.string().default(""),
    FILE_TOOL_ALLOW_WRITE: booleanEnvironmentValue.default(false),
    FILE_TOOL_ALLOW_DELETE: booleanEnvironmentValue.default(false),
    FILE_AGENT_AUTO_APPLY_WRITES: booleanEnvironmentValue.default(false),
    FILE_TOOL_MAX_FILE_BYTES: z.coerce.number().int().positive().default(1_000_000),
    DATABASE_URL: z.string().url().optional(),
    DATABASE_SSL: booleanEnvironmentValue.default(false),
    DATABASE_RUN_MIGRATIONS: booleanEnvironmentValue.default(false),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash")
  })
  .superRefine((environment, context) => {
    if (environment.LLM_PROVIDER === "openai" && !environment.OPENAI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when LLM_PROVIDER=openai"
      });
    }
    if (environment.LLM_PROVIDER === "gemini" && !environment.GEMINI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GEMINI_API_KEY"],
        message: "GEMINI_API_KEY is required when LLM_PROVIDER=gemini"
      });
    }
    if (environment.LLM_FALLBACK_PROVIDER === "openai" && !environment.OPENAI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when LLM_FALLBACK_PROVIDER=openai"
      });
    }
    if (environment.LLM_FALLBACK_PROVIDER === "gemini" && !environment.GEMINI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GEMINI_API_KEY"],
        message: "GEMINI_API_KEY is required when LLM_FALLBACK_PROVIDER=gemini"
      });
    }
  });

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return environmentSchema.parse(environment);
}
