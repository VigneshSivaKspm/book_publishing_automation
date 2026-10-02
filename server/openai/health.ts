import { config, openaiConfigured } from "../config.ts";
import { classifyError, getOpenAI } from "./client.ts";

export interface OpenAiHealth {
  configured: boolean;
  reachable: boolean;
  models: Record<string, { name: string; available: boolean; error?: string }>;
  error: string | null;
  errorCode: string | null;
}

/** Real server-side connection test: lists the configured models. Never returns the key. */
export async function checkOpenAi(): Promise<OpenAiHealth> {
  const roles = { ocr: config.ocrModel, structure: config.structureModel, validation: config.validationModel };
  const result: OpenAiHealth = { configured: openaiConfigured(), reachable: false, models: {}, error: null, errorCode: null };
  if (!result.configured) {
    result.error = "OPENAI_API_KEY is not set in the server environment.";
    result.errorCode = "not_configured";
    return result;
  }
  const client = getOpenAI();
  for (const [role, name] of Object.entries(roles)) {
    try {
      await client.models.retrieve(name, { timeout: 15_000 });
      result.models[role] = { name, available: true };
      result.reachable = true;
    } catch (err) {
      const f = classifyError(err);
      result.models[role] = { name, available: false, error: f.message };
      if (f.code !== "model_not_found") {
        result.error = f.message;
        result.errorCode = f.code;
      } else {
        result.reachable = true;
      }
    }
  }
  return result;
}
