/**
 * Rate Limiter and Request Queue System
 * 
 * Prevents hitting rate limits by:
 * 1. Tracking request counts per provider
 * 2. Queuing requests when limits are approaching
 * 3. Implementing exponential backoff
 * 4. Rotating multiple API keys
 */

interface RateLimitInfo {
  provider: string;
  model: string;
  requestsPerMinute: number;
  requestsPerDay: number;
  currentRPM: number;
  currentRPD: number;
  lastResetRPM: number; // Timestamp
  lastResetRPD: number; // Timestamp
  blockedUntil?: number; // Timestamp when provider is unblocked
}

interface QueuedRequest {
  prompt: string;
  config: any;
  executor: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

// Rate limit configurations per provider (conservative estimates)
const RATE_LIMITS: Record<string, Partial<RateLimitInfo>> = {
  groq: {
    requestsPerMinute: 25, // Conservative: 30 RPM free tier
    requestsPerDay: 14000, // Conservative: 14.4K/day free tier
  },
  gemini: {
    requestsPerMinute: 12, // Conservative: 15 RPM free tier
    requestsPerDay: 500000, // Conservative: 1M tokens/day ≈ 500K requests
  },
  huggingface: {
    requestsPerMinute: 10, // Conservative estimate
    requestsPerDay: 800, // Conservative: 1K/month ≈ 33/day, but allow burst
  },
  together: {
    requestsPerMinute: 20,
    requestsPerDay: 10000,
  },
  openrouter: {
    requestsPerMinute: 15,
    requestsPerDay: 5000,
  },
  moonshot: {
    requestsPerMinute: 10,
    requestsPerDay: 5000,
  },
};

// In-memory rate limit tracking
const rateLimitTracker = new Map<string, RateLimitInfo>();

// Request queues per provider
const requestQueues = new Map<string, QueuedRequest[]>();

// Processing flags
const processingQueues = new Map<string, boolean>();

/**
 * Get or create rate limit info for a provider
 */
function getRateLimitInfo(provider: string, model: string): RateLimitInfo {
  const key = `${provider}:${model}`;
  
  if (!rateLimitTracker.has(key)) {
    const defaults = RATE_LIMITS[provider] || {
      requestsPerMinute: 10,
      requestsPerDay: 1000,
    };
    
    rateLimitTracker.set(key, {
      provider,
      model,
      requestsPerMinute: defaults.requestsPerMinute || 10,
      requestsPerDay: defaults.requestsPerDay || 1000,
      currentRPM: 0,
      currentRPD: 0,
      lastResetRPM: Date.now(),
      lastResetRPD: Date.now(),
    });
  }
  
  return rateLimitTracker.get(key)!;
}

/**
 * Check if we can make a request now
 */
export function canMakeRequest(provider: string, model: string): { allowed: boolean; waitTime?: number } {
  const info = getRateLimitInfo(provider, model);
  const now = Date.now();
  
  // Check if provider is temporarily blocked
  if (info.blockedUntil && now < info.blockedUntil) {
    return {
      allowed: false,
      waitTime: info.blockedUntil - now,
    };
  }
  
  // Reset RPM counter if a minute has passed
  if (now - info.lastResetRPM > 60000) {
    info.currentRPM = 0;
    info.lastResetRPM = now;
  }
  
  // Reset RPD counter if a day has passed
  if (now - info.lastResetRPD > 86400000) {
    info.currentRPD = 0;
    info.lastResetRPD = now;
  }
  
  // Check limits
  const rpmAvailable = info.currentRPM < info.requestsPerMinute;
  const rpdAvailable = info.currentRPD < info.requestsPerDay;
  
  if (!rpmAvailable) {
    // Calculate wait time until next minute window
    const waitTime = 60000 - (now - info.lastResetRPM);
    return {
      allowed: false,
      waitTime,
    };
  }
  
  if (!rpdAvailable) {
    // Calculate wait time until next day window
    const waitTime = 86400000 - (now - info.lastResetRPD);
    return {
      allowed: false,
      waitTime,
    };
  }
  
  return { allowed: true };
}

/**
 * Record a successful request
 */
export function recordRequest(provider: string, model: string): void {
  const info = getRateLimitInfo(provider, model);
  info.currentRPM++;
  info.currentRPD++;
}

/**
 * Block a provider temporarily (e.g., after rate limit error)
 */
export function blockProvider(provider: string, model: string, durationMs: number): void {
  const info = getRateLimitInfo(provider, model);
  info.blockedUntil = Date.now() + durationMs;
  console.log(`[Rate Limiter] Blocked ${provider}/${model} for ${durationMs}ms`);
}

/**
 * Queue a request to be processed when rate limits allow
 */
export async function queueRequest<T>(
  provider: string,
  model: string,
  prompt: string,
  config: any,
  executor: () => Promise<T>
): Promise<T> {
  const key = `${provider}:${model}`;
  
  // Check if we can make the request immediately
  const check = canMakeRequest(provider, model);
  if (check.allowed) {
    try {
      const result = await executor();
      recordRequest(provider, model);
      return result;
    } catch (error: any) {
      // If it's a rate limit error, block but don't wait - throw immediately
      if (error.message?.includes("429") || error.message?.includes("rate limit") || error.message?.includes("quota")) {
        const blockDuration = error.message.match(/try again in ([\d.]+)s?/i)
          ? Math.ceil(parseFloat(error.message.match(/try again in ([\d.]+)s?/i)![1]) * 1000) + 1000
          : 60000;
        blockProvider(provider, model, blockDuration);
        // Don't wait - throw immediately so fallback can try next provider
        throw error;
      }
      throw error;
    }
  }
  
  // If rate limited, throw immediately (don't queue) so fallback can try next provider
  throw new Error(`Rate limited: ${provider}/${model} - wait ${Math.round((check.waitTime || 0) / 1000)}s`);
}

/**
 * Process queued requests for a provider
 */
async function processQueue(key: string): Promise<void> {
  if (processingQueues.get(key)) {
    return; // Already processing
  }
  
  processingQueues.set(key, true);
  const [provider, model] = key.split(":");
  const queue = requestQueues.get(key) || [];
  
  while (queue.length > 0) {
    const request = queue.shift()!;
    
    // Check if we can make the request
    const check = canMakeRequest(provider, model);
    
    if (!check.allowed) {
      // Wait until we can make the request
      const waitTime = check.waitTime || 1000;
      console.log(`[Rate Limiter] Waiting ${waitTime}ms before processing ${provider}/${model} request...`);
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 10000))); // Max 10s wait
      
