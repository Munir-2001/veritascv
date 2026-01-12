/**
 * Focused Tailoring Engine
 * 
 * Uses raw_text as primary source and breaks down into focused prompts
 * for each section to ensure high-quality, targeted optimization.
 */

import { getAIConfig } from "@/lib/config/ai";
import { callAIWithFallback } from "@/lib/ai/fallback";
import { getCVStrategy, type JobLevel, type Domain } from "@/lib/cv/strategy";

export interface TailorRequest {
  raw_text: string; // Primary source - complete raw text from resume
  structured_data?: any; // Optional fallback
  job_description: string;
  job_title?: string;
  job_level?: JobLevel;
  domain?: Domain;
  company_name?: string;
  company_description?: string;
  additional_context?: string;
  template?: "modern" | "classic" | "creative" | "ats-friendly"; // CV template style
}

export interface TailoredSections {
  about_me: string; // NEW: AI-tailored About Me section
  professional_summary: string;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    location?: string;
    bullets: string[];
  }>;
  projects: Array<{
    name: string;
    description?: string; // Optional for backward compatibility
    bullets?: string[]; // NEW: Bullet points for achievements
    technologies: string[];
    achievements?: string[]; // Deprecated, use bullets instead
  }>;
  technical_skills: Array<{ skill: string; matched: boolean }> | string[]; // Can be array of objects with matched flag, or simple array for backward compat
  soft_skills?: string[];
  education: Array<{
    degree: string;
    institution: string;
    start_date?: string; // NEW: Start date
    end_date?: string; // NEW: End date
    year?: string; // Fallback if dates not available
    gpa?: string;
    honors?: string;
    coursework?: string[];
    achievements?: string[]; // NEW: Education achievements
  }>;
  certifications?: string[];
}

export interface TailorResponse {
  sections: TailoredSections;
  keywords_matched: string[];
  suggestions: any;
}

/**
 * Decide whether to use Career Objective or Professional Summary based on job description
 */
function shouldUseCareerObjective(jobDescription: string, jobLevel: JobLevel): boolean {
  const descLower = jobDescription.toLowerCase();
  
  // Career Objective is better for:
  // 1. Entry-level/internship positions
  if (jobLevel === "entry" || jobLevel === "internship") {
    return true;
  }
  
  // 2. Jobs that emphasize growth, learning, career development
  const careerObjectiveKeywords = [
    "entry level", "entry-level", "graduate", "junior", "trainee", "intern",
    "career growth", "learning", "development", "mentorship", "training",
    "early career", "starting", "beginning", "new graduate", "recent graduate",
    "aspiring", "seeking", "looking to", "opportunity to learn", "growth opportunity"
  ];
  
  const hasCareerKeywords = careerObjectiveKeywords.some(keyword => descLower.includes(keyword));
  
  // 3. Jobs that don't emphasize extensive experience
  const experienceKeywords = [
    "years of experience", "5+ years", "10+ years", "senior", "lead", "principal",
    "architect", "director", "vp", "executive", "extensive experience", "proven track record"
  ];
  
  const hasExperienceKeywords = experienceKeywords.some(keyword => descLower.includes(keyword));
  
  // Use Career Objective if:
  // - Entry/internship level, OR
  // - Has career growth keywords AND doesn't emphasize extensive experience
  if (hasCareerKeywords && !hasExperienceKeywords) {
    return true;
  }
  
  // Default: Use Professional Summary for mid-level and above
  return false;
}

/**
 * Main entry point - Tailor resume using focused prompts
 */
export async function tailorResumeWithFocusedPrompts(
  request: TailorRequest
): Promise<TailorResponse> {
  const config = getAIConfig();
  const strategy = getCVStrategy(request.job_level || "mid", request.domain || "general");

  console.log(`[Focused Tailoring] ==================== START ====================`);
  console.log(`[Focused Tailoring] Provider: ${config.provider}`);
  console.log(`[Focused Tailoring] Model: ${config.model}`);
  console.log(`[Focused Tailoring] API Key: ${config.apiKey ? "✅ Set" : "❌ Missing"}`);
  console.log(`[Focused Tailoring] Raw text length: ${request.raw_text.length} chars`);
  console.log(`[Focused Tailoring] Raw text preview (first 500 chars): ${request.raw_text.substring(0, 500)}`);
  console.log(`[Focused Tailoring] Has structured_data: ${!!request.structured_data}`);
  if (request.structured_data?.experience) {
    console.log(`[Focused Tailoring] Structured data has ${request.structured_data.experience.length} experience entries`);
  }
  console.log(`[Focused Tailoring] Strategy: Level=${request.job_level}, Domain=${request.domain}`);
  console.log(`[Focused Tailoring] Section order: ${strategy.sectionOrder.join(", ")}`);
  
  if (!config.apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables!");
  }
  
  if (config.provider !== "gemini") {
    throw new Error(`Focused tailoring requires AI_PROVIDER=gemini. Current: ${config.provider}`);
  }

  // Extract keywords from job description first
  const keywords = extractKeywordsFromJob(request.job_description);

  // Build candidate context (profile, skills, experience domain, etc.)
  const candidateContext = buildCandidateContext(request.raw_text, request.structured_data);

  // Extract years required from job description
  const jobYearsRequired = extractYearsRequiredFromJob(request.job_description);
  
  // Build job context (include years required for tone adjustment)
  const jobContext = buildJobContext(request, jobYearsRequired);
  
  // Get tone instructions based on template style
  const template = request.template || "modern";
  const { getCVStyle, getToneInstructions } = await import("@/lib/cv/styles");
  const cvStyle = getCVStyle(template);
  const toneInstructions = getToneInstructions(cvStyle);
  
  console.log(`[Focused Tailoring] Template: ${template}, Tone: ${cvStyle.tone.formality}`);

  // Decide which section to use: Career Objective or Professional Summary
  const useCareerObjective = shouldUseCareerObjective(request.job_description, request.job_level || "mid");
  
  let aboutMe = "";
  let professionalSummary = "";

  if (useCareerObjective) {
    // Step 0: Career Objective (40 words, hyper-personalized)
    console.log(`[Focused Tailoring] Step 0/6: Generating Career Objective...`);
    aboutMe = await generateAboutMe(
      request.raw_text,
      jobContext,
      candidateContext,
      keywords,
      toneInstructions,
      config
    );
  } else {
    // Step 1: Professional Summary (traditional summary)
    console.log(`[Focused Tailoring] Step 1/6: Generating Professional Summary...`);
    professionalSummary = await generateProfessionalSummary(
      request.raw_text,
      jobContext,
      candidateContext,
      strategy,
      toneInstructions,
      config
    );
  }

  // Step 2: Experience Optimization
  console.log(`[Focused Tailoring] Step 2/6: Optimizing Experience...`);
  console.log(`[Focused Tailoring] structured_data available: ${!!request.structured_data}, experience: ${request.structured_data?.experience?.length || 0} jobs`);
  const experience = await optimizeExperience(
    request.raw_text,
    jobContext,
    candidateContext,
    keywords,
    strategy,
    toneInstructions,
    config,
    request.structured_data // Pass structured_data for fallback
  );

  // Step 3: Projects Matching
  console.log(`[Focused Tailoring] Step 3/6: Matching Projects...`);
  const projects = await matchProjects(
    request.raw_text,
    jobContext,
    candidateContext,
    keywords,
    strategy,
    toneInstructions,
    config,
    request.structured_data // Pass structured_data for fallback
  );

  // Step 4: Technical Skills Extraction
  console.log(`[Focused Tailoring] Step 4/6: Extracting Technical Skills...`);
  const technicalSkills = await extractTechnicalSkills(
    request.raw_text,
    jobContext,
    candidateContext,
    keywords,
    config
  );

  // Step 5: Education & Certifications (if needed)
  console.log(`[Focused Tailoring] Step 5/6: Extracting Education & Certifications...`);
  const { education, certifications } = await extractEducationAndCertifications(
    request.raw_text,
    jobContext,
    candidateContext,
    keywords,
    strategy,
    config
  );

  const sections: TailoredSections = {
    about_me: aboutMe,
    professional_summary: professionalSummary,
    experience,
    projects,
    technical_skills: technicalSkills,
    education,
    certifications: certifications || [],
  };

  console.log(`[Focused Tailoring] ✅ Complete! Sections:`, {
    summary: professionalSummary.length > 0,
    experience: experience.length,
    projects: projects.length,
    skills: technicalSkills.length,
    education: education.length,
    certifications: certifications?.length || 0,
  });

  return {
    sections,
    keywords_matched: keywords,
    suggestions: {
      keywords: keywords.slice(0, 15),
      formatTips: ["All sections optimized with job keywords", "Metrics added where applicable"],
      tone: strategy.summaryStyle,
    },
  };
}

/**
 * Step 0: Generate Career Objective (40 words, hyper-personalized)
 */
