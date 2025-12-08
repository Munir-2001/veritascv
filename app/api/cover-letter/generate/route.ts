import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAIWithFallback } from "@/lib/ai/fallback";

/**
 * API Route: POST /api/cover-letter/generate
 * 
 * Generates a personalized cover letter using AI
 * Focuses on making it feel very personalized and not AI-detected
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      application_id,
      job_title,
      job_description,
      company_name,
      company_description,
      recruiter_name,
      recruiter_email,
      job_level,
      domain,
      resume_raw_text,
      resume_structured_data,
      candidate_name,
      candidate_email,
      additional_context,
    } = body;

    if (!application_id || !job_title || !job_description || !resume_raw_text) {
      return NextResponse.json(
        { error: "Missing required fields: application_id, job_title, job_description, resume_raw_text" },
        { status: 400 }
      );
    }

    // Build candidate context from resume
    const candidateContext = buildCandidateContext(resume_raw_text, resume_structured_data);
    
    // Build job context
    const jobContext = buildJobContext(
      job_title,
      job_description,
      company_name,
      company_description,
      job_level,
      domain
    );

    // Build personalization details
    const personalization = buildPersonalization(
      recruiter_name,
      recruiter_email,
      company_name,
      candidate_name,
      candidate_email
    );

    // Create the prompt - designed to be very personalized and avoid AI detection
    const prompt = `You are a professional career coach helping a candidate write a highly personalized cover letter. The letter must feel authentic, genuine, and written by a real person - NOT by AI. 

CRITICAL REQUIREMENTS:
- Write in FIRST PERSON (I, my, me) - make it personal and authentic
- Use natural, conversational but professional language - avoid overly formal or robotic phrases
- Include SPECIFIC details from the candidate's resume - reference actual projects, achievements, or experiences
- Show genuine enthusiasm and interest in THIS specific role and company
- Vary sentence structure and length - don't use repetitive patterns
- Use transition words naturally (However, Moreover, Additionally, etc.)
- Avoid clichés like "I am writing to express my interest" - be more direct and personal
- Make it feel like a real person wrote it after researching the company and role

COVER LETTER SPECIFICATIONS:
- Length: 300-400 words EXACTLY (3-4 concise paragraphs) - CRITICAL: Must be between 300-400 words
- Structure: Introduction → Body (2-3 paragraphs) → Closing
- One page maximum
- Professional but warm tone
- Include specific achievements using STAR method (Situation, Task, Action, Result)
- Mirror keywords from job description naturally
- Strong call to action requesting an interview

CANDIDATE PROFILE:
${candidateContext}

JOB DETAILS:
${jobContext}

PERSONALIZATION:
${personalization}

${additional_context ? `ADDITIONAL CONTEXT:\n${additional_context}\n` : ""}

INSTRUCTIONS:
1. Write a cover letter that feels completely authentic and personalized
2. Reference specific projects, achievements, or experiences from the candidate's background
3. Show clear connection between candidate's skills and the job requirements
4. Use keywords from the job description naturally (don't force them)
5. Make it feel like the candidate researched the company and is genuinely interested
6. Avoid any phrases that sound AI-generated
7. Write in a natural, conversational professional tone
8. Include a strong call to action
9. MUST use the company name, job title, and job level in the letter naturally
10. If company description is provided, reference something specific about the company to show research
11. Adjust tone based on job level (entry = eager, mid = confident, senior = authoritative)
12. If domain/industry is provided, show understanding of that industry

CRITICAL: 
- Start DIRECTLY with the cover letter content (greeting, date, or first paragraph)
- DO NOT include any introductory text like "Okay, here's a draft..." or "I've generated..."
- DO NOT include any meta-commentary about the letter itself
- DO NOT include phrases like "designed to feel" or "I've focused on"
- Return ONLY the cover letter text, nothing else

Generate the cover letter now. Write it as if the candidate wrote it themselves after careful research and reflection. Make it feel personal, authentic, and compelling. Start directly with the letter content.`;

    console.log("[Cover Letter] Generating personalized cover letter...");
    console.log("[Cover Letter] Application ID:", application_id);
    console.log("[Cover Letter] Job Title:", job_title);
    console.log("[Cover Letter] Company:", company_name || "Not provided");
    console.log("[Cover Letter] Job Level:", job_level || "Not provided");
    console.log("[Cover Letter] Domain:", domain || "Not provided");
    console.log("[Cover Letter] Recruiter:", recruiter_name || "Not provided");

    // Generate cover letter using Groq with fallback
    console.log("[Cover Letter] Using AI fallback system (Groq → Gemini → others)...");
    const { text: rawCoverLetterText, provider, model } = await callAIWithFallback(prompt, {
      preferredProvider: "groq", // Prefer Groq as default
    });
    
    console.log(`[Cover Letter] Generated using ${provider}/${model}`);
    
    // Clean up the response (remove markdown formatting if present)
    let coverLetterText = cleanCoverLetterText(rawCoverLetterText);

    // Validate length (300-400 words) - regenerate if needed
    let wordCount = coverLetterText.split(/\s+/).filter(w => w.length > 0).length;
    let attempts = 0;
    const maxAttempts = 2;
    
    while ((wordCount < 300 || wordCount > 400) && attempts < maxAttempts) {
      if (wordCount < 300) {
        console.warn(`[Cover Letter] Warning: Cover letter is too short (${wordCount} words). Target: 300-400. Regenerating...`);
        // Add instruction to make it longer
        const extendedPrompt = prompt + "\n\nIMPORTANT: The previous attempt was too short. Please ensure the cover letter is between 300-400 words. Add more specific details about the candidate's experience and achievements.";
        const { text: newText } = await callAIWithFallback(extendedPrompt, {
          preferredProvider: provider, // Use same provider
        });
        coverLetterText = cleanCoverLetterText(newText);
        wordCount = coverLetterText.split(/\s+/).filter(w => w.length > 0).length;
      } else if (wordCount > 400) {
        console.warn(`[Cover Letter] Warning: Cover letter is too long (${wordCount} words). Truncating to 400 words...`);
        // Truncate to exactly 400 words
        const words = coverLetterText.split(/\s+/).filter(w => w.length > 0);
        coverLetterText = words.slice(0, 400).join(" ");
        wordCount = 400;
      }
      attempts++;
    }
    
    // Final validation - if still not in range, truncate or pad
    if (wordCount < 300) {
      console.warn(`[Cover Letter] Final warning: Cover letter is ${wordCount} words (target: 300-400). Consider regenerating.`);
    } else if (wordCount > 400) {
      const words = coverLetterText.split(/\s+/).filter(w => w.length > 0);
      coverLetterText = words.slice(0, 400).join(" ");
      wordCount = 400;
      console.log(`[Cover Letter] Truncated to exactly 400 words.`);
    }

    console.log(`[Cover Letter] ✅ Generated cover letter: ${wordCount} words (target: 300-400)`);

    return NextResponse.json({
      success: true,
      cover_letter: coverLetterText,
      word_count: wordCount,
    });
  } catch (error: any) {
    console.error("Cover letter generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate cover letter" },
      { status: 500 }
    );
  }
}

/**
 * Build candidate context from resume
 */