      // Re-check after waiting
      const recheck = canMakeRequest(provider, model);
      if (!recheck.allowed) {
        // Re-queue the request
        queue.unshift(request);
        continue;
      }
    }
    
    // Execute the request using the executor from the request
    try {
      const result = await request.executor();
      recordRequest(provider, model);
      request.resolve(result);
    } catch (error: any) {
      // If rate limit error, block and re-queue
      if (error.message?.includes("429") || error.message?.includes("rate limit") || error.message?.includes("quota")) {
        const blockDuration = error.message.match(/try again in ([\d.]+)s?/i)
          ? Math.ceil(parseFloat(error.message.match(/try again in ([\d.]+)s?/i)![1]) * 1000) + 1000
          : 60000;
        
        blockProvider(provider, model, blockDuration);
        queue.unshift(request); // Re-queue
        continue;
      }
      
      request.reject(error);
    }
  }
  
  processingQueues.set(key, false);
}

/**
 * Get multiple API keys for a provider (for rotation)
 */
export function getAPIKeys(provider: string): string[] {
  const keys: string[] = [];
  
  switch (provider) {
    case "groq":
      if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
      if (process.env.GROQ_API_KEY_2) keys.push(process.env.GROQ_API_KEY_2);
      if (process.env.GROQ_API_KEY_3) keys.push(process.env.GROQ_API_KEY_3);
      break;
    case "gemini":
      if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
      if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
      if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3);
      break;
    case "huggingface":
      if (process.env.HUGGINGFACE_API_KEY) keys.push(process.env.HUGGINGFACE_API_KEY);
      if (process.env.HUGGINGFACE_API_KEY_2) keys.push(process.env.HUGGINGFACE_API_KEY_2);
      break;
    case "together":
      if (process.env.TOGETHER_API_KEY) keys.push(process.env.TOGETHER_API_KEY);
      if (process.env.TOGETHER_API_KEY_2) keys.push(process.env.TOGETHER_API_KEY_2);
      break;
    case "openrouter":
      if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
      if (process.env.OPENROUTER_API_KEY_2) keys.push(process.env.OPENROUTER_API_KEY_2);
      break;
    case "moonshot":
      if (process.env.MOONSHOT_API_KEY) keys.push(process.env.MOONSHOT_API_KEY);
      if (process.env.MOONSHOT_API_KEY_2) keys.push(process.env.MOONSHOT_API_KEY_2);
      break;
  }
  
  return keys;
}

/**
 * Get next API key for rotation (round-robin)
 */
const keyRotationIndex = new Map<string, number>();

export function getNextAPIKey(provider: string): string | undefined {
  const keys = getAPIKeys(provider);
  if (keys.length === 0) return undefined;
  
  const currentIndex = keyRotationIndex.get(provider) || 0;
  const nextKey = keys[currentIndex % keys.length];
  keyRotationIndex.set(provider, (currentIndex + 1) % keys.length);
  
  return nextKey;
}

/**
 * Reset rate limit tracking (useful for testing)
 */
export function resetRateLimits(): void {
  rateLimitTracker.clear();
  requestQueues.clear();
  processingQueues.clear();
  keyRotationIndex.clear();
}

