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

const RESUME_PARSING_PROMPT = `You are an expert resume parser and career coach. Your job is to:
1. Extract ALL information from the resume accurately
2. Optimize descriptions for impact (action verbs, quantifiable metrics)
3. Structure the data properly
4. Maintain factual accuracy while improving clarity

IMPORTANT RULES:
- Extract EVERY piece of information (don't skip anything)
- For experience: Include job title, company, dates, location, and ALL bullet points
- For education: Include degree, school, graduation year, GPA if mentioned, honors
- For projects: Extract name, description, technologies used, links if any
- For skills: List ALL technical and professional skills mentioned
- For certifications: Include name, issuer, year, credential ID if present
- Optimize bullet points: Start with action verbs, add metrics where possible
- Keep all factual information accurate - don't make up details

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
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Month Year - Month Year",
      "location": "City, Country",
      "description": "Main role description",
      "achievements": [
        "Led team of X engineers to deliver Y resulting in Z% improvement",
        "Developed system handling X users with Y% uptime"
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
    experience: aiData.experience.map(exp => ({
      title: exp.title,
      company: exp.company,
      duration: exp.duration,
      location: exp.location,
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
    projects: aiData.projects.map(proj => ({
      name: proj.name,
      description: proj.description,
      technologies: proj.technologies || [],
      link: proj.link,
    })),
    certifications: aiData.certifications.map(cert => ({
      name: cert.name,
      issuer: cert.issuer,
      year: cert.year,
    })),
    contact: aiData.contact,
    summary: aiData.summary,
    achievements: aiData.achievements,
  };
}