function buildCandidateContext(rawText: string, structuredData?: any): string {
  let context = "CANDIDATE BACKGROUND:\n";
  
  // Extract key information from raw text
  const lines = rawText.split("\n").filter((l: string) => l.trim());
  const relevantLines = lines.slice(0, 30).join("\n"); // First 30 lines usually contain key info
  
  context += `Resume Summary:\n${relevantLines}\n\n`;
  
  // Add structured data if available
  if (structuredData) {
    if (structuredData.experience && structuredData.experience.length > 0) {
      context += "Key Experience:\n";
      structuredData.experience.slice(0, 3).forEach((exp: any, idx: number) => {
        context += `${idx + 1}. ${exp.title || exp.job_title || "Position"} at ${exp.company || "Company"}\n`;
        if (exp.description) {
          context += `   ${exp.description.substring(0, 150)}...\n`;
        }
      });
      context += "\n";
    }
    
    if (structuredData.projects && structuredData.projects.length > 0) {
      context += "Notable Projects:\n";
      structuredData.projects.slice(0, 2).forEach((proj: any, idx: number) => {
        context += `${idx + 1}. ${proj.name || "Project"}\n`;
        if (proj.description) {
          context += `   ${proj.description.substring(0, 100)}...\n`;
        }
      });
      context += "\n";
    }
    
    if (structuredData.skills && structuredData.skills.length > 0) {
      const skills = structuredData.skills.map((s: any) => 
        typeof s === 'object' ? s.skill : s
      ).slice(0, 10);
      context += `Key Skills: ${skills.join(", ")}\n\n`;
    }
  }
  
  return context;
}

