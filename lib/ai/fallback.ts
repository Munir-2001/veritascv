/**
 * AI Fallback System
 * 
 * Automatically switches between free AI providers when one fails
 * Supports multiple providers with fallback chain
 */

import { AIConfig, AIProvider } from "@/lib/config/ai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface FallbackConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
  priority: number; // Lower = higher priority
}

/**
 * Free AI Provider Configurations
 * 
 * FREE TIER LIMITS:
 * 1. Gemini (Google): 15 RPM, 1M tokens/day (free tier)
 * 2. Groq: 30 RPM, 14,400 requests/day (very generous free tier)
 * 3. Hugging Face: 1,000 requests/month (free tier)
 * 4. Together AI: $25 free credits (one-time)
 * 5. OpenRouter: $5 free credits (one-time)
 * 6. Anthropic: Limited free tier
 * 
 * RECOMMENDED ORDER (best free options first):
 * 1. Groq (fastest, most generous free tier)
 * 2. Gemini (good quality, decent free tier)
 * 3. Hugging Face (backup option)
 * 4. Together AI (if credits available)
 */
export const FREE_AI_PROVIDERS: FallbackConfig[] = [
  // Priority 1: Groq (FASTEST, most generous free tier - 30 RPM, 14.4K requests/day)
  {
    provider: "groq",
    model: "llama-3.1-70b-versatile", // Best quality
    priority: 1,
  },
  {
    provider: "groq",
    model: "llama-3.1-8b-instant", // Fastest
    priority: 2,
  },
  {
    provider: "groq",
    model: "mixtral-8x7b-32768", // Alternative
    priority: 3,
  },
  
  // Priority 2: Gemini (Good quality, 15 RPM free tier)
  {
    provider: "gemini",
    model: "gemini-2.0-flash", // Fast, free tier
    priority: 4,
  },
  {
    provider: "gemini",
    model: "gemini-1.5-flash", // Alternative
    priority: 5,
  },
  {
    provider: "gemini",
    model: "gemini-1.5-pro", // Higher quality (if available)
    priority: 6,
  },
  
  // Priority 3: Hugging Face (1K requests/month free)
  {
    provider: "huggingface",
    model: "meta-llama/Llama-3.1-8B-Instruct",
    priority: 7,
  },
  
  // Priority 4: Together AI (if credits available)
  {
    provider: "together",
    model: "meta-llama/Llama-3-70b-chat-hf",
    priority: 8,
  },
  
  // Priority 5: OpenRouter (if credits available)
  {
    provider: "openrouter",
    model: "google/gemini-2.0-flash-exp:free",
    priority: 9,
  },
];

/**
 * Get fallback configurations from environment variables
 * Allows users to configure their own fallback chain
 */
export function getFallbackConfigs(): FallbackConfig[] {
  const configs: FallbackConfig[] = [];
  
  // Check for Groq
  if (process.env.GROQ_API_KEY) {
    configs.push({
      provider: "groq",
      model: process.env.GROQ_MODEL || "llama-3.1-70b-versatile",
      apiKey: process.env.GROQ_API_KEY,
      priority: 1,
    });
    if (process.env.GROQ_MODEL_2) {
      configs.push({
        provider: "groq",
        model: process.env.GROQ_MODEL_2,
        apiKey: process.env.GROQ_API_KEY,
        priority: 2,
      });
    }
  }
  
  // Check for Gemini (multiple API keys possible)
  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GOOGLE_GEMINI_API_KEY,
  ].filter(Boolean);
  
  geminiKeys.forEach((key, idx) => {
    configs.push({
      provider: "gemini",
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      apiKey: key,
      priority: 3 + idx,
    });
  });
  
  // Check for Hugging Face
  if (process.env.HUGGINGFACE_API_KEY) {
    configs.push({
      provider: "huggingface",
      model: process.env.HUGGINGFACE_MODEL || "meta-llama/Llama-3.1-8B-Instruct",
      apiKey: process.env.HUGGINGFACE_API_KEY,
      priority: 10,
    });
  }
  
  // Check for Together AI
  if (process.env.TOGETHER_API_KEY) {
    configs.push({
      provider: "together",
      model: process.env.TOGETHER_MODEL || "meta-llama/Llama-3-70b-chat-hf",
      apiKey: process.env.TOGETHER_API_KEY,
      priority: 11,
    });
  }
  
  // Check for OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    configs.push({
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free",
      apiKey: process.env.OPENROUTER_API_KEY,
      priority: 12,
    });
  }
  
  // Sort by priority
  configs.sort((a, b) => a.priority - b.priority);
  
  return configs.length > 0 ? configs : FREE_AI_PROVIDERS;
}

