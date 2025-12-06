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
  const experience = await optimizeExperience(
    request.raw_text,
    jobContext,
    candidateContext,
    keywords,
    strategy,
    toneInstructions,
    config
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
    config
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
Generate a compelling "Career Objective" section that is EXACTLY 40 words (no more, no less) that:
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
- EXACTLY 40 words (count carefully)
- Hyper-personalized to the candidate's background
- Must include career aspirations/goals related to the job
- Must show alignment with job description
- Use ONLY information from the candidate's resume (don't fabricate)
- Professional but passionate tone

Return ONLY the Career Objective text (EXACTLY 40 words), no markdown, no JSON, just the paragraph.`;

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
Generate a 3-4 line professional summary written in FIRST PERSON (use "I", "my", "me") that:
1. Mirrors the job title and level
2. Includes the top 5 most relevant keywords from the job description
3. Highlights the candidate's most relevant experience and achievements (from the raw text above)
4. Shows enthusiasm for the role/company/domain
5. Uses the candidate's actual background, skills, and domain experience from the candidate context
6. Makes it highly personalized - reference specific technologies, years of experience, or achievements
7. Matches the tone: ${strategy.summaryStyle === "objective" ? "Eager, learning-focused" : strategy.summaryStyle === "executive" ? "Confident, strategic" : "Professional, achievement-focused"}

CRITICAL REQUIREMENTS:
- MUST be in FIRST PERSON (I, my, me) - NOT third person
- **USE THE CANDIDATE'S ACTUAL YEARS OF EXPERIENCE FROM THE CANDIDATE CONTEXT** - DO NOT use years from the job description requirements
- If candidate context shows "Years of Experience: X", use that EXACT number (e.g., "5 years", "3 years")
- If candidate has MORE experience than job requires, use a confident, powerful tone
- If candidate has LESS experience than job requires, focus on skills, achievements, and potential
- Extract actual experience from the raw text (don't fabricate)
- Use specific technologies/skills mentioned in the job AND candidate's strong skills
- Reference candidate's domain experience and years of experience from candidate context
- Keep it concise (3-4 lines max)
- Make it compelling, personalized, and ATS-friendly
- Use the candidate context to personalize (mention their domain, key skills, achievements)

EXAMPLES (using candidate's actual years):
- "I am a 5-year experienced [domain] professional with expertise in [key skills]. I have [achievement]..."
- "With 5 years in [domain], I specialize in [technologies] and have [achievement]..."
- "I bring 5 years of experience in [domain], where I've [achievement] using [technologies]..."

IMPORTANT: The candidate context above shows the candidate's ACTUAL years of experience. Use that number, NOT the job requirement!

Return ONLY the summary text in FIRST PERSON, no markdown, no JSON, just the summary paragraph.`;

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
  config: any
): Promise<TailoredSections["experience"]> {
  const prompt = `You are an expert resume writer. Extract and optimize work experience from a resume.

${jobContext}

${candidateContext}

${toneInstructions}

KEYWORDS TO MATCH: ${keywords.slice(0, 20).join(", ")}

CANDIDATE'S RESUME (raw text):
${rawText}

IMPORTANT: The JOB DESCRIPTION above contains the requirements and responsibilities for the position. Use it to:
- Match the language and terminology used in the job description
- Align bullet points with the specific requirements mentioned
- Use similar phrasing and keywords from the job description
- Ensure each bullet point addresses something relevant to the job

TASK:
1. EXTRACT all work experience from the raw text (job titles, companies, dates, responsibilities)
2. For EACH job, create EXACTLY 2 highly impactful bullet points that:
   - Start with strong action verbs (Led, Developed, Architected, etc.)
   - Closely match and resemble the job description requirements
   - Use existing bullets from the resume but enhance them to match job description
   - Weave in job keywords naturally (from the list above)
   - Add quantifiable metrics (%, $, team size, users, time saved) - estimate reasonably if not present
   - Show IMPACT and RESULTS that align with job requirements
   - Use similar language/phrasing as the job description
   - Highlight achievements that directly address job requirements

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
    const response = await callGemini(prompt, config);
    const cleaned = cleanJSONResponse(response);
    const experience = JSON.parse(cleaned);
    console.log(`[Focused Tailoring] Experience extracted: ${experience.length} jobs`);
    return experience;
  } catch (error: any) {
    console.error(`[Focused Tailoring] Experience extraction failed:`, error);
    return []; // Fallback
  }
}

/**
 * Step 3: Match Projects
 */
async function matchProjects(
  rawText: string,
  jobContext: string,
  candidateContext: string,
  keywords: string[],
  strategy: any,
  toneInstructions: string,
  config: any
): Promise<TailoredSections["projects"]> {
  // Skip projects for senior/executive if strategy says so
  if (strategy.projectsImportance === "skip") {
    console.log(`[Focused Tailoring] Skipping projects (strategy: skip)`);
    return [];
  }

  const prompt = `You are an expert resume writer. Extract and optimize projects from a resume.

${jobContext}

${candidateContext}

${toneInstructions}

KEYWORDS TO MATCH: ${keywords.slice(0, 20).join(", ")}

CANDIDATE'S RESUME (raw text):
${rawText}

IMPORTANT: The JOB DESCRIPTION above contains the requirements and technologies for the position. Use it to:
- Match the technologies and tech stack mentioned in the job description
- Align project descriptions with the specific requirements
- Use similar language and keywords from the job description
- Ensure projects demonstrate skills directly needed for the job
- HIGHLIGHT and ADD technologies from the job description to each project

TASK:
1. EXTRACT all projects from the raw text
2. For EACH project, enhance it to:
   - Closely tie to the job description requirements
   - MATCH and ADD technologies from the job description tech stack (prioritize these)
   - Include technologies from the job description even if not originally in the project
   - Add quantifiable achievements/metrics in bullet format
   - Show direct relevance to the job
   - Use similar language/phrasing as the job description
   - Format achievements as BULLET POINTS (not paragraphs)

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
    const response = await callGemini(prompt, config);
    const cleaned = cleanJSONResponse(response);
    const projects = JSON.parse(cleaned);
    console.log(`[Focused Tailoring] Projects extracted: ${projects.length} projects`);
    return projects;
  } catch (error: any) {
    console.error(`[Focused Tailoring] Projects extraction failed:`, error);
    return []; // Fallback
  }
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
): Promise<string[]> {
  const prompt = `You are an expert resume writer. Extract and optimize technical skills from a resume.

${jobContext}

KEYWORDS FROM JOB: ${keywords.slice(0, 30).join(", ")}

CANDIDATE'S RESUME (raw text):
${rawText}

TASK:
1. Extract ALL technical skills from the resume (languages, frameworks, tools, technologies)
2. Extract ALL technical skills mentioned in the job description
3. Combine both lists, prioritizing:
   - Skills that appear in BOTH resume and job description (matched: true)
   - Skills from job description that are relevant (matched: true)
   - Skills from resume that are relevant to the field (matched: false)
4. Include common industry skills if needed to reach 10-15 skills total

Return ONLY a JSON array of objects:
[
  {"skill": "Python", "matched": true},  // In both resume and JD
  {"skill": "React", "matched": true},   // In JD (even if not in resume)
  {"skill": "Git", "matched": false}     // In resume only, but relevant
]

CRITICAL:
- Include skills from BOTH resume AND job description
- Prioritize skills that match job description keywords
- Include 10-15 skills total (more comprehensive)
- Mark skills that match job description with matched: true
- Mark skills from resume only with matched: false (but still include them if relevant)
- No duplicates
- Be comprehensive - include all relevant technologies`;

  try {
    const response = await callGemini(prompt, config);
    const cleaned = cleanJSONResponse(response);
    const skills = JSON.parse(cleaned);
    console.log(`[Focused Tailoring] Technical skills extracted: ${skills.length} skills`);
    return skills;
  } catch (error: any) {
    console.error(`[Focused Tailoring] Skills extraction failed:`, error);
    return []; // Fallback
  }
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
      "start_date": "2020 or Sep 2020 or September 2020 (EXTRACT if mentioned in CV - look for 'from', 'started', dates at beginning)",
      "end_date": "2027 or Jun 2027 or June 2027 or Present (EXTRACT if mentioned in CV - look for 'to', 'until', 'graduated', dates at end)",
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
  const commonTech = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Rust", "Go",
    "React", "Vue", "Angular", "Node.js", "Express", "Django", "FastAPI",
    "AWS", "Docker", "Kubernetes", "PostgreSQL", "MongoDB", "SQL",
    "Machine Learning", "AI", "Deep Learning", "TensorFlow", "PyTorch",
    "Agile", "Scrum", "CI/CD", "DevOps", "Microservices", "API",
    "Git", "Linux", "Cloud", "Testing", "pytest", "Jest",
  ];

  const textLower = jobDescription.toLowerCase();
  commonTech.forEach((tech) => {
    if (textLower.includes(tech.toLowerCase())) {
      keywords.push(tech);
    }
  });

  // Also extract common phrases
  const phrases = [
    "team leadership", "code review", "system design", "architecture",
    "performance optimization", "scalability", "security", "automation",
  ];
  phrases.forEach((phrase) => {
    if (textLower.includes(phrase)) {
      keywords.push(phrase);
    }
  });

  return [...new Set(keywords)]; // Remove duplicates
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

