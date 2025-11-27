import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

type EnvKey =
  | "PERPLEXITY_API_KEY"
  | "GOOGLE_SHEETS_ID"
  | "GOOGLE_APPLICATION_CREDENTIALS";

const OPTIONAL_DEFAULTS = {
  PERPLEXITY_MODEL: "llama-3.1-sonar-large-128k-online",
  GOOGLE_SHEETS_TAB: "EngineeringTop100",
} as const;

const requireEnv = (key: EnvKey): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const toAbsolutePath = (maybeRelativePath: string): string => {
  if (path.isAbsolute(maybeRelativePath)) {
    return maybeRelativePath;
  }

  return path.join(process.cwd(), maybeRelativePath);
};

export const env = {
  perplexityApiKey: requireEnv("PERPLEXITY_API_KEY"),
  perplexityModel:
    process.env.PERPLEXITY_MODEL ?? OPTIONAL_DEFAULTS.PERPLEXITY_MODEL,
  googleSheetId: requireEnv("GOOGLE_SHEETS_ID"),
  googleSheetTab:
    process.env.GOOGLE_SHEETS_TAB ?? OPTIONAL_DEFAULTS.GOOGLE_SHEETS_TAB,
  googleCredentialsPath: toAbsolutePath(
    requireEnv("GOOGLE_APPLICATION_CREDENTIALS")
  ),
};
