import { getAIConfig } from "@/lib/config/ai";

interface TailorRequest {
  resume_text: string;
  structured_data: any;
  job_description: string;
  job_title?: string;
  job_level?: string;
  domain?: string;
  company_name?: string;
  company_description?: string;
  additional_context?: string;
}

interface TailorResponse {
  tailored_text: string;
  keywords_matched: string[];
  suggestions: {
    keywords: string[];
    missingSkills: string[];
    formatTips: string[];
    tone: string;
  };
}

interface AIConfig {
  provider: string;
  apiKey?: string;
  model: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Main entry point for resume tailoring
 */
export async function tailorResumeWithAI(
  request: TailorRequest
): Promise<TailorResponse> {
  const config = getAIConfig();

  switch (config.provider) {
    case "gemini":
      return await tailorWithGemini(request, config);
    case "openai":
      return await tailorWithOpenAI(request, config);
    case "anthropic":
      return await tailorWithAnthropic(request, config);
    case "groq":
      return await tailorWithGroq(request, config);
    case "local":
      return await tailorWithLocal(request, config);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

/**
 * Tailor resume using Google Gemini (FREE!)
 */
async function tailorWithGemini(
  request: TailorRequest,
  config: AIConfig
): Promise<TailorResponse> {
  if (!config.apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const genAI = new GoogleGenerativeAI(config.apiKey);
    // Use gemini-1.5-flash or gemini-pro (NOT gemini-1.5-pro)
    const modelName = config.model || "gemini-1.5-flash";
    console.log(`[Tailoring] Using Gemini model: ${modelName}`);
    
    const model = genAI.getGenerativeModel({ model: modelName });

    // Build comprehensive context from ALL job details
    const jobContext = `
JOB DETAILS:
- Title: ${request.job_title || "Not specified"}
- Level: ${request.job_level || "Not specified"}
- Domain: ${request.domain || "General"}
${request.company_name ? `- Company: ${request.company_name}` : ""}
${request.company_description ? `- Company Description: ${request.company_description}` : ""}
${request.additional_context ? `- Additional Context: ${request.additional_context}` : ""}

JOB DESCRIPTION:
${request.job_description}
`;

    const systemPrompt = `You are an expert resume writer, ATS optimization specialist, and keyword extraction expert. Your task is to intelligently optimize a resume for a specific job by:

**STEP 1: EXTRACT JOB KEYWORDS**
From the job description, extract:
- Technical skills (languages, frameworks, tools)
- Soft skills (leadership, collaboration, communication)
- Methodologies (Agile, Scrum, CI/CD)
- Domain knowledge (FinTech, ML, Cloud, etc.)
- Key responsibilities mentioned
- Required qualifications

**STEP 2: MAP KEYWORDS TO RESUME**
- Find where these keywords appear in the candidate's experience
- Identify which projects/experience are most relevant
- Note missing keywords that candidate doesn't have

**STEP 3: OPTIMIZE EVERY BULLET POINT**
For EACH experience bullet:
- Start with action verb (Led, Developed, Architected, Optimized, etc.)
- Weave in job keywords naturally (if relevant)
- Add quantifiable metrics (%, $, team size, users, time saved)
- Show IMPACT (what was the result?)

Example BEFORE: "Worked on Python code reviews"
Example AFTER: "Led cross-team Python code reviews for 12+ engineers, establishing standards adopted by 3 teams, reducing bugs by 25%"

**STEP 4: TAILOR SUMMARY**
Write 3-4 line professional summary that:
- Mirrors job title/level
- Includes top 5 keywords from job
- Highlights most relevant experience
- Shows enthusiasm for company/domain

**STEP 5: OPTIMIZE SKILLS SECTION**
- Put job-required skills FIRST
- Group by category (Languages, Frameworks, Tools)
- Include every skill mentioned in job description that candidate has

**STEP 6: ENHANCE PROJECTS & EDUCATION**
- For each project, add technologies matching job keywords
- Quantify project impact
- For education, include relevant coursework matching job

**OPTIMIZATION STRATEGY BY LEVEL:**
- **ENTRY/INTERNSHIP**: Emphasize projects (5+), education, certifications, potential. Use keywords like "eager", "learning", "hands-on"
- **MID-LEVEL**: Focus on achievements, impact, skills progression. Show growing responsibility
- **SENIOR/LEAD**: Highlight leadership, strategic decisions, business impact, mentoring. Use metrics ($, %, team size)
- **EXECUTIVE**: Strategic vision, P&L, organizational change, stakeholder management

**CRITICAL RULES:**
1. **NEVER fabricate** experience - only enhance what exists
2. **ALL sections MUST be complete** - if resume has 3 jobs, return 3 jobs
3. **USE job keywords** extensively but naturally
4. **QUANTIFY everything** - add metrics where missing (estimate reasonably)
5. **MATCH tone** to job level (humble for entry, confident for senior)

**OUTPUT FORMAT:**
Return ONLY valid JSON (no markdown, no explanation):

{
  "professional_summary": "Job-tailored 3-4 line summary with top keywords",
  "experience": [
    {
      "title": "Exact job title from resume",
      "company": "Company name",
      "duration": "May 2024 - Aug 2025",
      "bullets": [
        "Led Python automation reducing deployment time by 35%, supporting 10K+ users",
        "Established code review standards using pytest adopted by 3 teams (12+ engineers)"
      ]
    }
  ],
  "skills": ["Keyword1", "Keyword2", ...], 
  "projects": [
    {
      "name": "Project Name",
      "description": "Enhanced description with keywords and metrics",
      "technologies": ["Tech1", "Tech2"]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "institution": "University",
      "year": "2027",
      "gpa": "3.80",
      "honors": "Merit Scholar",
      "coursework": ["Course matching job keywords"]
    }
  ],
  "certifications": ["Cert 1", "Cert 2"]
}

**IMPORTANT:** Return COMPLETE data for ALL sections, not summaries!`;

    const userPrompt = `${jobContext}

CANDIDATE'S RAW RESUME TEXT:
${request.resume_text}

STRUCTURED DATA (may be incomplete):
${JSON.stringify(request.structured_data, null, 2)}

**YOUR TASK:**

1. **READ the entire raw resume text above** - this contains ALL the candidate's experience
2. **EXTRACT keywords** from the job description (list them)
3. **MAP keywords** to candidate's experience (which jobs/projects match?)
4. **REWRITE every bullet point** to:
   - Include job keywords naturally
   - Start with strong action verbs
   - Add quantifiable metrics (%, $, team size, impact)
   - Show results/impact
5. **OPTIMIZE sections** in this priority order based on job level "${request.job_level}":
   ${request.job_level === 'entry' || request.job_level === 'internship' 
     ? '- Projects FIRST (show potential)\n   - Education with coursework\n   - Certifications\n   - Skills (comprehensive)\n   - Experience (internships)'
     : request.job_level === 'senior' || request.job_level === 'lead' || request.job_level === 'executive'
     ? '- Leadership achievements FIRST\n   - Strategic impact with metrics\n   - Experience (focus on results)\n   - Skills (strategic)\n   - Education (brief)'
     : '- Experience with achievements\n   - Skills (relevant first)\n   - Projects\n   - Education\n   - Certifications'}
6. **WRITE professional summary** that mirrors the job posting tone and includes top keywords

**EXAMPLE OPTIMIZATION:**

Original: "Worked on code reviews"
Optimized: "Led cross-team Python code reviews for 12+ engineers, establishing coding standards and test strategies using pytest, reducing bugs by 25%"

**NOW OPTIMIZE THIS RESUME!**

Return complete JSON with ALL sections fully populated (all jobs, all projects, all education, etc.)`;

    console.log(`[Tailoring] Sending ${request.resume_text.length} chars to Gemini...`);
    console.log(`[Tailoring] Job context:`, jobContext.substring(0, 300));

    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const response = result.response;
    let tailoredText = response.text();

    console.log(`[Tailoring] ✅ Received Gemini response (${tailoredText.length} chars)`);
    console.log(`[Tailoring] FULL RESPONSE:`);
    console.log("=".repeat(80));
    console.log(tailoredText);
    console.log("=".repeat(80));

    // Clean up response (remove markdown if present)
    if (tailoredText.includes("```json")) {
      tailoredText = tailoredText.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    } else if (tailoredText.includes("```")) {
      tailoredText = tailoredText.replace(/```\n?/g, "");
    }

    // Try to parse the JSON response to validate
    try {
      const parsed = JSON.parse(tailoredText.trim());
      console.log(`[Tailoring] ✅ Response is valid JSON with sections:`, Object.keys(parsed));
      console.log(`[Tailoring] Data counts:`, {
        experience: parsed.experience?.length || 0,
        skills: parsed.skills?.length || 0,
        projects: parsed.projects?.length || 0,
        education: parsed.education?.length || 0,
        certifications: parsed.certifications?.length || 0,
      });
    } catch (e) {
      console.warn(`[Tailoring] ⚠️  Response is NOT valid JSON:`, e);
    }

    // Extract keywords and generate suggestions
    const keywords = extractKeywords(request.job_description);
    const suggestions = generateSuggestions(request, keywords);

    console.log(`[Tailoring] Extracted ${keywords.length} keywords:`, keywords.slice(0, 10));

    return {
      tailored_text: tailoredText,
      keywords_matched: keywords,
      suggestions,
    };
  } catch (error: any) {
    console.error("❌ Gemini API error:", error);
    console.error("Error details:", error.message, error.stack);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

/**
 * Tailor resume using Groq (FREE, Fast)
 * Groq uses OpenAI-compatible API, so we can use the OpenAI SDK
 */
async function tailorWithGroq(
  request: TailorRequest,
  config: AIConfig
): Promise<TailorResponse> {
  if (!config.apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  try {
    // @ts-ignore - Only needed for Groq provider (uses OpenAI-compatible API)
    const { OpenAI } = await import("openai");
    const groq = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://api.groq.com/openai/v1",
    });

    const systemPrompt = `You are an expert resume writer and career coach. Your task is to tailor a resume to match a specific job description.

Guidelines:
1. Keep the original structure and format
2. Highlight relevant experience and skills that match the job
3. Use keywords from the job description naturally
4. Quantify achievements where possible
5. Maintain professional tone
6. Keep it concise and ATS-friendly
7. Don't fabricate experience - only emphasize and rephrase existing content

Return the tailored resume text, maintaining the original format.`;

    const userPrompt = `Job Title: ${request.job_title || "Not specified"}
Job Level: ${request.job_level || "Not specified"}
Domain: ${request.domain || "Not specified"}

Job Description:
${request.job_description}

Original Resume:
${request.resume_text}

Please tailor this resume to match the job description. Keep the same structure but:
- Emphasize relevant experience
- Use keywords from the job description
- Highlight matching skills
- Adjust tone to match the role level
- Keep all original information, just rephrase and emphasize relevant parts`;

    const completion = await groq.chat.completions.create({
      model: config.model || "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 2000,
    });

    const tailoredText = completion.choices[0]?.message?.content || request.resume_text;

    // Extract keywords and generate suggestions
    const keywords = extractKeywords(request.job_description);
    const suggestions = generateSuggestions(request, keywords);

    return {
      tailored_text: tailoredText,
      keywords_matched: keywords,
      suggestions,
    };
  } catch (error: any) {
    if (error.code === "MODULE_NOT_FOUND" || error.message?.includes("Cannot find module")) {
      throw new Error("OpenAI SDK not installed. Run: npm install openai");
    }
    console.error("Groq API error:", error);
    throw new Error(`Groq API error: ${error.message}`);
  }
}

/**
 * Tailor resume using OpenAI
 */
async function tailorWithOpenAI(
  request: TailorRequest,
  config: AIConfig
): Promise<TailorResponse> {
  if (!config.apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  try {
    // @ts-ignore - Only needed for OpenAI provider
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    const systemPrompt = `You are an expert resume writer and career coach. Your task is to tailor a resume to match a specific job description.

Guidelines:
1. Keep the original structure and format
2. Highlight relevant experience and skills that match the job
3. Use keywords from the job description naturally
4. Quantify achievements where possible
5. Maintain professional tone
6. Keep it concise and ATS-friendly
7. Don't fabricate experience - only emphasize and rephrase existing content

Return the tailored resume text, maintaining the original format.`;

    const userPrompt = `Job Title: ${request.job_title || "Not specified"}
Job Level: ${request.job_level || "Not specified"}
Domain: ${request.domain || "Not specified"}

Job Description:
${request.job_description}

Original Resume:
${request.resume_text}

Please tailor this resume to match the job description. Keep the same structure but:
- Emphasize relevant experience
- Use keywords from the job description
- Highlight matching skills
- Adjust tone to match the role level
- Keep all original information, just rephrase and emphasize relevant parts`;

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 2000,
    });

    const tailoredText = completion.choices[0]?.message?.content || request.resume_text;

    // Extract keywords and generate suggestions
    const keywords = extractKeywords(request.job_description);
    const suggestions = generateSuggestions(request, keywords);

    return {
      tailored_text: tailoredText,
      keywords_matched: keywords,
      suggestions,
    };
  } catch (error: any) {
    if (error.code === "MODULE_NOT_FOUND" || error.message?.includes("Cannot find module")) {
      throw new Error("OpenAI SDK not installed. Run: npm install openai");
    }
    console.error("OpenAI API error:", error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Tailor resume using Anthropic (Claude)
 */
async function tailorWithAnthropic(
  request: TailorRequest,
  config: AIConfig
): Promise<TailorResponse> {
  if (!config.apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  try {
    // @ts-ignore - Only needed for Anthropic provider
    const { Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    const systemPrompt = `You are an expert resume writer and career coach. Your task is to tailor a resume to match a specific job description.

Guidelines:
1. Keep the original structure and format
2. Highlight relevant experience and skills that match the job
3. Use keywords from the job description naturally
4. Quantify achievements where possible
5. Maintain professional tone
6. Keep it concise and ATS-friendly
7. Don't fabricate experience - only emphasize and rephrase existing content

Return the tailored resume text, maintaining the original format.`;

    const userPrompt = `Job Title: ${request.job_title || "Not specified"}
Job Level: ${request.job_level || "Not specified"}
Domain: ${request.domain || "Not specified"}

Job Description:
${request.job_description}

Original Resume:
${request.resume_text}

Please tailor this resume to match the job description. Keep the same structure but:
- Emphasize relevant experience
- Use keywords from the job description
- Highlight matching skills
- Adjust tone to match the role level
- Keep all original information, just rephrase and emphasize relevant parts`;

    const message = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.7,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const tailoredText =
      message.content[0]?.type === "text"
        ? message.content[0].text
        : request.resume_text;

    // Extract keywords and generate suggestions
    const keywords = extractKeywords(request.job_description);
    const suggestions = generateSuggestions(request, keywords);

    return {
      tailored_text: tailoredText,
      keywords_matched: keywords,
      suggestions,
    };
  } catch (error: any) {
    if (error.code === "MODULE_NOT_FOUND" || error.message?.includes("Cannot find module")) {
      throw new Error("Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk");
    }
    console.error("Anthropic API error:", error);
    throw new Error(`Anthropic API error: ${error.message}`);
  }
}

/**
 * Tailor resume using Local AI (Ollama)
 */
async function tailorWithLocal(
  request: TailorRequest,
  config: AIConfig
): Promise<TailorResponse> {
  const baseURL = config.baseURL || "http://localhost:11434";

  const systemPrompt = `You are an expert resume writer. Tailor resumes to match job descriptions.`;

  const userPrompt = `Job Title: ${request.job_title || "Not specified"}
Job Description:
${request.job_description}

Original Resume:
${request.resume_text}

Tailor this resume to match the job description.`;

  try {
    const response = await fetch(`${baseURL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Local AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const tailoredText = data.response || request.resume_text;

    const keywords = extractKeywords(request.job_description);
    const suggestions = generateSuggestions(request, keywords);

    return {
      tailored_text: tailoredText,
      keywords_matched: keywords,
      suggestions,
    };
  } catch (error: any) {
    console.error("Local AI error:", error);
    throw new Error(`Local AI error: ${error.message}`);
  }
}

/**
 * Extract keywords from job description
 */
function extractKeywords(text: string): string[] {
  const commonTech = [
    "JavaScript",
    "TypeScript",
    "Python",
    "Java",
    "C++",
    "C#",
    "Rust",
    "Go",
    "React",
    "Vue",
    "Angular",
    "Node.js",
    "Express",
    "Django",
    "FastAPI",
    "Next.js",
    "AWS",
    "Azure",
    "GCP",
    "Docker",
    "Kubernetes",
    "PostgreSQL",
    "MongoDB",
    "MySQL",
    "Redis",
    "SQL",
    "NoSQL",
    "Machine Learning",
    "AI",
    "Deep Learning",
    "TensorFlow",
    "PyTorch",
    "Agile",
    "Scrum",
    "CI/CD",
    "Git",
    "GitHub",
    "GitLab",
    "Linux",
    "REST API",
    "GraphQL",
    "Microservices",
    "Cloud",
    "DevOps",
    "Testing",
    "TDD",
    "Leadership",
    "Team Management",
  ];

  const keywords: string[] = [];
  const textLower = text.toLowerCase();

  commonTech.forEach((tech) => {
    if (textLower.includes(tech.toLowerCase())) {
      keywords.push(tech);
    }
  });

  return keywords;
}

/**
 * Generate suggestions based on job and resume
 */
function generateSuggestions(
  request: TailorRequest,
  keywords: string[]
): TailorResponse["suggestions"] {
  const resumeSkills = request.structured_data?.skills || [];
  const resumeText = request.resume_text.toLowerCase();

  // Find missing skills
  const missingSkills = keywords.filter(
    (keyword) =>
      !resumeSkills.some(
        (skill: string) => skill.toLowerCase() === keyword.toLowerCase()
      ) && !resumeText.includes(keyword.toLowerCase())
  );

  // Format tips based on job level
  const formatTips: string[] = [];
  if (request.job_level === "entry" || request.job_level === "junior") {
    formatTips.push("Emphasize projects and education");
    formatTips.push("Highlight relevant coursework and certifications");
  } else if (request.job_level === "senior" || request.job_level === "executive") {
    formatTips.push("Lead with achievements and impact");
    formatTips.push("Quantify business results and team leadership");
  } else {
    formatTips.push("Use action verbs to start bullet points");
    formatTips.push("Quantify achievements with metrics");
  }

  // Tone based on domain
  let tone = "Professional";
  if (request.domain?.toLowerCase().includes("creative")) {
    tone = "Creative and engaging";
  } else if (request.domain?.toLowerCase().includes("technical")) {
    tone = "Technical and precise";
  }

  return {
    keywords: keywords.slice(0, 15),
    missingSkills: missingSkills.slice(0, 5),
    formatTips,
    tone,
  };
}