/**
 * Call AI with automatic fallback
 * Tries providers in order until one succeeds
 */
export async function callAIWithFallback(
  prompt: string,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
    preferredProvider?: AIProvider;
  }
): Promise<{ text: string; provider: AIProvider; model: string }> {
  const maxRetries = options?.maxRetries || 3;
  const retryDelay = options?.retryDelay || 1000; // 1 second
  const fallbackConfigs = getFallbackConfigs();
  
  // If preferred provider is set, prioritize it
  if (options?.preferredProvider) {
    const preferred = fallbackConfigs.find(c => c.provider === options.preferredProvider);
    if (preferred) {
      fallbackConfigs.sort((a, b) => {
        if (a.provider === options.preferredProvider) return -1;
        if (b.provider === options.preferredProvider) return 1;
        return a.priority - b.priority;
      });
    }
  }
  
  const errors: Array<{ provider: AIProvider; model: string; error: string }> = [];
  
  for (const config of fallbackConfigs) {
    // Skip if no API key
    if (!config.apiKey && config.provider !== "local") {
      console.log(`[AI Fallback] Skipping ${config.provider}/${config.model} - no API key`);
      continue;
    }
    
    console.log(`[AI Fallback] Trying ${config.provider}/${config.model}...`);
    
    try {
      const text = await callAIProvider(prompt, config);
      console.log(`[AI Fallback] ✅ Success with ${config.provider}/${config.model}`);
      return { text, provider: config.provider, model: config.model };
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error(`[AI Fallback] ❌ ${config.provider}/${config.model} failed: ${errorMsg}`);
      errors.push({ provider: config.provider, model: config.model, error: errorMsg });
      
      // If it's a quota/rate limit error, wait before trying next
      if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limit")) {
        console.log(`[AI Fallback] Rate limit hit, waiting ${retryDelay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
      // Continue to next provider
      continue;
    }
  }
  
  // All providers failed
  throw new Error(
    `All AI providers failed!\n` +
    `Errors:\n${errors.map(e => `  - ${e.provider}/${e.model}: ${e.error}`).join("\n")}\n\n` +
    `Please check your API keys and quotas. Free tier options:\n` +
    `1. Groq: https://console.groq.com/ (30 RPM, 14.4K requests/day)\n` +
    `2. Gemini: https://aistudio.google.com/apikey (15 RPM, 1M tokens/day)\n` +
    `3. Hugging Face: https://huggingface.co/settings/tokens (1K requests/month)`
  );
}

/**
 * Call specific AI provider
 */
async function callAIProvider(prompt: string, config: FallbackConfig): Promise<string> {
  switch (config.provider) {
    case "gemini":
      return await callGeminiProvider(prompt, config);
    case "groq":
      return await callGroqProvider(prompt, config);
    case "huggingface":
      return await callHuggingFaceProvider(prompt, config);
    case "together":
      return await callTogetherProvider(prompt, config);
    case "openrouter":
      return await callOpenRouterProvider(prompt, config);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

/**
 * Call Gemini API
 */
async function callGeminiProvider(prompt: string, config: FallbackConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("Gemini API key not provided");
  }
  
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ model: config.model });
  
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

/**
 * Call Groq API (OpenAI-compatible)
 */
async function callGroqProvider(prompt: string, config: FallbackConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("Groq API key not provided");
  }
  
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Call Hugging Face Inference API
 */
async function callHuggingFaceProvider(prompt: string, config: FallbackConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("Hugging Face API key not provided");
  }
  
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${config.model}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hugging Face API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  // HF returns array format
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text;
  }
  return JSON.stringify(data);
}

/**
 * Call Together AI API
 */
async function callTogetherProvider(prompt: string, config: FallbackConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("Together AI API key not provided");
  }
  
  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Together AI API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Call OpenRouter API
 */
async function callOpenRouterProvider(prompt: string, config: FallbackConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("OpenRouter API key not provided");
  }
  
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