/**
 * Build job context - uses ALL job parameters
 */
function buildJobContext(
  jobTitle: string,
  jobDescription: string,
  companyName?: string,
  companyDescription?: string,
  jobLevel?: string,
  domain?: string
): string {
  let context = `JOB POSITION DETAILS:\n`;
  context += `Job Title: ${jobTitle}\n`;
  
  if (companyName) {
    context += `Company Name: ${companyName}\n`;
  } else {
    context += `Company Name: Not specified (use "Hiring Manager" or company name if mentioned in job description)\n`;
  }
  
  if (companyDescription) {
    context += `Company Description: ${companyDescription.substring(0, 500)}\n`;
  }
  
  if (jobLevel) {
    context += `Job Level: ${jobLevel} (adjust tone accordingly - entry level = eager learner, senior = experienced professional)\n`;
  }
  
  if (domain) {
    context += `Industry/Domain: ${domain}\n`;
  }
  
  context += `\nFULL JOB DESCRIPTION:\n${jobDescription}\n`;
  
  // Extract key requirements/keywords
  const keywords = extractKeywords(jobDescription);
  if (keywords.length > 0) {
    context += `\nKEY REQUIREMENTS/KEYWORDS TO MENTION: ${keywords.slice(0, 20).join(", ")}\n`;
    context += `\nIMPORTANT: Naturally incorporate these keywords into the cover letter to show alignment with the job requirements.\n`;
  }
  
  return context;
}

/**
 * Build personalization details
 */
function buildPersonalization(
  recruiterName?: string,
  recruiterEmail?: string,
  companyName?: string,
  candidateName?: string,
  candidateEmail?: string
): string {
  let personalization = "PERSONALIZATION DETAILS:\n";
  
  if (recruiterName) {
    personalization += `Recruiter Name: ${recruiterName}\n`;
  }
  
  if (recruiterEmail) {
    personalization += `Recruiter Email: ${recruiterEmail}\n`;
  }
  
  if (companyName) {
    personalization += `Company Name: ${companyName}\n`;
  }
  
  if (candidateName) {
    personalization += `Candidate Name: ${candidateName}\n`;
  }
  
  if (candidateEmail) {
    personalization += `Candidate Email: ${candidateEmail}\n`;
  }
  
  personalization += "\nINSTRUCTIONS:\n";
  personalization += "- If recruiter name is provided, address the letter to them directly\n";
  personalization += "- If only company name is provided, address to 'Hiring Manager' or company name\n";
  personalization += "- Use candidate's name in the signature if available\n";
  personalization += "- Make the greeting and closing feel personal and warm\n";
  
  return personalization;
}

/**
 * Extract keywords from job description
 */
