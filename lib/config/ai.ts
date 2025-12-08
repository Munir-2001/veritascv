/**
 * AI Configuration for CV Tailoring
 * 
 * Supported providers:
 * - Google Gemini (FREE tier available, excellent quality)
 * - Groq (FREE, Fast - Llama 3.1, Mixtral)
 * - OpenAI (GPT-4, GPT-3.5-turbo)
 * - Anthropic (Claude)
 * - Local/Open Source (Ollama, etc.)
 */

export type AIProvider = "gemini" | "groq" | "openai" | "anthropic" | "local" | "huggingface" | "together" | "openrouter" | "moonshot";

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Get AI configuration from environment variables
 */
export function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER || "groq") as AIProvider; // Default to Groq (fastest, most reliable)

  const config: AIConfig = {
    provider,
    model: "", // Will be set in switch statement
    temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || "2000"),
  };

  switch (provider) {
    case "gemini":
      // Support both GEMINI_API_KEY and GOOGLE_GEMINI_API_KEY
      config.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
      config.baseURL = process.env.GEMINI_BASE_URL;
      // Use GEMINI_MODEL from env, or AI_MODEL, or default to gemini-2.0-flash (valid model)
      // Valid models: gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash, gemini-2.0-flash-exp
      config.model = process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-2.0-flash";
      break;

    case "groq":
      config.apiKey = process.env.GROQ_API_KEY;
      config.baseURL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
      config.model = process.env.AI_MODEL || "llama-3.3-70b-versatile"; // Updated to current model
      break;

    case "openai":
      config.apiKey = process.env.OPENAI_API_KEY;
      config.baseURL = process.env.OPENAI_BASE_URL;
      config.model = process.env.AI_MODEL || "gpt-4o-mini";
      break;

    case "anthropic":
      config.apiKey = process.env.ANTHROPIC_API_KEY;
      config.baseURL = process.env.ANTHROPIC_BASE_URL;
      config.model = process.env.AI_MODEL || "claude-3-5-sonnet-20241022";
      break;

    case "local":
      config.baseURL = process.env.LOCAL_AI_BASE_URL || "http://localhost:11434";
      config.model = process.env.AI_MODEL || process.env.LOCAL_AI_MODEL || "llama2";
      break;
  }

  return config;
}

/**
 * Recommended models for CV tailoring:
 * 
 * OpenAI:
 * - gpt-4o-mini (Fast, cost-effective, good quality)
 * - gpt-4o (Best quality, more expensive)
 * - gpt-3.5-turbo (Cheapest, decent quality)
 * 
 * Anthropic:
 * - claude-3-5-sonnet-20241022 (Best quality, great for writing)
 * - claude-3-opus-20240229 (Premium, highest quality)
 * - claude-3-haiku-20240307 (Fast, cost-effective)
 * 
 * Local (Ollama):
 * - llama3.2 (Good open-source option)
 * - mistral (Fast, efficient)
 * - codellama (For technical resumes)
 */

