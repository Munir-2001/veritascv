/**
 * AI-Powered Resume Parser & Optimizer
 * 
 * Uses LLM (Gemini) to:
 * 1. Parse raw CV text into structured data
 * 2. Optimize content for impact and clarity
 * 3. Extract ALL sections accurately
 * 4. Enhance descriptions with action verbs and metrics
 */

import { getAIConfig } from "@/lib/config/ai";

interface ParsedResumeData {
  contact: {
    name: string;
    email: string;
    phone: string;
    linkedin?: string;
    github?: string;
    location?: string;
  };
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    location?: string;
    description: string;
    achievements?: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    gpa?: string;
    honors?: string;
    relevant_coursework?: string[];
  }>;
  skills: string[];
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    link?: string;
    achievements?: string[];
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    year: string;
    credential_id?: string;
  }>;
  summary?: string;
  achievements?: string[];
}

const RESUME_PARSING_PROMPT = `You are an expert resume parser. Your job is to extract ALL information from the resume accurately and structure it properly.

CRITICAL FORMATTING RULES:

1. EXPERIENCE SECTION:
   - Extract ALL job/work experience including:
     * Full-time jobs
     * Part-time jobs
     * Internships (ALL internships are work experience, not projects)
     * Co-op positions
     * Contract work
     * Research assistant positions (if at a company/lab with dates)
     * Teaching assistant positions (if paid, with dates)
     * Work-study positions
     * Temporary positions
   - Format: Company Name → Job Title → Dates → Bullet Points
   - Each experience entry MUST have:
     * company: The company name (extract accurately, don't mix with descriptions)
     * title: The job title/position (e.g., "Software Engineering Intern", "Part-time Developer", "Research Assistant")
     * duration: Employment dates (format: "Month Year - Month Year" or "Month Year - Present")
     * location: City, Country (if mentioned)
     * achievements: Array of ALL bullet points describing what the person did at that job
   - DO NOT include descriptions in the company name field
   - DO NOT attach dates to company names
   - Extract ALL bullet points/contributions the person made at each company
   - CRITICAL: Internships, co-ops, part-time jobs, and research positions ARE work experience - include them!
   - Only exclude: unpaid volunteer work (unless listed under "Experience"), personal projects (these go in Projects section)

2. PROJECTS SECTION:
   - Extract ONLY projects that are explicitly under a "Projects" heading
   - Each project should have: name, description, technologies, link (if any)
   - Do NOT extract projects from other sections

3. EDUCATION SECTION:
   - Extract degree, institution, year, GPA (if mentioned), honors, relevant coursework

4. SKILLS SECTION:
   - Extract ALL technical and professional skills mentioned

5. CERTIFICATIONS SECTION:
   - Extract name, issuer, year, credential ID (if present)

6. CONTACT INFORMATION:
   - Extract name, email, phone, LinkedIn, GitHub, location from header

IMPORTANT:
- Extract EVERYTHING accurately - don't skip any information
- Keep all factual information accurate - don't make up details
- For experience: Company name should be clean (no descriptions attached)
- For experience: All bullet points should be in the achievements array
- Preserve the original wording of bullet points (don't over-optimize)
- CRITICAL: Include ALL internships, co-ops, part-time jobs, and research positions in experience section - these ARE work experience!

Return ONLY valid JSON in this exact format:
{
  "contact": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "+1234567890",
    "linkedin": "linkedin.com/in/username",
    "github": "github.com/username",
    "location": "City, Country"
  },
  "experience": [
    {
      "title": "Software Engineering Intern",
      "company": "Google",
      "duration": "June 2024 - August 2024",
      "location": "Mountain View, CA",
      "achievements": [
        "Developed feature X resulting in Y improvement",
        "Collaborated with team on Z project"
      ]
    },
    {
      "title": "Research Assistant",
      "company": "MIT Computer Science Lab",
      "duration": "January 2024 - May 2024",
      "location": "Cambridge, MA",
      "achievements": [
        "Conducted research on topic A",
        "Published paper on B"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "University Name",
      "year": "2024",
      "gpa": "3.8/4.0",
      "honors": "Cum Laude, Dean's List",
      "relevant_coursework": ["Course 1", "Course 2"]
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "projects": [
    {
      "name": "Project Name",
      "description": "What it does and impact",
      "technologies": ["Tech 1", "Tech 2"],
      "link": "github.com/project",
      "achievements": ["Metric 1", "Metric 2"]
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "year": "2024",
      "credential_id": "ABC123"
    }
  ],
  "summary": "Brief professional summary highlighting key strengths",
  "achievements": ["Key achievement 1", "Key achievement 2"]
}`;

/**
 * Parse and optimize resume using AI
 */
export async function parseResumeWithAI(rawText: string): Promise<ParsedResumeData | null> {
  try {
    const config = getAIConfig();
    console.log(`[AI Parser] Using provider: ${config.provider}`);

    if (config.provider === "gemini") {
      return await parseWithGemini(rawText, config);
    } else {
      console.warn(`[AI Parser] Provider ${config.provider} not supported for parsing, falling back to Gemini`);
      return await parseWithGemini(rawText, config);
    }
  } catch (error: any) {
    console.error("[AI Parser] Error:", error.message);
    return null;
  }
}

/**
 * Parse with Google Gemini
 */
async function parseWithGemini(rawText: string, config: any): Promise<ParsedResumeData | null> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const model = genAI.getGenerativeModel({ 
      model: config.model || "gemini-1.5-flash",  // Use flash for speed
    });

    const prompt = `${RESUME_PARSING_PROMPT}

RESUME TEXT TO PARSE:
${rawText}

Remember: Return ONLY valid JSON, no markdown formatting, no explanations.`;

    console.log(`[AI Parser] Sending to Gemini (${rawText.length} chars)...`);
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log(`[AI Parser] Received response (${text.length} chars)`);

    // Clean up response (remove markdown if present)
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\n?/g, "");
    }

    const parsed = JSON.parse(cleanedText);
    
    console.log(`[AI Parser] Successfully parsed:`, {
      experience: parsed.experience?.length || 0,
      education: parsed.education?.length || 0,
      projects: parsed.projects?.length || 0,
      skills: parsed.skills?.length || 0,
      certifications: parsed.certifications?.length || 0,
    });

    return parsed;
  } catch (error: any) {
    console.error("[AI Parser] Gemini error:", error.message);
    throw error;
  }
}

/**
 * Convert AI-parsed data to our internal format
 */
export function convertToInternalFormat(aiData: ParsedResumeData): any {
  return {
    experience: (aiData.experience || []).map(exp => ({
      title: exp.title,
      company: exp.company,
      duration: exp.duration,
      location: exp.location,
      // Convert achievements array to bullets array (for consistency)
      bullets: exp.achievements || (exp.description ? [exp.description] : []),
      description: exp.achievements?.join("\n") || exp.description || "",
    })),
    education: aiData.education.map(edu => ({
      degree: edu.degree,
      institution: edu.institution,
      year: edu.year,
      gpa: edu.gpa,
      honors: edu.honors,
    })),
    skills: aiData.skills || [],
    projects: (aiData.projects || []).map(proj => ({
      name: proj.name,
      description: proj.description,
      technologies: proj.technologies || [],
      link: proj.link,
    })),
    certifications: (aiData.certifications || []).map(cert => ({
      name: cert.name,
      issuer: cert.issuer,
      year: cert.year,
    })),
    contact: aiData.contact,
    summary: aiData.summary,
    achievements: aiData.achievements,
  };
}

