/**
 * AI Fallback System
 * 
 * Automatically switches between free AI providers when one fails
 * Supports multiple providers with fallback chain
 */

import { AIConfig, AIProvider } from "@/lib/config/ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { canMakeRequest, recordRequest, blockProvider, getNextAPIKey } from "./rate-limiter";

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
 * 4. Together AI: $25 free credits (one-time) - includes Kimi-k2
 * 5. Moonshot AI: Kimi-k2 official provider (check pricing)
 * 6. OpenRouter: $5 free credits (one-time) - includes Kimi-k2
 * 7. Anthropic: Limited free tier
 * 
 * RECOMMENDED ORDER (best free options first):
 * 1. Groq (fastest, most generous free tier)
 * 2. Gemini (good quality, decent free tier)
 * 3. Hugging Face (backup option)
 * 4. Together AI (if credits available) - includes Kimi-k2
 * 5. Moonshot AI (Kimi-k2 official)
 * 6. OpenRouter (if credits available) - includes Kimi-k2
 */
export const FREE_AI_PROVIDERS: FallbackConfig[] = [
  // Priority 1: Groq (FASTEST, most generous free tier - 30 RPM, 14.4K requests/day) - DEFAULT
  {
    provider: "groq",
    model: "llama-3.3-70b-versatile", // Current best quality (replaces llama-3.1-70b-versatile)
    priority: 1,
  },
  {
    provider: "groq",
    model: "llama-3.1-8b-instant", // Fastest fallback
    priority: 2,
  },
  {
    provider: "groq",
    model: "llama-3.1-70b-versatile", // Fallback (may be decommissioned)
    priority: 3,
  },
  {
    provider: "groq",
    model: "mixtral-8x7b-32768", // Alternative
    priority: 4,
  },
  
  // Priority 2: Gemini (Good quality, 15 RPM free tier) - Only if Groq fails
  {
    provider: "gemini",
    model: "gemini-2.0-flash", // Fast, free tier
    priority: 5,
  },
  {
    provider: "gemini",
    model: "gemini-1.5-flash", // Alternative
    priority: 6,
  },
  {
    provider: "gemini",
    model: "gemini-1.5-pro", // Higher quality (if available)
    priority: 7,
  },
  
  // Priority 3: Hugging Face (1K requests/month free) - Note: Limited free tier
  {
    provider: "huggingface",
    model: "meta-llama/Llama-3.1-8B-Instruct",
    priority: 8,
  },
  
  // Priority 4: Together AI (if credits available) - includes Kimi-k2
  {
    provider: "together",
    model: "meta-llama/Llama-3-70b-chat-hf",
    priority: 9,
  },
  {
    provider: "together",
    model: "Qwen/Qwen2.5-72B-Instruct", // Kimi-k2 alternative on Together
    priority: 9,
  },
  
  // Priority 5: Moonshot AI (Kimi-k2 official provider)
  {
    provider: "moonshot",
    model: "kimi-k2", // Official Kimi-k2 model
    priority: 10,
  },
  
  // Priority 6: OpenRouter (if credits available) - includes Kimi-k2
  {
    provider: "openrouter",
    model: "google/gemini-2.0-flash-exp:free",
    priority: 11,
  },
  {
    provider: "openrouter",
    model: "moonshot/kimi-k2", // Kimi-k2 via OpenRouter
    priority: 11,
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
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile", // Updated to current model
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
    // Add Kimi-k2 option if available
    if (process.env.OPENROUTER_MODEL_KIMI) {
      configs.push({
        provider: "openrouter",
        model: process.env.OPENROUTER_MODEL_KIMI || "moonshot/kimi-k2",
        apiKey: process.env.OPENROUTER_API_KEY,
        priority: 13,
      });
    }
  }
  
  // Check for Moonshot AI (Kimi-k2 official)
  if (process.env.MOONSHOT_API_KEY) {
    configs.push({
      provider: "moonshot",
      model: process.env.MOONSHOT_MODEL || "kimi-k2",
      apiKey: process.env.MOONSHOT_API_KEY,
      priority: 11,
    });
  }
  
  // Check for Together AI - add Kimi-k2 option
  if (process.env.TOGETHER_API_KEY) {
    configs.push({
      provider: "together",
      model: process.env.TOGETHER_MODEL || "meta-llama/Llama-3-70b-chat-hf",
      apiKey: process.env.TOGETHER_API_KEY,
      priority: 11,
    });
    // Add Kimi-k2 via Together if specified
    if (process.env.TOGETHER_MODEL_KIMI) {
      configs.push({
        provider: "together",
        model: process.env.TOGETHER_MODEL_KIMI || "Qwen/Qwen2.5-72B-Instruct",
        apiKey: process.env.TOGETHER_API_KEY,
        priority: 12,
      });
    }
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
  
  // Sequential attempts - try each provider one by one, skip rate-limited immediately
  const MAX_TIMEOUT_PER_PROVIDER = 15000; // 15 seconds max per provider
  const MAX_TOTAL_TIME = 45000; // 45 seconds total max
  const startTime = Date.now();
  
  for (const config of fallbackConfigs) {
    // Check total timeout
    if (Date.now() - startTime > MAX_TOTAL_TIME) {
      console.log(`[AI Fallback] Total timeout reached (${MAX_TOTAL_TIME}ms), stopping...`);
      break;
    }
    
    // Try to get API key (with rotation support)
    let apiKey = config.apiKey;
    if (!apiKey && config.provider !== "local") {
      apiKey = getNextAPIKey(config.provider);
      if (!apiKey) {
        console.log(`[AI Fallback] Skipping ${config.provider}/${config.model} - no API key`);
        continue;
      }
      config.apiKey = apiKey;
    }
    
    // Check rate limits - skip immediately if blocked (NO WAITING)
    const rateLimitCheck = canMakeRequest(config.provider, config.model);
    if (!rateLimitCheck.allowed) {
      console.log(`[AI Fallback] ⏭️ Skipping ${config.provider}/${config.model} - rate limited (wait ${Math.round((rateLimitCheck.waitTime || 0) / 1000)}s)`);
      continue; // Skip immediately, try next provider
    }
    
    console.log(`[AI Fallback] Trying ${config.provider}/${config.model}...`);
    
    try {
      // Direct call with timeout - no queue system
      const text = await Promise.race([
        callAIProvider(prompt, config),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Request timeout")), MAX_TIMEOUT_PER_PROVIDER)
        )
      ]);
      
      recordRequest(config.provider, config.model);
      console.log(`[AI Fallback] ✅ Success with ${config.provider}/${config.model}`);
      return { text, provider: config.provider, model: config.model };
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error(`[AI Fallback] ❌ ${config.provider}/${config.model} failed: ${errorMsg}`);
      errors.push({ provider: config.provider, model: config.model, error: errorMsg });
      
      // Handle rate limit errors - block but continue to next provider immediately
      if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limit")) {
        let blockDuration = 60000; // Default: 1 minute
        const retryMatch = errorMsg.match(/try again in ([\d.]+)s?/i);
        if (retryMatch) {
          blockDuration = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000;
        } else if (errorMsg.includes("TPM") || errorMsg.includes("tokens per minute")) {
          blockDuration = 120000; // 2 minutes for TPM
        }
        blockProvider(config.provider, config.model, blockDuration);
        console.log(`[AI Fallback] Blocked ${config.provider}/${config.model} for ${blockDuration}ms, moving to next provider...`);
        continue; // Move to next provider immediately
      }
      
      // Handle permanently exhausted quotas
      if (errorMsg.includes("limit: 0")) {
        blockProvider(config.provider, config.model, 86400000); // 24 hours
        console.log(`[AI Fallback] Quota exhausted for ${config.provider}/${config.model}, moving to next provider...`);
        continue; // Move to next provider immediately
      }
      
      // For other errors (timeout, network, etc.), continue to next provider
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
    `3. Hugging Face: https://huggingface.co/settings/tokens (1K requests/month)\n` +
    `4. Moonshot AI (Kimi-k2): https://platform.moonshot.cn/ (check pricing)\n` +
    `5. Together AI: https://api.together.xyz/ ($25 free credits, includes Kimi-k2)\n` +
    `6. OpenRouter: https://openrouter.ai/ ($5 free credits, includes Kimi-k2)`
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
    case "moonshot":
      return await callMoonshotProvider(prompt, config);
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
 * Groq works better with system + user messages format
 */
async function callGroqProvider(prompt: string, config: FallbackConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("Groq API key not provided");
  }
  
  // For Groq, split the prompt into system and user messages for better results
  // Look for the main task instruction (usually after context)
  const systemPrompt = `You are an expert resume writer and career coach. Your task is to extract and optimize information from resumes. Follow the instructions carefully and return ONLY valid JSON as requested.`;
  
  // The full prompt is the user message
  const userMessage = prompt;
  
  console.log(`[Groq] Sending prompt (length: ${prompt.length} chars) to ${config.model}`);
  console.log(`[Groq] Prompt includes rawText: ${prompt.includes("CANDIDATE'S RESUME (raw text):")}`);
  
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.3, // Lower temperature for more consistent JSON output
      max_tokens: 4000, // Increase max tokens to handle longer responses
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`[Groq] API error (${response.status}): ${error}`);
    throw new Error(`Groq API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  const result = data.choices[0]?.message?.content || "";
  console.log(`[Groq] Received response (length: ${result.length} chars)`);
  return result;
}

/**
 * Call Hugging Face Inference API (using new router endpoint)
 */
async function callHuggingFaceProvider(prompt: string, config: FallbackConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("Hugging Face API key not provided");
  }
  
  // Use new router endpoint (api-inference.huggingface.co is deprecated)
  const response = await fetch(
    `https://router.huggingface.co/models/${config.model}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        inputs: prompt,
        parameters: {
          max_new_tokens: 1000,
          temperature: 0.7,
        }
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hugging Face API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  // HF router returns different format - check for generated_text
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text;
  }
  if (data.generated_text) {
    return data.generated_text;
  }
  if (typeof data === 'string') {
    return data;
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

/**
 * Call Moonshot AI API (Kimi-k2 official provider)
 */
async function callMoonshotProvider(prompt: string, config: FallbackConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("Moonshot API key not provided");
  }
  
  // Moonshot AI uses OpenAI-compatible API
  const baseURL = config.baseURL || "https://api.moonshot.cn/v1";
  
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model || "kimi-k2",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Moonshot API error (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