async function generateAboutMe(
  rawText: string,
  jobContext: string,
  candidateContext: string,
  keywords: string[],
  toneInstructions: string,
  config: any
): Promise<string> {
  const prompt = `You are an expert resume writer. Generate a hyper-personalized "Career Objective" section for a resume.

${jobContext}

${candidateContext}

KEYWORDS FROM JOB: ${keywords.slice(0, 15).join(", ")}

CANDIDATE'S RESUME (raw text):
${rawText.substring(0, 4000)}${rawText.length > 4000 ? "\n[... truncated ...]" : ""}

TASK:
Generate a compelling "Career Objective" section that is EXACTLY 50 words (no more, no less) that:
1. Uses the candidate's actual background, experience, and education from the resume
2. Shows career aspirations and goals that align with the job description
3. Mentions specific goals related to the role (e.g., "aspiring to lead ML projects", "seeking to contribute to scalable systems")
4. Includes relevant keywords from the job description naturally
5. Shows alignment with the job description role
6. Demonstrates enthusiasm and commitment to the field/domain

FORMAT:
- Start with who they are and their current focus
- Mention career aspirations/goals that relate to the job
- Show alignment with the role and company needs
- End with what they aim to achieve/contribute

CRITICAL REQUIREMENTS:
- EXACTLY 50 words (count carefully)
- Hyper-personalized to the candidate's background
- Must include career aspirations/goals related to the job
- Must show alignment with job description
- Use ONLY information from the candidate's resume (don't fabricate)
- Professional but passionate tone

Return ONLY the Career Objective text (EXACTLY 50 words), no markdown, no JSON, just the paragraph.`;

  try {
    const response = await callGemini(prompt, config);
    console.log(`[Focused Tailoring] About Me generated (${response.length} chars)`);
    return response.trim();
  } catch (error: any) {
    console.error(`[Focused Tailoring] About Me generation failed:`, error);
    return "Passionate professional with a strong background in technology and a commitment to excellence."; // Fallback
  }
}

/**
 * Step 1: Generate Professional Summary
 */
async function generateProfessionalSummary(
  rawText: string,
  jobContext: string,
  candidateContext: string,
  strategy: any,
  toneInstructions: string,
  config: any
): Promise<string> {
  const prompt = `You are an expert resume writer. Generate a highly personalized professional summary for a resume tailored to a specific job.

${jobContext}

${candidateContext}

${toneInstructions}

CANDIDATE'S RESUME (raw text):
${rawText.substring(0, 4000)}${rawText.length > 4000 ? "\n[... truncated ...]" : ""}

TASK:
Generate a professional summary written in FIRST PERSON (use "I", "my", "me") that is EXACTLY 50 words (no more, no less):
1. Mirrors the job title and level
2. Includes the top 5 most relevant keywords from the job description
3. Highlights the candidate's most relevant experience and achievements (from the raw text above)
4. Shows enthusiasm for the role/company/domain
5. Uses the candidate's actual background, skills, and domain experience from the candidate context
6. Makes it highly personalized - reference specific technologies, years of experience, or achievements
7. Matches the tone: ${strategy.summaryStyle === "objective" ? "Eager, learning-focused" : strategy.summaryStyle === "executive" ? "Confident, strategic" : "Professional, achievement-focused"}

CRITICAL REQUIREMENTS:
- MUST be in FIRST PERSON (I, my, me) - NOT third person
- **EXACTLY 50 words (count carefully) - no more, no less**
- **USE THE CANDIDATE'S ACTUAL YEARS OF EXPERIENCE FROM THE CANDIDATE CONTEXT** - DO NOT use years from the job description requirements
- If candidate context shows "Years of Experience: X", use that EXACT number (e.g., "5 years", "3 years")
- If candidate has MORE experience than job requires, use a confident, powerful tone
- If candidate has LESS experience than job requires, focus on skills, achievements, and potential
- Extract actual experience from the raw text (don't fabricate)
- Use specific technologies/skills mentioned in the job AND candidate's strong skills
- Reference candidate's domain experience and years of experience from candidate context
- Make it compelling, personalized, and ATS-friendly
- Use the candidate context to personalize (mention their domain, key skills, achievements)

EXAMPLES (using candidate's actual years):
- "I am a 5-year experienced [domain] professional with expertise in [key skills]. I have [achievement]..."
- "With 5 years in [domain], I specialize in [technologies] and have [achievement]..."
- "I bring 5 years of experience in [domain], where I've [achievement] using [technologies]..."

IMPORTANT: The candidate context above shows the candidate's ACTUAL years of experience. Use that number, NOT the job requirement!

Return ONLY the summary text in FIRST PERSON (EXACTLY 50 words), no markdown, no JSON, just the summary paragraph.`;

  try {
    const response = await callGemini(prompt, config);
    console.log(`[Focused Tailoring] Summary generated (${response.length} chars)`);
    return response.trim();
  } catch (error: any) {
    console.error(`[Focused Tailoring] Summary generation failed:`, error);
    return "Experienced professional with relevant skills and experience."; // Fallback
  }
}

/**
 * Step 2: Optimize Experience
 */
