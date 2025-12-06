import { NextRequest, NextResponse } from "next/server";
import { tailorResumeWithFocusedPrompts } from "@/lib/ai/tailor-focused";
import { detectJobMetadata } from "@/lib/ai/detect-job-metadata";

/**
 * API Route: POST /api/resumes/tailor
 * 
 * Tailors a resume based on a job description using AI.
 * 
 * Supports multiple AI providers:
 * - OpenAI (GPT-4, GPT-3.5-turbo)
 * - Anthropic (Claude)
 * - Local AI (Ollama)
 * 
 * Configure via environment variables:
 * - AI_PROVIDER: "openai" | "anthropic" | "local"
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY
 * - AI_MODEL: model name (e.g., "gpt-4o-mini", "claude-3-5-sonnet-20241022")
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      resume_id,
      raw_text, // Primary source - complete raw text
      resume_text, // Fallback if raw_text not provided
      structured_data,
      job_description,
      job_title,
      job_level,
      domain,
      company_name,
      company_description,
      additional_context,
    } = body;

    // Use raw_text as primary source (it's complete), fallback to resume_text
    const primaryText = raw_text || resume_text;

    console.log(`[Tailor API] Request received:`, {
      raw_text_length: raw_text?.length || 0,
      resume_text_length: resume_text?.length || 0,
      using: raw_text ? "raw_text" : "resume_text",
      job_title,
      job_level,
      domain,
      company_name,
      has_structured_data: !!structured_data,
    });

    if (!primaryText || !job_description) {
      return NextResponse.json(
        { error: "Missing required fields: raw_text (or resume_text) and job_description" },
        { status: 400 }
      );
    }

    // Detect job level and domain from job description if not provided
    let detectedJobLevel = job_level;
    let detectedDomain = domain;

    if (!job_level || !domain) {
      console.log(`[Tailor API] Detecting job level and domain from job description...`);
      try {
        const metadata = await detectJobMetadata(job_description, job_title);
        detectedJobLevel = job_level || metadata.job_level;
        detectedDomain = domain || metadata.domain;
        console.log(`[Tailor API] ✅ Detected: level=${detectedJobLevel}, domain=${detectedDomain}`);
      } catch (error: any) {
        console.error(`[Tailor API] Detection failed:`, error);
        // Use defaults
        detectedJobLevel = job_level || "mid";
        detectedDomain = domain || "general";
      }
    }

    // Use focused prompts to tailor the resume
    try {
      const result = await tailorResumeWithFocusedPrompts({
        raw_text: primaryText,
        structured_data: structured_data || {},
        job_description,
        job_title,
        job_level: detectedJobLevel,
        domain: detectedDomain,
        company_name,
        company_description,
        additional_context,
        template: body.template || "modern", // Pass template for style
      });

      // Return structured sections (not just text)
      return NextResponse.json({
        tailored_sections: result.sections, // Structured data
        tailored_resume: JSON.stringify(result.sections, null, 2), // Also as JSON string for compatibility
        keywords_matched: result.keywords_matched,
        suggestions: result.suggestions,
        resume_id: resume_id,
        detected_job_level: detectedJobLevel, // Return detected values
        detected_domain: detectedDomain,
      });
    } catch (aiError: any) {
      console.error("AI tailoring error:", aiError);
      
      // Fallback to basic tailoring if AI fails
      console.log("Falling back to basic tailoring...");
      const jobKeywords = extractKeywords(job_description);
      const tailoredResume = createTailoredResume(
        resume_text,
        structured_data,
        job_description,
        jobKeywords
      );

      return NextResponse.json({
        tailored_resume: tailoredResume,
        keywords_matched: jobKeywords.length,
        suggestions: {
          keywords: jobKeywords.slice(0, 10),
          missingSkills: [],
          formatTips: ["Use action verbs", "Quantify achievements"],
          tone: "Professional",
        },
        resume_id: resume_id,
        warning: "AI tailoring unavailable, using basic tailoring",
      });
    }
  } catch (error: any) {
    console.error("Tailor error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to tailor resume" },
      { status: 500 }
    );
  }
}

/**
 * Extract keywords from job description
 * In production, use NLP or AI for better extraction
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const commonTech = [
    "JavaScript", "TypeScript", "Python", "Java", "React", "Node.js",
    "AWS", "Docker", "Kubernetes", "PostgreSQL", "MongoDB", "SQL",
    "Machine Learning", "AI", "Agile", "Scrum", "CI/CD",
  ];

  const textLower = text.toLowerCase();
  commonTech.forEach((tech) => {
    if (textLower.includes(tech.toLowerCase())) {
      keywords.push(tech);
    }
  });

  return keywords;
}

/**
 * Create tailored resume based on job description
 * This is a placeholder - replace with actual AI integration
 */
function createTailoredResume(
  resumeText: string,
  structuredData: any,
  jobDescription: string,
  keywords: string[]
): string {
  // Placeholder implementation
  // In production, use OpenAI GPT-4 or similar:
  // 
  // const response = await openai.chat.completions.create({
  //   model: "gpt-4",
  //   messages: [{
  //     role: "system",
  //     content: "You are an expert resume writer. Tailor this resume to match the job description..."
  //   }, {
  //     role: "user",
  //     content: `Resume: ${resumeText}\n\nJob Description: ${jobDescription}`
  //   }]
  // });

  let tailored = resumeText;

  // Add header note (placeholder)
  tailored = `TAILORED RESUME - Generated for this specific job posting\n\n${"=".repeat(50)}\n\n${tailored}`;

  // Add matched keywords section (placeholder)
  if (keywords.length > 0) {
    tailored += `\n\n\nKEYWORDS MATCHED: ${keywords.join(", ")}`;
  }

  // Add note about AI enhancement
  tailored += `\n\n\n[NOTE: This is a placeholder. Integrate with AI service (OpenAI/Anthropic) for actual tailoring.]`;

  return tailored;
}