function extractKeywords(jobDescription: string): string[] {
  const commonKeywords = [
    "JavaScript", "TypeScript", "Python", "Java", "React", "Node.js", "AWS", "Docker",
    "Agile", "Scrum", "Machine Learning", "AI", "Data Science", "Full Stack", "Backend", "Frontend",
    "API", "REST", "GraphQL", "Database", "SQL", "NoSQL", "DevOps", "CI/CD", "Git",
    "Leadership", "Team", "Communication", "Problem Solving", "Analytical", "Collaboration"
  ];
  
  const textLower = jobDescription.toLowerCase();
  const foundKeywords: string[] = [];
  
  commonKeywords.forEach(keyword => {
    if (textLower.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  });
  
  return foundKeywords;
}

/**
 * Clean cover letter text (remove markdown, extra formatting, AI prefixes)
 */
function cleanCoverLetterText(text: string): string {
  // Remove markdown code blocks
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`/g, "");
  
  // Remove common AI prefixes and introductory phrases (more comprehensive)
  const prefixesToRemove = [
    // "Okay, here's a draft..." variations
    /^Okay,?\s+here'?s?\s+(a\s+)?(draft\s+of\s+)?(a\s+)?cover\s+letter\s+(for\s+[^,]+,\s+)?(tailored\s+to\s+[^.]+\s+)?(designed\s+to\s+feel\s+[^.]+\s+)?[.\s]*/i,
    /^Okay,?\s+here'?s?\s+(a\s+)?(draft\s+of\s+)?(a\s+)?cover\s+letter[^.]*?[.\s]*/i,
    
    // "Here's a draft..." variations
    /^Here'?s?\s+(a\s+)?(draft\s+of\s+)?(a\s+)?cover\s+letter[^.]*?[.\s]*/i,
    /^Here'?s?\s+(the\s+)?cover\s+letter[^.]*?[.\s]*/i,
    
    // "I've generated/created..." variations
    /^I'?ve\s+(generated|created|written|drafted)\s+(a\s+)?cover\s+letter[^.]*?[.\s]*/i,
    /^Generated\s+cover\s+letter[^.]*?[.\s]*/i,
    
    // "I've focused on..." variations
    /^[^A-Z]*?I'?ve\s+focused\s+on\s+making\s+it\s+sound[^.]*?[.\s]*/i,
    /^[^A-Z]*?I'?ve\s+focused\s+on\s+[^.]*?[.\s]*/i,
    /^[^A-Z]*?I'?ve\s+tailored\s+this\s+cover\s+letter[^.]*?[.\s]*/i,
    /^[^A-Z]*?I'?ve\s+designed\s+this\s+cover\s+letter[^.]*?[.\s]*/i,
    
    // "designed to feel..." variations
    /^[^A-Z]*?designed\s+to\s+feel\s+genuinely\s+written[^.]*?[.\s]*/i,
    /^[^A-Z]*?designed\s+to\s+feel\s+[^.]*?[.\s]*/i,
    
    // "I've highlighted..." variations
    /^[^A-Z]*?I'?ve\s+highlighted\s+[^.]*?[.\s]*/i,
    /^[^A-Z]*?I'?ve\s+referenced\s+[^.]*?[.\s]*/i,
    
    // Placeholder text
    /^\[Your\s+Name\]\s*\[Your\s+Address\]\s*\[Your\s+Phone\s+Number\]\s*\[Your\s+Email\]\s*\[Date\]\s*/i,
  ];
  
  for (const prefix of prefixesToRemove) {
    text = text.replace(prefix, "");
  }
  
  // Remove multi-line AI introductions (e.g., "Okay, here's... I've focused on...")
  // Look for patterns where the first sentence is an intro and the second is also an intro
  const lines = text.split('\n');
  let startIndex = 0;
  
  // Skip initial lines that are clearly AI introductions
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (
      /^(Okay|Here'?s?|I'?ve|Generated|This\s+cover\s+letter)/i.test(line) ||
      /designed\s+to\s+feel/i.test(line) ||
      /focused\s+on\s+making/i.test(line) ||
      /tailored\s+to/i.test(line) ||
      /^\[.*\]$/.test(line) ||
      /^If\s+you\s+have/i.test(line)
    ) {
      startIndex = i + 1;
    } else {
      break;
    }
  }
  
  // If we found intro lines, remove them
  if (startIndex > 0) {
    text = lines.slice(startIndex).join('\n');
  }
  
  // Remove any remaining lines that look like placeholders or instructions
  text = text.split('\n').filter(line => {
    const trimmed = line.trim();
    // Remove lines that are just placeholders or instructions
    if (/^\[.*\]$/.test(trimmed)) return false;
    if (/^If\s+you\s+have/.test(trimmed)) return false;
    if (/^Hiring\s+Manager/.test(trimmed) && trimmed.length < 20) return false;
    // Remove lines that are clearly AI meta-commentary
    if (/^(I'?ve|This\s+cover\s+letter|The\s+letter)\s+(is\s+)?(designed|tailored|focused|written)/i.test(trimmed)) return false;
    return true;
  }).join('\n');
  
  // Find the actual start of the cover letter (usually starts with a greeting or date)
  // Look for patterns like "Dear", "[Date]", or a proper name/address
  const greetingPattern = /^(Dear|To|Hello|Hi|\[Date\]|[A-Z][a-z]+\s+[A-Z][a-z]+)/;
  const linesArray = text.split('\n');
  let actualStart = 0;
  
  for (let i = 0; i < linesArray.length; i++) {
    const line = linesArray[i].trim();
    if (greetingPattern.test(line) || (line.length > 10 && /^[A-Z]/.test(line))) {
      actualStart = i;
      break;
    }
  }
  
  if (actualStart > 0) {
    text = linesArray.slice(actualStart).join('\n');
  }
  
  // Remove extra whitespace but preserve paragraph breaks
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();
  
  return text;
}