async function optimizeExperience(
  rawText: string,
  jobContext: string,
  candidateContext: string,
  keywords: string[],
  strategy: any,
  toneInstructions: string,
  config: any,
  structuredData?: any
): Promise<TailoredSections["experience"]> {
  // PRIORITY 1: Use structured_data if available (it was already AI-parsed during upload)
  if (structuredData?.experience && Array.isArray(structuredData.experience) && structuredData.experience.length > 0) {
    console.log(`[Focused Tailoring] ✅ Using pre-parsed structured_data for experience (${structuredData.experience.length} jobs)`);
    console.log(`[Focused Tailoring] Will optimize bullets with AI while preserving job details...`);
    
    // Build a prompt to optimize the existing structured experience
    // IMPORTANT: Include ALL bullets from ALL jobs - don't truncate
    const experienceText = structuredData.experience.map((exp: any, idx: number) => {
      const bullets = exp.bullets || [exp.description] || exp.achievements || [];
      // Log how many bullets we're passing for each job
      console.log(`[Focused Tailoring] Job ${idx + 1} (${exp.title} at ${exp.company}): ${bullets.length} bullets`);
      return `\nJOB ${idx + 1}:\nTitle: ${exp.title}\nCompany: ${exp.company}\nDuration: ${exp.duration}\nLocation: ${exp.location || ""}\nOriginal Bullets (${bullets.length} total):\n${bullets.map((b: string, i: number) => `  ${i + 1}. ${b}`).join("\n")}`;
    }).join("\n");
    
    console.log(`[Focused Tailoring] 📋 Passing ${structuredData.experience.length} jobs with ALL bullets to AI for optimization`);
    
    const optimizePrompt = `You are an expert resume writer. Optimize existing work experience bullet points SPECIFICALLY for this job application.

JOB DESCRIPTION (READ CAREFULLY - THIS IS WHAT YOU'RE OPTIMIZING FOR):
${jobContext}

${toneInstructions}

KEYWORDS FROM JOB DESCRIPTION TO INCORPORATE: ${keywords.slice(0, 30).join(", ")}

EXISTING WORK EXPERIENCE TO OPTIMIZE:
${experienceText}

TASK:
For EACH job, optimize the bullet points to be HIGHLY RELEVANT to the job description above. 

CRITICAL OPTIMIZATION REQUIREMENTS:
1. **JOB DESCRIPTION ALIGNMENT**: Each bullet MUST directly relate to requirements mentioned in the job description above
   - If the job requires "scalable systems", mention scalability achievements
   - If the job requires "API development", highlight API work
   - If the job requires "team collaboration", emphasize team achievements
   - Match the language, terminology, and focus areas from the job description

2. **KEYWORD INCORPORATION**: Naturally weave in keywords from the job description (${keywords.slice(0, 30).join(", ")})
   - Use the exact technologies mentioned in the job description
   - Match the job's domain focus (e.g., fintech, healthcare, e-commerce)
   - Align with the job's priorities (e.g., performance, security, user experience)

3. **METRICS & IMPACT**: Add quantifiable metrics where possible (%, $, team size, time saved, users, transactions, performance improvements, scale)
   - If original bullets have metrics, enhance them
   - If not, add reasonable metrics based on the work described

4. **ACTION VERBS**: Start with strong action verbs (Led, Developed, Architected, Optimized, Implemented, Delivered, Built, Designed, etc.)

5. **COMPLETE SENTENCES**: Each bullet MUST be a complete, meaningful sentence (NOT cut off mid-sentence)
   - Each bullet should be 1-2 lines max (aim for 100-150 characters)
   - Ensure bullets are NOT truncated - each must be a full, complete statement

6. **PRESERVE INFORMATION**: PRESERVE ALL information from original bullets
   - Merge related bullets if they cover similar topics
   - Don't lose any key achievements or responsibilities
   - If original bullets are incomplete/cut off, complete them logically based on context

7. **BULLET COUNT**: Create 2-4 optimized bullets per job
   - Prioritize bullets that best match the job description
   - Merge related bullets to create stronger, more impactful statements

8. **PRESERVE STRUCTURE**: PRESERVE the job title, company, duration, and location EXACTLY as provided
   - ONLY optimize the bullet points
   - Keep all other structured data unchanged

CRITICAL RULES:
- Keep ALL ${structuredData.experience.length} jobs (don't skip any)
- Do NOT change job titles, company names, durations, or locations
- ONLY optimize the bullet points (keep all other structured data unchanged)
- Each bullet MUST be optimized to match the job description requirements
- Make bullets read like they were written specifically for THIS job
- Prioritize bullets that directly address job requirements over generic achievements

Return ONLY valid JSON array (no markdown, no explanations):
[
  {
    "title": "Exact job title from input",
    "company": "Exact company name from input",
    "duration": "Exact duration from input",
    "location": "Exact location from input (or empty string if not provided)",
    "bullets": ["Complete optimized bullet 1 with keywords, metrics, and impact", "Complete optimized bullet 2 with keywords, metrics, and impact", "Complete optimized bullet 3 (if needed)", "Complete optimized bullet 4 (if needed)"]
  },
  ...
]

IMPORTANT:
- Return ALL ${structuredData.experience.length} jobs
- Each bullet must be a COMPLETE sentence (not cut off)
- Each bullet should incorporate job keywords and show relevance
- Preserve all key achievements from original bullets`;

    try {
      const response = await callGemini(optimizePrompt, config);
      const cleaned = cleanJSONResponse(response);
      const optimized = JSON.parse(cleaned);
      
      if (Array.isArray(optimized) && optimized.length > 0) {
        // Validate that we got all jobs back
        if (optimized.length !== structuredData.experience.length) {
          console.warn(`[Focused Tailoring] ⚠️ AI returned ${optimized.length} jobs but expected ${structuredData.experience.length}`);
        }
        
        // Validate bullets are complete (not cut off)
        optimized.forEach((exp: any, idx: number) => {
          if (!exp.bullets || !Array.isArray(exp.bullets) || exp.bullets.length === 0) {
            console.warn(`[Focused Tailoring] ⚠️ Job ${idx + 1} (${exp.title}) has no bullets - using original`);
            exp.bullets = structuredData.experience[idx]?.bullets || [];
          } else {
            // Check for incomplete bullets (ending mid-sentence)
            exp.bullets = exp.bullets.map((bullet: string) => {
              if (bullet && bullet.length > 0 && !bullet.match(/[.!?]$/)) {
                // Bullet doesn't end with punctuation - might be cut off
                console.warn(`[Focused Tailoring] ⚠️ Bullet might be incomplete: "${bullet.substring(0, 50)}..."`);
              }
              return bullet;
            });
          }
        });
        
        console.log(`[Focused Tailoring] ✅ Experience optimized: ${optimized.length} jobs`);
        console.log(`[Focused Tailoring] Bullet counts:`, optimized.map((exp: any) => `${exp.title}: ${exp.bullets?.length || 0} bullets`));
        return optimized;
      }
    } catch (error: any) {
      console.error(`[Focused Tailoring] Experience optimization failed:`, error);
      console.log(`[Focused Tailoring] Falling back to structured_data as-is...`);
    }
    
    // If optimization fails, return structured_data formatted properly
    return extractExperienceFallback(rawText, structuredData);
  }
  
  // PRIORITY 2: Try AI parsing from raw text (if structured_data not available)
  console.log(`[Focused Tailoring] ⚠️ No structured_data.experience available, trying AI extraction from raw_text...`);
  
  // Log raw text info for debugging
  console.log(`[Focused Tailoring] optimizeExperience - rawText length: ${rawText.length} chars`);
  console.log(`[Focused Tailoring] optimizeExperience - rawText preview: ${rawText.substring(0, 200)}...`);
  
  if (!rawText || rawText.trim().length === 0) {
    console.error(`[Focused Tailoring] ⚠️ WARNING: rawText is empty! Using fallback extraction...`);
    return extractExperienceFallback(rawText, structuredData);
  }

  const prompt = `You are an expert resume writer. Extract and optimize work experience from a resume.

${jobContext}

${candidateContext}

${toneInstructions}

TECH STACK FROM JOB DESCRIPTION (CRITICAL - USE THESE IN EVERY BULLET):
${keywords.slice(0, 30).join(", ")}

KEYWORDS TO MATCH: ${keywords.slice(0, 30).join(", ")}

CANDIDATE'S RESUME (raw text - EXTRACT ALL WORK EXPERIENCE FROM THIS):
${rawText}

CRITICAL: The raw text above contains the candidate's work experience. You MUST extract ALL jobs mentioned. Look for sections like "PROFESSIONAL EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT", or job titles followed by company names and dates. DO NOT return an empty array - if you see any job titles, companies, or dates, extract them.

IMPORTANT: The JOB DESCRIPTION above contains the CORE TECH STACK and requirements for the position. You MUST:
- **PRIORITIZE matching the tech stack keywords listed above** - these are the technologies the job requires
- **WEAVE tech stack keywords into EVERY bullet point** - mention specific technologies from the job description
- Match the language and terminology used in the job description
- Align bullet points with the specific requirements mentioned
- Use similar phrasing and keywords from the job description
- Ensure each bullet point addresses something relevant to the job AND mentions relevant tech stack items

TASK:
1. EXTRACT all work experience from the raw text (job titles, companies, dates, responsibilities)
2. For EACH job, create EXACTLY 2 highly impactful bullet points that:
   - **MUST mention at least 1-2 technologies from the tech stack list above** (even if not originally in the resume)
   - Start with strong action verbs (Led, Developed, Architected, Built, Implemented, etc.)
   - Closely match and resemble the job description requirements
   - Use existing bullets from the resume but enhance them to match job description
   - Weave in job keywords naturally (from the tech stack list above)
   - Add quantifiable metrics (%, $, team size, users, time saved) - estimate reasonably if not present
   - Show IMPACT and RESULTS that align with job requirements
   - Use similar language/phrasing as the job description
   - Highlight achievements that directly address job requirements
   - **Example format: "Developed [tech from job] solution using [tech from job], achieving [metric]"**

3. Format each experience entry as:
{
  "title": "Job Title",
  "company": "Company Name",
  "duration": "May 2024 - Aug 2025",
  "location": "City, Country (if mentioned)",
  "bullets": [
    "Bullet 1 that closely ties to job description with action verb, keyword, and metric",
    "Bullet 2 that closely ties to job description with action verb, keyword, and metric"
  ]
}

CRITICAL RULES:
- Extract ALL jobs from the raw text (don't skip any)
- NEVER fabricate experience - only enhance what exists
- If dates are unclear, use reasonable estimates
- Each job MUST have EXACTLY 2 bullet points (no more, no less)
- Bullets must closely resemble and tie to the job description
- Use existing bullets from the resume but enhance them to match job description
- Use job keywords extensively but naturally
- Make bullets highly relevant - they should read like they were written for this specific job
- Prioritize bullets that directly address job requirements

Return ONLY valid JSON array of experience entries (EACH entry MUST have bullets array with EXACTLY 2 items):
[
  {
    "title": "...",
    "company": "...",
    "duration": "...",
    "bullets": ["...", "..."]
  },
  ...
]`;

  try {
    console.log(`[Focused Tailoring] Sending prompt to AI (prompt length: ${prompt.length} chars)`);
    console.log(`[Focused Tailoring] - rawText length in prompt: ${rawText.length} chars`);
    console.log(`[Focused Tailoring] - rawText preview in prompt: ${rawText.substring(0, 100)}...`);
    console.log(`[Focused Tailoring] - Prompt includes rawText: ${prompt.includes(rawText.substring(0, 50))}`);
    const response = await callGemini(prompt, config);
    const cleaned = cleanJSONResponse(response);
    let experience: any[];
    
    try {
      experience = JSON.parse(cleaned);
    } catch (parseError) {
      console.error(`[Focused Tailoring] Failed to parse experience JSON:`, parseError);
      console.error(`[Focused Tailoring] Response was:`, cleaned.substring(0, 500));
      return extractExperienceFallback(rawText, structuredData);
    }
    
    console.log(`[Focused Tailoring] Experience extracted: ${experience.length} jobs`);
    if (experience.length > 0) {
      console.log(`[Focused Tailoring] Experience data sample:`, JSON.stringify(experience[0]).substring(0, 200));
    }
    
    // Validate that we got experience entries - ALWAYS use fallback if empty
    if (!Array.isArray(experience) || experience.length === 0) {
      console.warn(`[Focused Tailoring] ⚠️ AI returned empty/invalid experience array (length: ${experience?.length || 0}), using fallback...`);
      const fallbackExperience = extractExperienceFallback(rawText, structuredData);
      console.log(`[Focused Tailoring] ✅ Fallback returned ${fallbackExperience.length} experience entries`);
      if (fallbackExperience.length === 0) {
        console.error(`[Focused Tailoring] ❌ CRITICAL: Fallback also returned 0 entries! Check structured_data and raw_text.`);
      }
      return fallbackExperience;
    }
    
    return experience;
  } catch (error: any) {
    console.error(`[Focused Tailoring] Experience extraction failed:`, error);
    console.log(`[Focused Tailoring] Using fallback experience extraction...`);
    return extractExperienceFallback(rawText, structuredData);
  }
}

/**
 * Fallback: Extract experience from raw text when AI fails
 */
