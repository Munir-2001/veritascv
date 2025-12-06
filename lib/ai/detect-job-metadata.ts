/**
 * AI-Powered Job Metadata Detection
 * 
 * Detects job level and domain/industry from job description
 */

import { getAIConfig } from "@/lib/config/ai";
import type { JobLevel, Domain } from "@/lib/cv/strategy";

export interface JobMetadata {
  job_level: JobLevel;
  domain: Domain;
}

/**
 * Detect job level and domain from job description using AI
 */
export async function detectJobMetadata(
  job_description: string,
  job_title?: string
): Promise<JobMetadata> {
  const config = getAIConfig();

  if (config.provider !== "gemini") {
    // Fallback to basic detection if not using Gemini
    return detectJobMetadataBasic(job_description, job_title);
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(config.apiKey!);
    const modelName = config.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are an expert job analyst. Analyze this job posting and determine:

1. **JOB LEVEL** - Select ONE from:
   - "internship" - Internship, co-op, or trainee position
   - "entry" - Entry level, 0-2 years experience, "junior", "associate", "graduate"
   - "junior" - Junior level, 1-3 years, "junior developer", "junior engineer"
   - "mid" - Mid-level, 3-5 years, "mid-level", "experienced", "3+ years"
   - "senior" - Senior level, 5-8 years, "senior", "5+ years", "lead"
   - "lead" - Lead/Principal, 8+ years, "principal", "lead engineer", "tech lead"
   - "executive" - Executive/C-Suite, "director", "VP", "CTO", "CEO"

2. **DOMAIN/INDUSTRY** - Select ONE from:
   - "software-engineering" - Software development, programming, coding
   - "data-science" - Data science, ML, AI, analytics
   - "product-management" - Product management, product owner
   - "design" - UI/UX design, graphic design, visual design
   - "business" - Business analysis, consulting, strategy
   - "marketing" - Marketing, digital marketing, growth
   - "general" - General, not specific to above

JOB TITLE: ${job_title || "Not specified"}

JOB DESCRIPTION:
${job_description.substring(0, 3000)}${job_description.length > 3000 ? "\n[... truncated ...]" : ""}

Return ONLY valid JSON (no markdown, no explanation):
{
  "job_level": "mid",
  "domain": "software-engineering"
}`;

    console.log(`[Job Metadata Detection] Analyzing job description (${job_description.length} chars)...`);

    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();

    // Clean JSON response
    if (text.includes("```json")) {
      text = text.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    } else if (text.includes("```")) {
      text = text.replace(/```\n?/g, "");
    }

    const metadata = JSON.parse(text.trim());
    
    console.log(`[Job Metadata Detection] ✅ Detected:`, metadata);

    // Validate and normalize
    const validLevels: JobLevel[] = ["internship", "entry", "junior", "mid", "senior", "executive"];
    const validDomains: Domain[] = ["software-engineering", "data-science", "product-management", "design", "business", "marketing", "general"];

    // Map "lead" to "senior" (JobLevel type doesn't include "lead")
    let normalizedLevel = metadata.job_level;
    if (normalizedLevel === "lead") {
      normalizedLevel = "senior";
    }

    return {
      job_level: validLevels.includes(normalizedLevel as JobLevel) ? (normalizedLevel as JobLevel) : "mid",
      domain: validDomains.includes(metadata.domain) ? metadata.domain : "general",
    };
  } catch (error: any) {
    console.error(`[Job Metadata Detection] AI detection failed:`, error);
    // Fallback to basic detection
    return detectJobMetadataBasic(job_description, job_title);
  }
}

/**
 * Basic keyword-based detection (fallback)
 */
function detectJobMetadataBasic(
  job_description: string,
  job_title?: string
): JobMetadata {
  const text = (job_title + " " + job_description).toLowerCase();

  // Detect job level
  let job_level: JobLevel = "mid"; // Default

  if (text.match(/\b(internship|intern|co-op|trainee)\b/)) {
    job_level = "internship";
  } else if (text.match(/\b(entry[- ]level|graduate|0-2 years|0 to 2|junior|associate)\b/)) {
    job_level = "entry";
  } else if (text.match(/\b(junior|1-3 years|1 to 3)\b/)) {
    job_level = "junior";
  } else if (text.match(/\b(senior|5\+ years|5\+|lead engineer|principal|tech lead)\b/)) {
    job_level = "senior";
  } else if (text.match(/\b(lead|principal|8\+ years|architect)\b/)) {
    job_level = "senior"; // Map "lead" to "senior" (JobLevel type doesn't include "lead")
  } else if (text.match(/\b(director|vp|vice president|cto|ceo|executive|c-suite)\b/)) {
    job_level = "executive";
  }

  // Detect domain
  let domain: Domain = "general"; // Default

  if (text.match(/\b(software|developer|programmer|coding|engineer|full.?stack|backend|frontend)\b/)) {
    domain = "software-engineering";
  } else if (text.match(/\b(data science|machine learning|ml|ai|artificial intelligence|analytics|data analyst)\b/)) {
    domain = "data-science";
  } else if (text.match(/\b(product manager|product owner|pm|product management)\b/)) {
    domain = "product-management";
  } else if (text.match(/\b(ui|ux|designer|graphic design|visual design|user experience)\b/)) {
    domain = "design";
  } else if (text.match(/\b(business analyst|consultant|strategy|business development)\b/)) {
    domain = "business";
  } else if (text.match(/\b(marketing|digital marketing|growth|seo|sem)\b/)) {
    domain = "marketing";
  }

  console.log(`[Job Metadata Detection] Basic detection:`, { job_level, domain });

  return { job_level, domain };
}