function extractExperienceFallback(rawText: string, structuredData?: any): TailoredSections["experience"] {
  const experience: TailoredSections["experience"] = [];
  
  console.log(`[Focused Tailoring] 🔄 extractExperienceFallback called`);
  console.log(`[Focused Tailoring] - rawText length: ${rawText?.length || 0}`);
  console.log(`[Focused Tailoring] - structuredData exists: ${!!structuredData}`);
  console.log(`[Focused Tailoring] - structuredData.experience: ${structuredData?.experience?.length || 0} entries`);
  
  // First, try to use structured_data if available
  if (structuredData?.experience && Array.isArray(structuredData.experience) && structuredData.experience.length > 0) {
    console.log(`[Focused Tailoring] ✅ Using structured_data experience (${structuredData.experience.length} jobs)`);
    const mapped = structuredData.experience.map((exp: any) => {
      // Ensure bullets array - need at least 2 bullets
      let bullets = exp.bullets || [];
      if (!bullets.length && exp.description) {
        bullets = [exp.description];
      }
      if (!bullets.length && exp.responsibilities) {
        bullets = Array.isArray(exp.responsibilities) ? exp.responsibilities : [exp.responsibilities];
      }
      // Ensure we have at least 2 bullets
      if (bullets.length === 0) {
        bullets = [`Worked as ${exp.title || exp.job_title || "professional"} at ${exp.company || exp.company_name || "company"}`];
      }
      if (bullets.length === 1) {
        bullets.push(`Contributed to key projects and initiatives at ${exp.company || exp.company_name || "the organization"}`);
      }
      
      return {
        title: exp.title || exp.job_title || "Position",
        company: exp.company || exp.company_name || "Company",
        duration: exp.duration || exp.period || (exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` : "") || "",
        location: exp.location || "",
        bullets: bullets.slice(0, 2), // Ensure exactly 2 bullets
      };
    });
    console.log(`[Focused Tailoring] ✅ Mapped ${mapped.length} experience entries from structured_data`);
    return mapped;
  }
  
  // Fallback: Extract from raw text using regex patterns
  console.log(`[Focused Tailoring] Extracting experience from raw text (${rawText.length} chars)...`);
  
  // Pattern 1: "Job Title - Company - Date - Date"
  const pattern1 = /([A-Z][^•\n\-]{5,60})\s*[-–]\s*([A-Z][^•\n\-]{3,50})\s*[-–]\s*([A-Za-z]+\s+\d{4}|\d{4})\s*[-–]\s*([A-Za-z]+\s+\d{4}|Present|Current|\d{4})?/gi;
  
  // Pattern 2: Look for "PROFESSIONAL EXPERIENCE" section
  const expSectionMatch = rawText.match(/(?:PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|EXPERIENCE)[\s\S]{0,3000}/i);
  
  if (expSectionMatch) {
    const expSection = expSectionMatch[0];
    
    // Extract job entries (look for patterns like "Job Title - Company - Date")
    let match;
    pattern1.lastIndex = 0;
    while ((match = pattern1.exec(expSection)) !== null && experience.length < 10) {
      const title = match[1]?.trim();
      const company = match[2]?.trim();
      const startDate = match[3]?.trim();
      const endDate = match[4]?.trim() || "Present";
      
      if (title && company) {
        // Find bullets for this job (next few lines after the job title)
        const jobStart = match.index || 0;
        const nextJobMatch = expSection.substring(jobStart + 100).match(/([A-Z][^•\n\-]{5,60})\s*[-–]\s*([A-Z][^•\n\-]{3,50})/);
        const jobEnd = nextJobMatch ? jobStart + 100 + (nextJobMatch.index || 0) : jobStart + 500;
        const jobText = expSection.substring(jobStart, jobEnd);
        
        // Extract bullets
        const bullets = jobText.match(/[•\-\*]\s*([^\n]{15,200})/g) || [];
        const formattedBullets = bullets.slice(0, 2).map(b => b.replace(/^[•\-\*]\s*/, "").trim());
        
        experience.push({
          title,
          company,
          duration: `${startDate} - ${endDate}`,
          location: "",
          bullets: formattedBullets.length > 0 ? formattedBullets : [`Worked on ${title} at ${company}`],
        });
      }
    }
  }
  
  // If still no experience found, try simpler pattern
  if (experience.length === 0) {
    const simplePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-–]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-–]\s*([A-Za-z]+\s+\d{4}|\d{4})/gi;
    let match;
    while ((match = simplePattern.exec(rawText)) !== null && experience.length < 5) {
      experience.push({
        title: match[1]?.trim() || "Position",
        company: match[2]?.trim() || "Company",
        duration: match[3]?.trim() || "",
        location: "",
        bullets: [`Worked as ${match[1]} at ${match[2]}`],
      });
    }
  }
  
  console.log(`[Focused Tailoring] Fallback extracted ${experience.length} experience entries`);
  
  if (experience.length === 0) {
    console.error(`[Focused Tailoring] ❌ CRITICAL: Fallback also returned 0 experience entries!`);
    console.error(`[Focused Tailoring] Raw text length: ${rawText?.length || 0}`);
    console.error(`[Focused Tailoring] Raw text sample: ${rawText?.substring(0, 500) || "EMPTY"}`);
  }
  
  return experience;
}

/**
 * Step 3: Match Projects
 * 
 * STRATEGY: Use structured_data as source of truth if available.
 */
async function matchProjects(
  rawText: string,
  jobContext: string,
  candidateContext: string,
  keywords: string[],
  strategy: any,
  toneInstructions: string,
  config: any,
  structuredData?: any
): Promise<TailoredSections["projects"]> {
  // Skip projects for senior/executive if strategy says so
  if (strategy.projectsImportance === "skip") {
    console.log(`[Focused Tailoring] Skipping projects (strategy: skip)`);
    return [];
  }
  
  // PRIORITY 1: Use structured_data if available
  if (structuredData?.projects && Array.isArray(structuredData.projects) && structuredData.projects.length > 0) {
    console.log(`[Focused Tailoring] ✅ Using pre-parsed structured_data for projects (${structuredData.projects.length} projects)`);
    console.log(`[Focused Tailoring] Will optimize with AI while preserving structure...`);
    
    // Optimize the existing structured projects with AI
    try {
      const projectsText = structuredData.projects.map((proj: any, idx: number) => {
        const bullets = proj.bullets || [proj.description] || [];
        const techs = proj.technologies || [];
        return `
PROJECT ${idx + 1}:
Name: ${proj.name}
Technologies: ${techs.join(", ")}
Bullets:
${bullets.map((b: string, i: number) => `  ${i + 1}. ${b}`).join("\n")}`;
      }).join("\n");
      
      const optimizePrompt = `You are an expert resume writer. Optimize the following projects for a job application.

${jobContext}

${toneInstructions}

TECH STACK FROM JOB: ${keywords.slice(0, 30).join(", ")}

EXISTING PROJECTS TO OPTIMIZE:
${projectsText}

TASK:
Optimize EACH project to:
1. Add technologies from job description tech stack (prioritize these)
2. Enhance bullets to show job-relevant achievements
3. Add metrics where possible
4. Maximum 3 bullets per project
5. PRESERVE the project name

Return ONLY valid JSON array:
[
  {
    "name": "...",
    "technologies": ["Tech from job", ...],
    "bullets": ["...", "...", "..."]
  },
  ...
]`;

      const response = await callGemini(optimizePrompt, config);
      const cleaned = cleanJSONResponse(response);
      const optimized = JSON.parse(cleaned);
      
      if (Array.isArray(optimized) && optimized.length > 0) {
        console.log(`[Focused Tailoring] ✅ Projects optimized: ${optimized.length} projects`);
        return optimized;
      }
    } catch (error: any) {
      console.error(`[Focused Tailoring] Projects optimization failed:`, error);
      console.log(`[Focused Tailoring] Falling back to unoptimized structured_data...`);
    }
    
    // If optimization fails, return structured_data as-is
    return extractProjectsFallback(rawText, structuredData);
  }
  
  // PRIORITY 2: Try AI parsing from raw text (if structured_data not available)
  console.log(`[Focused Tailoring] ⚠️ No structured_data.projects available, trying AI extraction from raw_text...`);

  const prompt = `You are an expert resume writer. Extract and optimize projects from a resume.

${jobContext}

${candidateContext}

${toneInstructions}

TECH STACK FROM JOB DESCRIPTION (CRITICAL - USE THESE IN EVERY PROJECT):
${keywords.slice(0, 30).join(", ")}

KEYWORDS TO MATCH: ${keywords.slice(0, 30).join(", ")}

CANDIDATE'S RESUME (raw text - EXTRACT ALL PROJECTS FROM THIS):
${rawText}

CRITICAL: The raw text above contains the candidate's projects. You MUST extract ALL projects mentioned. Look for sections like "PROJECTS", "PROJECT", "PORTFOLIO", "SIDE PROJECTS", or project names followed by descriptions. DO NOT return an empty array - if you see any project names, descriptions, or technologies, extract them.

IMPORTANT: The JOB DESCRIPTION above contains the CORE TECH STACK and requirements for the position. You MUST:
- **PRIORITIZE matching the tech stack keywords listed above** - these are the technologies the job requires
- **ADD technologies from the job description tech stack to EVERY project** - even if not originally in the project
- **MENTION tech stack keywords in EVERY bullet point** - show the candidate has experience with the job's tech stack
- Align project descriptions with the specific requirements
- Use similar language and keywords from the job description
- Ensure projects demonstrate skills directly needed for the job
- **Make it look like the candidate has extensive experience with the job's core tech stack**

TASK:
1. EXTRACT all projects from the raw text
2. For EACH project, enhance it to:
   - **MUST include 3-5 technologies from the tech stack list above** (prioritize these over original technologies)
   - Closely tie to the job description requirements
   - **ADD technologies from the job description tech stack** - even if not originally in the project, include them
   - **Each bullet MUST mention specific technologies from the job's tech stack**
   - Add quantifiable achievements/metrics in bullet format
   - Show direct relevance to the job
   - Use similar language/phrasing as the job description
   - Format achievements as BULLET POINTS (not paragraphs)
   - **Make it clear the candidate has hands-on experience with the job's core technologies**

3. Format each project as:
{
  "name": "Project Name",
  "technologies": ["Tech1 from job description", "Tech2 from job description", "Tech3 from job description", "Additional tech from job description"],
  "bullets": [
    "Bullet 1: Achievement with metric that relates to job (e.g., 'Built X using Y technology, achieving Z result')",
    "Bullet 2: Achievement with metric that relates to job",
    "Bullet 3: Achievement with metric that relates to job (optional, max 3 bullets)"
  ]
}

CRITICAL RULES:
- Extract ALL projects from the raw text
- Include technologies from the job description - ADD them even if not in original project
- Prioritize technologies mentioned in the job description
- Format achievements as BULLETS (not description paragraphs)
- Each bullet should start with an action verb (Built, Developed, Implemented, etc.)
- Each bullet should mention specific technologies from the job description
- Add metrics where possible (users, performance, time saved, etc.)
- Maximum 3 bullets per project
- Make projects highly relevant - they should demonstrate skills needed for the job
- Use job description keywords and phrasing in bullets

Return ONLY valid JSON array:
[
  {
    "name": "...",
    "technologies": ["Tech from job description", "Another tech from job description", ...],
    "bullets": ["Bullet 1 with tech and metric", "Bullet 2 with tech and metric", "Bullet 3 with tech and metric"]
  },
  ...
]`;

  try {
    console.log(`[Focused Tailoring] Sending projects prompt to AI (prompt length: ${prompt.length} chars)`);
    console.log(`[Focused Tailoring] - rawText length: ${rawText.length} chars`);
    console.log(`[Focused Tailoring] - Prompt includes rawText: ${prompt.includes(rawText.substring(0, 50))}`);
    const response = await callGemini(prompt, config);
    const cleaned = cleanJSONResponse(response);
    let projects: any[];
    
    try {
      projects = JSON.parse(cleaned);
    } catch (parseError) {
      console.error(`[Focused Tailoring] Failed to parse projects JSON:`, parseError);
      console.error(`[Focused Tailoring] Response was:`, cleaned.substring(0, 500));
      return extractProjectsFallback(rawText, structuredData);
    }
    
    console.log(`[Focused Tailoring] Projects extracted: ${projects.length} projects`);
    if (projects.length > 0) {
      console.log(`[Focused Tailoring] Projects data sample:`, JSON.stringify(projects[0]).substring(0, 200));
    }
    
    // Validate that we got projects - ALWAYS use fallback if empty
    if (!Array.isArray(projects) || projects.length === 0) {
      console.warn(`[Focused Tailoring] ⚠️ AI returned empty/invalid projects array (length: ${projects?.length || 0}), using fallback...`);
      const fallbackProjects = extractProjectsFallback(rawText, structuredData);
      console.log(`[Focused Tailoring] ✅ Fallback returned ${fallbackProjects.length} projects`);
      if (fallbackProjects.length === 0) {
        console.error(`[Focused Tailoring] ❌ CRITICAL: Fallback also returned 0 projects! Check structured_data and raw_text.`);
      }
      return fallbackProjects;
    }
    
    return projects;
  } catch (error: any) {
    console.error(`[Focused Tailoring] Projects extraction failed:`, error);
    console.log(`[Focused Tailoring] Using fallback projects extraction...`);
    return extractProjectsFallback(rawText, structuredData);
  }
}

/**
 * Fallback: Extract projects from raw text when AI fails
 */
function extractProjectsFallback(rawText: string, structuredData?: any): TailoredSections["projects"] {
  const projects: TailoredSections["projects"] = [];
  
  console.log(`[Focused Tailoring] 🔄 extractProjectsFallback called`);
  console.log(`[Focused Tailoring] - rawText length: ${rawText?.length || 0}`);
  console.log(`[Focused Tailoring] - structuredData exists: ${!!structuredData}`);
  console.log(`[Focused Tailoring] - structuredData.projects: ${structuredData?.projects?.length || 0} entries`);
  
  // First, try to use structured_data if available
  if (structuredData?.projects && Array.isArray(structuredData.projects) && structuredData.projects.length > 0) {
    console.log(`[Focused Tailoring] ✅ Using structured_data projects (${structuredData.projects.length} projects)`);
    const mapped = structuredData.projects.map((proj: any) => {
      // Ensure bullets array - need at least 2-3 bullets
      let bullets = proj.bullets || [];
      if (!bullets.length && proj.description) {
        // Split description into bullets if it's a paragraph
        const descBullets = proj.description.split(/[.;]\s+/).filter((b: string) => b.length > 20);
        bullets = descBullets.slice(0, 3);
      }
      if (!bullets.length && proj.achievements) {
        bullets = Array.isArray(proj.achievements) ? proj.achievements : [proj.achievements];
      }
      // Ensure we have at least 2 bullets
      if (bullets.length === 0) {
        bullets = [`Developed ${proj.name || "project"} using ${proj.technologies?.join(", ") || "various technologies"}`];
      }
      if (bullets.length === 1) {
        bullets.push(`Implemented key features and functionality for ${proj.name || "the project"}`);
      }
      
      return {
        name: proj.name || "Project",
        technologies: proj.technologies || proj.tech || [],
        bullets: bullets.slice(0, 3), // Max 3 bullets
      };
    });
    console.log(`[Focused Tailoring] ✅ Mapped ${mapped.length} projects from structured_data`);
    return mapped;
  }
  
  // Fallback: Extract from raw text using regex patterns
  console.log(`[Focused Tailoring] Extracting projects from raw text (${rawText.length} chars)...`);
  
  // Look for "PROJECTS" section
  const projectSectionMatch = rawText.match(/(?:PROJECTS|PROJECT|PORTFOLIO|SIDE PROJECTS)[\s\S]{0,3000}/i);
  
  if (projectSectionMatch) {
    const projectSection = projectSectionMatch[0];
    
    // Pattern 1: Project name on its own line (bold/heading style)
    const projectNamePattern = /(?:^|\n)([A-Z][^\n•\-]{5,80})\s*\n/g;
    let match;
    const projectNames: Array<{ name: string; startIndex: number }> = [];
    
    while ((match = projectNamePattern.exec(projectSection)) !== null && projectNames.length < 10) {
      const name = match[1]?.trim();
      if (name && name.length > 5 && !name.match(/^(PROJECTS|PROJECT|TECHNOLOGIES|SKILLS)$/i)) {
        projectNames.push({ name, startIndex: match.index || 0 });
      }
    }
    
    // For each project name, extract the following content
    for (let i = 0; i < projectNames.length; i++) {
      const current = projectNames[i];
      const next = projectNames[i + 1];
      const start = current.startIndex + current.name.length;
      const end = next ? next.startIndex : start + 500;
      const projectText = projectSection.substring(start, end);
      
      // Extract bullets
      const bullets = projectText.match(/[•\-\*]\s*([^\n]{15,200})/g) || [];
      const formattedBullets = bullets.slice(0, 3).map(b => b.replace(/^[•\-\*]\s*/, "").trim());
      
      // Extract technologies
      const techPattern = /\b(React|Vue|Angular|Node\.js|Python|JavaScript|TypeScript|Java|C\+\+|AWS|Docker|Kubernetes|MongoDB|PostgreSQL|MySQL|Git|Linux|Express|Django|Flask|Spring|FastAPI)\b/gi;
      const technologies = [...new Set(projectText.match(techPattern) || [])];
      
      if (formattedBullets.length > 0 || technologies.length > 0) {
        projects.push({
          name: current.name,
          technologies: technologies,
          bullets: formattedBullets.length > 0 ? formattedBullets : [`Developed ${current.name} using ${technologies.join(", ") || "various technologies"}`],
        });
      }
    }
  }
  
  console.log(`[Focused Tailoring] Fallback extracted ${projects.length} projects`);
  
  if (projects.length === 0) {
    console.error(`[Focused Tailoring] ❌ CRITICAL: Fallback also returned 0 projects!`);
    console.error(`[Focused Tailoring] Raw text length: ${rawText?.length || 0}`);
    console.error(`[Focused Tailoring] Raw text sample: ${rawText?.substring(0, 500) || "EMPTY"}`);
  }
  
  return projects;
}

/**
 * Step 4: Extract Technical Skills
 */
async function extractTechnicalSkills(
  rawText: string,
  jobContext: string,
  candidateContext: string,
  keywords: string[],
  config: any
): Promise<Array<{ skill: string; matched: boolean }>> {
  const prompt = `You are an expert resume writer. Extract and optimize technical skills from a resume.

${jobContext}

KEYWORDS FROM JOB: ${keywords.slice(0, 30).join(", ")}

CANDIDATE'S RESUME (raw text):
${rawText}

TASK:
1. Extract ALL technical skills from the resume (languages, frameworks, tools, technologies)
2. **Extract ALL technical skills from the job description tech stack** (these are CRITICAL - prioritize these)
3. Combine both lists, prioritizing:
   - **Skills from job description tech stack FIRST** (matched: true) - these are the most important
   - Skills that appear in BOTH resume and job description (matched: true)
   - Skills from job description that are relevant (matched: true)
   - Skills from resume that are relevant to the field (matched: false)
4. **INCLUDE ALL tech stack keywords from the job description** - even if not in the resume, add them with matched: true
5. Include common industry skills if needed to reach 15-20 skills total (more comprehensive)

Return ONLY a JSON array of objects:
[
  {"skill": "Python", "matched": true},  // In both resume and JD
  {"skill": "React", "matched": true},   // In JD (even if not in resume)
  {"skill": "Git", "matched": false}     // In resume only, but relevant
]

CRITICAL:
- **INCLUDE ALL tech stack keywords from the job description** - these are the core requirements
- **Prioritize job description tech stack FIRST** - these should appear at the top of the list
- Include skills from BOTH resume AND job description
- **If a tech stack keyword from job description is not in resume, STILL include it with matched: true** (show alignment)
- Include 15-20 skills total (more comprehensive to show full tech stack coverage)
- Mark skills that match job description with matched: true
- Mark skills from resume only with matched: false (but still include them if relevant)
- No duplicates
- Be comprehensive - include all relevant technologies from the job's tech stack`;

  try {
    const response = await callGemini(prompt, config);
    const cleaned = cleanJSONResponse(response);
    const skills = JSON.parse(cleaned);
    console.log(`[Focused Tailoring] Technical skills extracted: ${skills.length} skills`);
    return skills;
  } catch (error: any) {
    console.error(`[Focused Tailoring] Skills extraction failed:`, error);
    // FALLBACK: Extract skills from raw text and job description
    console.log(`[Focused Tailoring] Using fallback skill extraction from text...`);
    return extractSkillsFallback(rawText, jobContext, keywords);
  }
}

/**
 * Fallback: Extract skills from raw text when AI fails
 */
function extractSkillsFallback(rawText: string, jobContext: string, keywords: string[]): Array<{ skill: string; matched: boolean }> {
  const skills: Array<{ skill: string; matched: boolean }> = [];
  const textLower = rawText.toLowerCase();
  const jobLower = jobContext.toLowerCase();
  
  // Common technical skills to look for
  const commonSkills = [
    // Languages
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "Swift", "Kotlin",
    // Web
    "React", "Vue", "Angular", "Node.js", "Express", "Django", "Flask", "Spring", "FastAPI",
    // Databases
    "PostgreSQL", "MongoDB", "MySQL", "Redis", "SQL", "NoSQL",
    // Cloud & DevOps
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "CI/CD", "Jenkins", "Git", "GitHub",
    // ML/AI
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Scikit-learn", "AI",
    // Other
    "REST API", "GraphQL", "Microservices", "Agile", "Scrum", "Linux", "Unix",
  ];
  
  // Extract skills from resume
  commonSkills.forEach(skill => {
    if (textLower.includes(skill.toLowerCase())) {
      const matched = jobLower.includes(skill.toLowerCase()) || keywords.some(k => k.toLowerCase().includes(skill.toLowerCase()));
      skills.push({ skill, matched });
    }
  });
  
  // Extract skills from job description keywords - PRIORITIZE THESE
  // First, add all tech stack keywords from job description (even if not in resume)
  keywords.forEach(keyword => {
    // Check if it's a technical skill (not a soft skill)
    const isTechnical = commonSkills.some(s => keyword.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(keyword.toLowerCase())) ||
                       /^(python|java|javascript|typescript|react|vue|angular|node|express|django|flask|fastapi|aws|azure|gcp|docker|kubernetes|postgresql|mongodb|mysql|redis|sql|nosql|git|github|gitlab|ci\/cd|devops|microservices|rest|graphql|api|agile|scrum|machine learning|ml|ai|tensorflow|pytorch|pytest|jest|junit|mocha|cypress|selenium|tdd|bdd|terraform|ansible|jenkins|lambda|ecs|eks|serverless|cloud|linux|unix)$/i.test(keyword);
    
    if (isTechnical && !skills.some(s => s.skill.toLowerCase() === keyword.toLowerCase())) {
      // Add job description tech stack keywords FIRST (matched: true)
      skills.unshift({ skill: keyword, matched: true }); // Add to beginning for priority
    }
  });
  
  // Sort: matched skills (from job description) first, then unmatched
  skills.sort((a, b) => {
    if (a.matched && !b.matched) return -1;
    if (!a.matched && b.matched) return 1;
    return 0;
  });
  
  // Remove duplicates and sort (matched first)
  const uniqueSkills = Array.from(
    new Map(skills.map(s => [s.skill.toLowerCase(), s])).values()
  ).sort((a, b) => (b.matched ? 1 : 0) - (a.matched ? 1 : 0));
  
  console.log(`[Focused Tailoring] Fallback extracted ${uniqueSkills.length} skills`);
  return uniqueSkills.slice(0, 15); // Limit to 15 skills
}

/**
 * Step 5: Extract Education & Certifications
 */
async function extractEducationAndCertifications(
  rawText: string,
  jobContext: string,
  candidateContext: string,
  keywords: string[],
  strategy: any,
  config: any
): Promise<{ education: TailoredSections["education"]; certifications?: string[] }> {
  const prompt = `You are an expert resume writer. Extract education and certifications from a resume.

${jobContext}

${candidateContext}

KEYWORDS FROM JOB: ${keywords.slice(0, 15).join(", ")}

CANDIDATE'S RESUME (raw text):
${rawText}

IMPORTANT: The JOB DESCRIPTION above may mention preferred education or certifications. Use it to:
- Highlight relevant coursework that matches job requirements
- Emphasize education achievements relevant to the job
- Include certifications that align with job requirements

TASK:
Extract ALL education entries and certifications with FULL details.

For education, format as:
{
  "education": [
    {
      "degree": "Degree Name",
      "institution": "University Name",
      "start_date": "2020 or Sep 2020 or September 2020 (EXTRACT ONLY the date, NOT phrases like 'Expected to end in' or 'Started in' - just the date itself)",
      "end_date": "2027 or Jun 2027 or June 2027 or Present (EXTRACT ONLY the date, NOT phrases like 'Expected to end in' or 'Graduated in' - just the date itself)",
      "year": "2027 (ONLY use if start_date/end_date not available, otherwise leave empty)",
      "gpa": "3.80 (if mentioned)",
      "honors": "Merit Scholar (if mentioned)",
      "coursework": ["Relevant Course 1", "Relevant Course 2", ...] ${strategy.showCoursework ? "(ALWAYS include relevant courses that match job keywords)" : "(include if mentioned)"},
      "achievements": [
        "Achievement 1 (e.g., Dean's List, Research Project, Thesis Topic)",
        "Achievement 2 (e.g., Published Paper, Competition Winner)"
      ]
    }
  ],
  "certifications": ["Cert 1", "Cert 2", ...]
}

CRITICAL RULES:
- Extract ALL education entries (don't skip any)
- Extract ALL certifications
- **ALWAYS extract start_date and end_date if present in the CV** - look for date ranges like "2020-2024", "Sep 2020 - Jun 2024", "2020 to 2024", "Started 2020, Graduated 2024"
- **IMPORTANT**: For dates, extract ONLY the date itself (e.g., "June 2027", "2027", "Sep 2020") - DO NOT include phrases like "Expected to end in", "Graduated in", "Started in", etc.
- If you see "Expected to end in June 2027", extract ONLY "June 2027" as end_date
- If you see "Started 2020, Graduated 2024", extract "2020" as start_date and "2024" as end_date
- If only one date is present, extract it as end_date (graduation year) or start_date if clearly marked
- Include GPA and honors if mentioned
- For coursework: ${strategy.showCoursework ? "ALWAYS include courses that match job keywords, even if not explicitly mentioned - infer from degree/field" : "Include if mentioned in resume"}
- For achievements: Extract academic achievements, awards, research projects, publications, competitions, etc.
- Make coursework relevant to the job (prioritize courses matching job keywords)
- Each education entry should have 2-4 achievement bullets if available

Return ONLY valid JSON:
{
  "education": [...],
  "certifications": [...]
}`;

  try {
    const response = await callGemini(prompt, config);
    const cleaned = cleanJSONResponse(response);
    const data = JSON.parse(cleaned);
    
    // Clean up education dates - remove phrases from dates
    if (data.education && Array.isArray(data.education)) {
      data.education = data.education.map((edu: any) => {
        if (edu.start_date) {
          edu.start_date = edu.start_date.replace(/^(expected to (start|begin) in|started in|from|since)\s+/i, "").trim();
        }
        if (edu.end_date) {
          edu.end_date = edu.end_date.replace(/^(expected to end in|graduated in|until|to|ended in)\s+/i, "").trim();
        }
        // Remove duplicate dates
        if (edu.start_date && edu.end_date && edu.start_date === edu.end_date) {
          edu.start_date = "";
        }
        return edu;
      });
    }
    
    console.log(`[Focused Tailoring] Education: ${data.education?.length || 0}, Certifications: ${data.certifications?.length || 0}`);
    return {
      education: data.education || [],
      certifications: data.certifications || [],
    };
  } catch (error: any) {
    console.error(`[Focused Tailoring] Education extraction failed:`, error);
    return { education: [], certifications: [] };
  }
}

/**
 * Helper: Call Gemini API
 */
async function callGemini(prompt: string, config: any): Promise<string> {
  // Use fallback system for automatic provider switching
  try {
    const result = await callAIWithFallback(prompt, {
      preferredProvider: config.provider === "gemini" ? "gemini" : undefined,
    });
    return result.text;
  } catch (error: any) {
    // If fallback system fails, try direct Gemini call as last resort
    if (config.provider === "gemini" && config.apiKey) {
      console.log(`[Gemini] Fallback system failed, trying direct Gemini call...`);
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const modelName = config.model || "gemini-2.0-flash";
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (directError: any) {
        throw new Error(`All AI providers failed. Last error: ${directError.message}`);
      }
    }
    throw error;
  }
}

/**
 * Helper: Clean JSON response (remove markdown, etc.)
 */
function cleanJSONResponse(text: string): string {
  let cleaned = text.trim();
  
  // Remove markdown code blocks
  if (cleaned.includes("```json")) {
    cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
  } else if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```\n?/g, "");
  }
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Helper: Extract keywords from job description
 */
function extractKeywordsFromJob(jobDescription: string): string[] {
  const keywords: string[] = [];
  const textLower = jobDescription.toLowerCase();
  
  // Comprehensive tech stack - languages, frameworks, tools, platforms
  const techStack = [
    // Languages
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Rust", "Go", "Kotlin", "Swift", "PHP", "Ruby", "Scala",
    // Frontend Frameworks
    "React", "Vue", "Angular", "Next.js", "Nuxt.js", "Svelte", "Ember", "Backbone",
    // Backend Frameworks
    "Node.js", "Express", "Django", "Flask", "FastAPI", "Spring", "Spring Boot", "ASP.NET", "Laravel", "Rails",
    // Databases
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQL", "NoSQL", "Cassandra", "DynamoDB", "Elasticsearch",
    // Cloud & DevOps
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitLab CI", "GitHub Actions",
    // CI/CD & Tools
    "CI/CD", "DevOps", "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Confluence",
    // ML/AI
    "Machine Learning", "ML", "AI", "Deep Learning", "TensorFlow", "PyTorch", "Scikit-learn", "Keras", "Pandas", "NumPy",
    // Other Technologies
    "REST API", "GraphQL", "gRPC", "Microservices", "API", "WebSocket", "RabbitMQ", "Kafka",
    // Testing
    "pytest", "Jest", "JUnit", "Mocha", "Cypress", "Selenium", "TDD", "BDD",
    // Methodologies
    "Agile", "Scrum", "Kanban", "SAFe",
    // Infrastructure
    "Linux", "Unix", "Windows", "Cloud", "Serverless", "Lambda", "ECS", "EKS",
  ];

  // Extract tech stack keywords (case-insensitive matching)
  techStack.forEach((tech) => {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(jobDescription)) {
      keywords.push(tech);
    }
  });

  // Extract tech stack from common patterns
  const techPatterns = [
    /(?:using|with|experience in|proficient in|knowledge of|familiar with)\s+([A-Z][a-zA-Z0-9\s\.]+?)(?:\s|,|\.|$)/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:framework|library|tool|platform|service)/gi,
    /(?:tech stack|technology stack|stack|technologies?)[:\s]+([A-Za-z0-9\s,\.]+?)(?:\n|\.|$)/gi,
  ];

  techPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(jobDescription)) !== null && keywords.length < 100) {
      const extracted = match[1]?.trim();
      if (extracted && extracted.length > 2 && extracted.length < 50) {
        // Check if it's a known tech or looks like a tech name
        const looksLikeTech = /^[A-Z][a-zA-Z0-9\s\.]+$/.test(extracted);
        if (looksLikeTech && !keywords.some(k => k.toLowerCase() === extracted.toLowerCase())) {
          keywords.push(extracted);
        }
      }
    }
  });

  // Also extract common phrases and methodologies
  const phrases = [
    "team leadership", "code review", "system design", "architecture", "software architecture",
    "performance optimization", "scalability", "security", "automation", "infrastructure",
    "distributed systems", "event-driven", "message queue", "containerization",
  ];
  phrases.forEach((phrase) => {
    if (textLower.includes(phrase)) {
      keywords.push(phrase);
    }
  });

  // Remove duplicates and return (prioritize exact matches)
  const uniqueKeywords = [...new Set(keywords)];
  
  // Sort by importance: exact tech stack matches first
  const techStackSet = new Set(techStack.map(t => t.toLowerCase()));
  uniqueKeywords.sort((a, b) => {
    const aIsTech = techStackSet.has(a.toLowerCase());
    const bIsTech = techStackSet.has(b.toLowerCase());
    if (aIsTech && !bIsTech) return -1;
    if (!aIsTech && bIsTech) return 1;
    return 0;
  });

  console.log(`[Focused Tailoring] Extracted ${uniqueKeywords.length} keywords from job description`);
  console.log(`[Focused Tailoring] Top keywords: ${uniqueKeywords.slice(0, 15).join(", ")}`);
  
  return uniqueKeywords;
}

/**
 * Helper: Build candidate context string
 * Extracts candidate profile information to help AI understand the candidate better
 */
function buildCandidateContext(rawText: string, structuredData?: any): string {
  const context: string[] = [];
  
  // Extract contact information
  const contactInfo = extractContactFromText(rawText);
  if (contactInfo.name || contactInfo.email) {
    context.push("CANDIDATE PROFILE:");
    if (contactInfo.name) context.push(`- Name: ${contactInfo.name}`);
    if (contactInfo.email) context.push(`- Email: ${contactInfo.email}`);
    if (contactInfo.location) context.push(`- Location: ${contactInfo.location}`);
  }
  
  // Extract strong skills (from structured data or raw text)
  const skills = extractStrongSkills(rawText, structuredData);
  if (skills.length > 0) {
    context.push("");
    context.push("CANDIDATE'S STRONG SKILLS:");
    context.push(`- ${skills.slice(0, 10).join(", ")}${skills.length > 10 ? ` (and ${skills.length - 10} more)` : ""}`);
  }
  
  // Extract domain/industry experience
  const domainExperience = extractDomainExperience(rawText, structuredData);
  if (domainExperience) {
    context.push("");
    context.push("CANDIDATE'S DOMAIN EXPERIENCE:");
    context.push(`- Primary Domain: ${domainExperience.primaryDomain}`);
    if (domainExperience.yearsOfExperience) {
      context.push(`- Total Years of Experience: ${domainExperience.yearsOfExperience} years`);
      context.push(`- Experience Level: ${domainExperience.yearsOfExperience >= 10 ? "Senior/Expert" : domainExperience.yearsOfExperience >= 5 ? "Mid-Senior" : domainExperience.yearsOfExperience >= 2 ? "Mid-Level" : "Junior"}`);
    }
    if (domainExperience.industries && domainExperience.industries.length > 0) {
      context.push(`- Industries: ${domainExperience.industries.join(", ")}`);
    }
  }
  
  // Extract career level/position
  const careerLevel = extractCareerLevel(rawText, structuredData);
  if (careerLevel) {
    context.push("");
    context.push("CANDIDATE'S CAREER LEVEL:");
    context.push(`- Current Level: ${careerLevel}`);
  }
  
  // Extract key achievements/highlights
  const achievements = extractKeyAchievements(rawText, structuredData);
  if (achievements.length > 0) {
    context.push("");
    context.push("CANDIDATE'S KEY ACHIEVEMENTS:");
    achievements.slice(0, 3).forEach((achievement, idx) => {
      context.push(`${idx + 1}. ${achievement}`);
    });
  }
  
  // Extract education level
  const educationLevel = extractEducationLevel(rawText, structuredData);
  if (educationLevel) {
    context.push("");
    context.push("CANDIDATE'S EDUCATION:");
    context.push(`- Highest Degree: ${educationLevel}`);
  }
  
  return context.length > 0 ? context.join("\n") + "\n" : "";
}

/**
 * Extract contact information from raw text
 */
function extractContactFromText(rawText: string): {
  name: string;
  email: string;
  location: string;
} {
  const contact: any = { name: "", email: "", location: "" };
  const lines = rawText.split("\n").slice(0, 10);
  const headerText = lines.join(" ");
  
  // Extract name
  const nameMatch = headerText.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
  if (nameMatch) contact.name = nameMatch[1].trim();
  
  // Extract email
  const emailMatch = headerText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) contact.email = emailMatch[1].trim();
  
  // Extract location (city, country pattern)
  const locationMatch = headerText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*[A-Z][a-z]+)/);
  if (locationMatch) contact.location = locationMatch[1].trim();
  
  return contact;
}

/**
 * Extract strong skills from resume
 */
function extractStrongSkills(rawText: string, structuredData?: any): string[] {
  const skills: string[] = [];
  
  // From structured data
  if (structuredData?.skills && Array.isArray(structuredData.skills)) {
    skills.push(...structuredData.skills.slice(0, 15));
  }
  
  // From raw text - look for skills section
  const textLower = rawText.toLowerCase();
  const skillsSectionMatch = rawText.match(/(?:skills|technical skills|technologies|tools)[:\n]+([^\n]+(?:\n[^\n]+){0,10})/i);
  if (skillsSectionMatch) {
    const skillsText = skillsSectionMatch[1];
    const commonTech = [
      "JavaScript", "TypeScript", "Python", "Java", "C++", "React", "Vue", "Angular",
      "Node.js", "Express", "Django", "FastAPI", "AWS", "Docker", "Kubernetes",
      "PostgreSQL", "MongoDB", "Git", "Linux", "Agile", "Machine Learning", "AI"
    ];
    commonTech.forEach(tech => {
      if (skillsText.includes(tech) && !skills.includes(tech)) {
        skills.push(tech);
      }
    });
  }
  
  return [...new Set(skills)].slice(0, 15);
}

/**
 * Extract domain experience
 */
function extractDomainExperience(rawText: string, structuredData?: any): {
  primaryDomain: string;
  yearsOfExperience?: number;
  industries?: string[];
} | null {
  const textLower = rawText.toLowerCase();
  const domains = [
    "software engineering", "software development", "web development", "mobile development",
    "data science", "machine learning", "artificial intelligence", "data analytics",
    "product management", "project management", "business analysis",
    "ui/ux design", "graphic design", "user experience",
    "devops", "cloud computing", "system administration",
    "cybersecurity", "information security",
    "finance", "fintech", "banking",
    "healthcare", "education", "e-commerce", "marketing"
  ];
  
  let primaryDomain = "General";
  const foundDomains: string[] = [];
  
  domains.forEach(domain => {
    if (textLower.includes(domain)) {
      foundDomains.push(domain);
      if (primaryDomain === "General") {
        primaryDomain = domain;
      }
    }
  });
  
  // Calculate years of experience from dates (improved parsing)
  let yearsOfExperience: number | undefined;
  
  // First, try structured data (more reliable)
  if (structuredData?.experience && Array.isArray(structuredData.experience)) {
    const experienceDates: number[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    structuredData.experience.forEach((exp: any) => {
      // Try various date formats
      const duration = exp.duration || exp.start_date || exp.end_date || "";
      const startDate = exp.start_date || "";
      const endDate = exp.end_date || "";
      
      // Parse duration strings like "May 2020 - Aug 2024" or "2020 - 2024"
      let startYear: number | null = null;
      let endYear: number | null = null;
      
      // Try start_date and end_date first
      if (startDate) {
        const yearMatch = startDate.match(/(\d{4})/);
        if (yearMatch) startYear = parseInt(yearMatch[1]);
      }
      if (endDate && (endDate.toLowerCase().includes("present") || endDate.toLowerCase().includes("current"))) {
        endYear = currentYear;
      } else if (endDate) {
        const yearMatch = endDate.match(/(\d{4})/);
        if (yearMatch) endYear = parseInt(yearMatch[1]);
      }
      
      // Try duration string
      if (!startYear && duration) {
        const durationMatch = duration.match(/(\d{4})\s*[-–]\s*(\d{4}|Present|Current)/);
        if (durationMatch) {
          startYear = parseInt(durationMatch[1]);
          if (durationMatch[2].toLowerCase().includes("present") || durationMatch[2].toLowerCase().includes("current")) {
            endYear = currentYear;
          } else {
            endYear = parseInt(durationMatch[2]);
          }
        }
      }
      
      if (startYear && !isNaN(startYear)) {
        experienceDates.push(startYear);
      }
    });
    
    if (experienceDates.length > 0) {
      const earliestYear = Math.min(...experienceDates);
      // Calculate total months/years more accurately
      yearsOfExperience = currentYear - earliestYear;
    }
  }
  
  // Fallback: parse from raw text
  if (!yearsOfExperience) {
    const datePatterns = [
      /(\d{4})\s*[-–]\s*(\d{4}|Present|Current)/g, // "2020 - 2024" or "2020 - Present"
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4}|Present|Current)/gi, // "May 2020 - Aug 2024"
    ];
    
    const dates: number[] = [];
    datePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(rawText)) !== null) {
        const startYear = parseInt(match[2] || match[1]);
        if (!isNaN(startYear)) dates.push(startYear);
      }
    });
    
    if (dates.length > 0) {
      const earliestYear = Math.min(...dates);
      const currentYear = new Date().getFullYear();
      yearsOfExperience = currentYear - earliestYear;
    }
  }
  
  return {
    primaryDomain,
    yearsOfExperience: yearsOfExperience && yearsOfExperience > 0 ? yearsOfExperience : undefined,
    industries: foundDomains.length > 0 ? foundDomains : undefined
  };
}

/**
 * Extract career level
 */
function extractCareerLevel(rawText: string, structuredData?: any): string | null {
  const textLower = rawText.toLowerCase();
  
  if (textLower.match(/\b(senior|sr\.|lead|principal|architect|director|vp|vice president|cto|ceo)\b/)) {
    return "Senior/Lead";
  } else if (textLower.match(/\b(mid|mid-level|experienced|3\+|5\+)\b/)) {
    return "Mid-Level";
  } else if (textLower.match(/\b(junior|jr\.|entry|associate|graduate|trainee|intern)\b/)) {
    return "Junior/Entry";
  }
  
  return null;
}

/**
 * Extract key achievements
 */
function extractKeyAchievements(rawText: string, structuredData?: any): string[] {
  const achievements: string[] = [];
  
  // Look for achievement indicators
  const achievementPatterns = [
    /(?:achieved|awarded|won|recognized|published|presented|led|managed|increased|improved|reduced|delivered)[^\.]{10,100}\./gi,
    /(?:%\s*improvement|\$\d+[KM]?|x\d+|\d+\s*users|\d+\s*team)/gi
  ];
  
  achievementPatterns.forEach(pattern => {
    const matches = rawText.match(pattern);
    if (matches) {
      achievements.push(...matches.slice(0, 5));
    }
  });
  
  return achievements.slice(0, 3);
}

/**
 * Extract education level
 */
function extractEducationLevel(rawText: string, structuredData?: any): string | null {
  const textLower = rawText.toLowerCase();
  
  if (textLower.match(/\b(phd|ph\.d\.|doctorate|doctoral)\b/)) {
    return "PhD/Doctorate";
  } else if (textLower.match(/\b(master|m\.s\.|m\.a\.|mba|msc|ma)\b/)) {
    return "Master's";
  } else if (textLower.match(/\b(bachelor|b\.s\.|b\.a\.|bs|ba|bsc)\b/)) {
    return "Bachelor's";
  } else if (textLower.match(/\b(associate|diploma|certificate)\b/)) {
    return "Associate/Certificate";
  }
  
  return null;
}

/**
 * Helper: Build job context string
 */
function buildJobContext(request: TailorRequest, jobYearsRequired?: number): string {
  return `
JOB DETAILS:
- Title: ${request.job_title || "Not specified"}
- Level: ${request.job_level || "Not specified"}
- Domain: ${request.domain || "General"}
${jobYearsRequired ? `- Years Required: ${jobYearsRequired}+ years` : ""}
${request.company_name ? `- Company: ${request.company_name}` : ""}
${request.company_description ? `- Company Description: ${request.company_description}` : ""}
${request.additional_context ? `- Additional Context: ${request.additional_context}` : ""}

JOB DESCRIPTION:
${request.job_description}
`;
}

/**
 * Extract years of experience required from job description
 */
function extractYearsRequiredFromJob(jobDescription: string): number | undefined {
  const textLower = jobDescription.toLowerCase();
  
  // Patterns to match: "2+ years", "3-5 years", "minimum 5 years", "at least 2 years"
  const patterns = [
    /(\d+)\+?\s*years?\s*(?:of\s*)?experience/i,
    /minimum\s*(?:of\s*)?(\d+)\s*years/i,
    /at\s*least\s*(\d+)\s*years/i,
    /(\d+)[-–](\d+)\s*years/i, // "3-5 years" - take the minimum
  ];
  
  let minYears: number | undefined;
  
  patterns.forEach(pattern => {
    const match = textLower.match(pattern);
    if (match) {
      const years = parseInt(match[1] || match[2]);
      if (!isNaN(years)) {
        if (!minYears || years < minYears) {
          minYears = years;
        }
      }
    }
  });
  
  return minYears;
}

