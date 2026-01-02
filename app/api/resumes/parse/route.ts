import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Note: Install these packages: npm install pdf-parse mammoth
// For PDF: npm install pdf-parse
// For DOCX: npm install mammoth
// Types: npm install --save-dev @types/pdf-parse

interface ParseRequest {
  file_path: string;
  public_url?: string;
  user_id: string;
  original_filename?: string; // Original filename from upload
}

/**
 * API Route: POST /api/resumes/parse
 * 
 * Handles CV upload and parsing:
 * 1. Downloads file from Supabase Storage
 * 2. Parses based on file type (PDF/DOCX/TXT)
 * 3. Extracts structured data (experience, skills, education, etc.)
 * 4. Saves to resumes table
 * 5. Updates profiles.has_uploaded_resume flag
 */
export async function POST(request: NextRequest) {
  try {
    const body: ParseRequest = await request.json();
    const { file_path, public_url, user_id, original_filename } = body;

    if (!file_path || !user_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for server-side operations
    );

    // Step 1: Download file from Supabase Storage
    // file_path format: "resumes/{userId}/{filename}" - remove "resumes/" prefix for storage API
    const storagePath = file_path.startsWith("resumes/") 
      ? file_path.substring(8) // Remove "resumes/" prefix
      : file_path;
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 500 }
      );
    }

    // Step 2: Parse file based on type
    const fileExt = file_path.split(".").pop()?.toLowerCase();
    let rawText = "";
    let structuredData: any = {
      experience: [],
      skills: [],
      education: [],
      projects: [],
      certifications: [],
    };

    if (fileExt === "pdf") {
      // Parse PDF - use dynamic import for Next.js compatibility
      try {
        // @ts-ignore - pdf-parse may not be installed
        const pdfParse = (await import("pdf-parse")).default;
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const pdfData = await pdfParse(buffer);
        rawText = pdfData.text;
      } catch (error: any) {
        if (error.code === "MODULE_NOT_FOUND") {
          return NextResponse.json(
            { error: "PDF parsing not available. Please install: npm install pdf-parse" },
            { status: 500 }
          );
        }
        throw error;
      }
    } else if (fileExt === "docx" || fileExt === "doc") {
      // Parse DOCX - use dynamic import for Next.js compatibility
      try {
        // @ts-ignore - mammoth may not be installed
        const mammoth = await import("mammoth");
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value;
      } catch (error: any) {
        if (error.code === "MODULE_NOT_FOUND") {
          return NextResponse.json(
            { error: "DOCX parsing not available. Please install: npm install mammoth" },
            { status: 500 }
          );
        }
        throw error;
      }
    } else if (fileExt === "txt") {
      // Parse TXT
      rawText = await fileData.text();
    } else {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    // Step 3: Extract structured data using AI parsing (PRIMARY METHOD)
    console.log(`[Parse] Raw text length: ${rawText.length}`);
    console.log(`[Parse] First 200 chars:`, rawText.substring(0, 200));
    
    // Use AI-powered parsing as PRIMARY method (much more reliable than regex)
    let aiParsingFailed = false;
    try {
      const { parseResumeWithAI, convertToInternalFormat } = await import("@/lib/ai/resumeParser");
      console.log(`[Parse] 🤖 Using AI parsing (Gemini)...`);
      
      const aiParsed = await parseResumeWithAI(rawText);
      
      if (aiParsed && aiParsed.experience && aiParsed.experience.length > 0) {
        console.log(`[Parse] ✅ AI parsing successful!`);
        structuredData = convertToInternalFormat(aiParsed);
        console.log(`[Parse] AI extracted:`, {
          experience: structuredData.experience?.length || 0,
          education: structuredData.education?.length || 0,
          projects: structuredData.projects?.length || 0,
          skills: structuredData.skills?.length || 0,
        });
      } else {
        console.warn(`[Parse] ⚠️ AI parsing returned empty/invalid data, falling back to regex`);
        aiParsingFailed = true;
      }
    } catch (error: any) {
      console.error(`[Parse] ❌ AI parsing error: ${error.message}`);
      console.error(`[Parse] Error details:`, error);
      aiParsingFailed = true;
    }
    
    // Fallback to regex only if AI parsing completely failed
    if (aiParsingFailed) {
      console.log(`[Parse] 🔄 Falling back to regex parsing...`);
      structuredData = extractStructuredData(rawText);
    }
    
    console.log(`[Parse] Final extracted data:`, {
      experience: structuredData.experience?.length || 0,
      education: structuredData.education?.length || 0,
      projects: structuredData.projects?.length || 0,
      skills: structuredData.skills?.length || 0,
      certifications: structuredData.certifications?.length || 0,
    });

    // Step 4: Get user's profile to ensure it exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      // Create profile if it doesn't exist
      const { error: createError } = await supabase.from("profiles").insert({
        id: user_id,
        onboarding_completed: false,
        has_uploaded_resume: false,
        user_status: "new",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (createError) {
        console.error("Profile creation error:", createError);
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 }
        );
      }
    }

    // Step 5: Use original filename if provided, otherwise generate from parsed data
    // Remove file extension for cleaner display (e.g., "John_Doe_Resume.pdf" -> "John_Doe_Resume")
    let resumeName: string;
    if (original_filename) {
      // Remove extension from original filename
      const nameWithoutExt = original_filename.replace(/\.[^/.]+$/, "");
      resumeName = nameWithoutExt;
    } else {
      // Fallback: Generate name from parsed data if original filename not provided
      resumeName = generateResumeName(structuredData, rawText);
    }

    // Step 6: Insert resume into database
    const resumeData = {
      user_id: user_id,
      file_path: file_path,
      raw_text: rawText,
      structured: structuredData,
      parsed_at: new Date().toISOString(),
      name: resumeName,
    };

    console.log("[Parse] Inserting resume:", {
      user_id,
      file_path,
      raw_text_length: rawText?.length || 0,
      structured_keys: structuredData ? Object.keys(structuredData) : [],
    });

    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .insert(resumeData)
      .select()
      .single();

    if (resumeError) {
      console.error("[Parse] Resume insert error:", resumeError);
      console.error("[Parse] Error details:", {
        code: resumeError.code,
        message: resumeError.message,
        details: resumeError.details,
        hint: resumeError.hint,
      });
      return NextResponse.json(
        { 
          error: "Failed to save resume",
          details: resumeError.message,
          code: resumeError.code,
        },
        { status: 500 }
      );
    }

    if (!resume) {
      console.error("[Parse] Resume insert returned no data");
      return NextResponse.json(
        { error: "Failed to save resume: No data returned" },
        { status: 500 }
      );
    }

    console.log("[Parse] Resume saved successfully:", {
      resume_id: resume.id,
      user_id: resume.user_id,
    });

    // Step 7: Update profile flags - PRESERVE subscription fields!
    // First, get current profile to preserve subscription status
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .single();

    const updateData: any = {
      has_uploaded_resume: true,
      resume_id: resume.id,
      updated_at: new Date().toISOString(),
    };

    // CRITICAL: Preserve subscription-related fields if they exist
    // This prevents premium users from losing their subscription status when uploading a new CV
    if (currentProfile) {
      if (currentProfile.subscription_tier) {
        updateData.subscription_tier = currentProfile.subscription_tier;
      }
      if (currentProfile.cv_generations_remaining !== undefined) {
        updateData.cv_generations_remaining = currentProfile.cv_generations_remaining;
      }
      if (currentProfile.unlimited_access !== undefined) {
        updateData.unlimited_access = currentProfile.unlimited_access;
      }
      if (currentProfile.subscription_id) {
        updateData.subscription_id = currentProfile.subscription_id;
      }
      if (currentProfile.user_status) {
        updateData.user_status = currentProfile.user_status;
      }
      if (currentProfile.onboarding_completed !== undefined) {
        updateData.onboarding_completed = currentProfile.onboarding_completed;
      }
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user_id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      // Don't fail the request, resume is already saved
    } else {
      console.log("[Parse] Profile updated, subscription fields preserved:", {
        subscription_tier: updateData.subscription_tier,
        cv_generations_remaining: updateData.cv_generations_remaining,
      });
    }

    // Return parsed data to frontend
    return NextResponse.json({
      raw_text: rawText,
      structured: structuredData,
      resume_id: resume.id,
    });
  } catch (error: any) {
    console.error("Parse error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse resume" },
      { status: 500 }
    );
  }
}

/**
 * Extracts structured data from raw text using section-aware parsing
 * 
 * This function first identifies all major sections, then parses each section separately
 * to ensure proper differentiation between experience, projects, education, etc.
 */
function extractStructuredData(text: string): any {
  const structured: any = {
    experience: [],
    skills: [],
    education: [],
    projects: [],
    certifications: [],
  };

  // Step 1: Identify all major sections in the resume
  const sections = identifySections(text);
  console.log(`[Parse] Identified ${sections.length} sections:`, sections.map(s => s.name));

  // Step 2: Parse each section separately with section-specific logic
  // For ambiguous sections (like "Experience" that might contain projects), we'll parse and reclassify
  for (const section of sections) {
    switch (section.type) {
      case 'experience':
        // Parse as experience, but we'll reclassify later if needed
        const experienceEntries = parseExperienceSection(section.content, text);
        structured.experience.push(...experienceEntries);
        break;
      case 'projects':
        const projectEntries = parseProjectsSection(section.content, text);
        structured.projects.push(...projectEntries);
        break;
      case 'education':
        structured.education = parseEducationSection(section.content, text);
        break;
      case 'skills':
        structured.skills = parseSkillsSection(section.content, text);
        break;
      case 'certifications':
        structured.certifications = parseCertificationsSection(section.content, text);
        break;
      case 'other':
        // For ambiguous sections, do NOT parse as projects
        // Projects should ONLY come from explicit "Projects" sections
        // This prevents misclassifying other content as projects
        console.log(`[Parse] Skipping ambiguous section "${section.name}" - projects only parsed from explicit "Projects" heading`);
        break;
    }
  }

  // Step 3: Reclassify entries based on content patterns
  // This is crucial for students/early career applicants who might list projects under "Experience"
  console.log(`[Parse] Before reclassification: ${structured.experience.length} experience, ${structured.projects.length} projects`);
  const reclassified = reclassifyExperienceAndProjects(structured.experience, structured.projects);
  structured.experience = reclassified.experience;
  structured.projects = reclassified.projects;
  console.log(`[Parse] After reclassification: ${structured.experience.length} experience, ${structured.projects.length} projects`);

  // Step 4: Fallback parsing if sections weren't found
  // NOTE: Only use fallback for experience, NOT for projects
  // Projects should ONLY come from explicit "Projects" sections
  if (structured.experience.length === 0) {
    console.log(`[Parse] No experience section found, trying fallback parsing...`);
    structured.experience = parseExperienceFallback(text);
  }
  // Projects: NO FALLBACK - only parse from explicit Projects section
  if (structured.projects.length === 0) {
    console.log(`[Parse] No projects section found - skipping (projects only parsed from explicit "Projects" heading)`);
  }
  if (structured.education.length === 0) {
    console.log(`[Parse] No education section found, trying fallback parsing...`);
    structured.education = parseEducationFallback(text);
  }
  if (structured.skills.length === 0) {
    structured.skills = extractSkillsFromText(text);
  }
  if (structured.certifications.length === 0) {
    console.log(`[Parse] No certifications section found, trying fallback parsing...`);
    structured.certifications = parseCertificationsFallback(text);
  }

  // Step 5: Final reclassification after fallback (in case fallback misclassified)
  // Only reclassify experience - projects are already strict (only from Projects section)
  const finalReclassified = reclassifyExperienceAndProjects(structured.experience, structured.projects);
  structured.experience = finalReclassified.experience;
  // Keep projects as-is (already strict - only from Projects section)
  structured.projects = finalReclassified.projects;

  return structured;
}

/**
 * Identify all major sections in the resume
 */
interface ResumeSection {
  name: string;
  type: 'experience' | 'projects' | 'education' | 'skills' | 'certifications' | 'other';
  content: string;
  startIndex: number;
  endIndex: number;
}

function identifySections(text: string): ResumeSection[] {
  const sections: ResumeSection[] = [];
  const lines = text.split('\n');
  
  // Section header patterns (case-insensitive)
  // Note: "EXPERIENCE" is ambiguous - it might contain projects for students
  // We'll parse it as experience but reclassify later using content analysis
  const sectionPatterns: Array<{ pattern: RegExp; type: ResumeSection['type']; name: string }> = [
    // Experience sections (may contain projects for students/early career)
    { pattern: /^(PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT\s+HISTORY|EMPLOYMENT|EXPERIENCE|CAREER\s+HISTORY|WORK\s+HISTORY)$/i, type: 'experience', name: 'Experience' },
    // Projects sections
    { pattern: /^(PROJECTS|PROJECT|PORTFOLIO|SIDE\s+PROJECTS|PERSONAL\s+PROJECTS|ACADEMIC\s+PROJECTS)$/i, type: 'projects', name: 'Projects' },
    // Education sections
    { pattern: /^(EDUCATION|ACADEMIC\s+BACKGROUND|QUALIFICATIONS|ACADEMIC\s+QUALIFICATIONS)$/i, type: 'education', name: 'Education' },
    // Skills sections
    { pattern: /^(SKILLS|TECHNICAL\s+SKILLS|COMPETENCIES|TECHNICAL\s+COMPETENCIES|CORE\s+SKILLS)$/i, type: 'skills', name: 'Skills' },
    // Certifications sections
    { pattern: /^(CERTIFICATIONS|CERTIFICATION|CERTIFICATES|LICENSES|PROFESSIONAL\s+CERTIFICATIONS)$/i, type: 'certifications', name: 'Certifications' },
  ];

  // Track line positions in the original text
  let charIndex = 0;
  const lineIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    lineIndices.push(charIndex);
    charIndex += lines[i].length + 1; // +1 for newline
  }

  // Find all section headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    for (const { pattern, type, name } of sectionPatterns) {
      if (pattern.test(line)) {
        // Find the end of this section (next section header or end of text)
        let endLineIndex = lines.length;
        
        // Look for next section
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          
          // Check if this is another section header
          let isNextSection = false;
          for (const { pattern: nextPattern } of sectionPatterns) {
            if (nextPattern.test(nextLine)) {
              endLineIndex = j;
              isNextSection = true;
              break;
            }
          }
          
          if (isNextSection) break;
        }
        
        // Extract section content (from line after header to line before next section)
        const startIndex = lineIndices[i] + lines[i].length;
        const endIndex = endLineIndex < lines.length ? lineIndices[endLineIndex] : text.length;
        const sectionContent = text.substring(startIndex, endIndex).trim();
        
        console.log(`[Parse] Found section: ${name} (lines ${i}-${endLineIndex}, ${sectionContent.length} chars)`);
        
        sections.push({
          name,
          type,
          content: sectionContent,
          startIndex,
          endIndex,
        });
        
        break; // Found a match, move to next line
      }
    }
  }

  return sections;
}

/**
 * Parse Experience section - Format: Company Name, then Position with dates, then bullets
 * Expected format:
 *   Company Name
 *   Position                                    time period
 *   -bullet points describing what person did
 */
function parseExperienceSection(sectionContent: string, fullText: string): any[] {
  const experience: any[] = [];
  const lines = sectionContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let currentJob: any = null;
  let currentBullets: string[] = [];
  let expectingPosition = false; // After company name, we expect position next
  
  // Patterns to exclude (not job experience)
  const excludePatterns = [
    /^(PROJECTS|EDUCATION|SKILLS|CERTIFICATIONS|EXPERIENCE|AWARDS|PUBLICATIONS|VOLUNTEER)$/i,
    /Technologies?:|Tech Stack:|Built with|Used:/i,
    /GitHub|GitLab|Portfolio|Personal Project|Academic Project|Course Project|Side Project|Hackathon/i,
    /Bachelor|Master|PhD|Degree|University|College|School|Coursework/i,
    /Certification|Certificate|License|AWS Certified|Google Certified/i,
  ];
  
  // Job title keywords
  const jobTitleKeywords = [
    'Engineer', 'Developer', 'Manager', 'Analyst', 'Architect', 'Specialist',
    'Consultant', 'Lead', 'Director', 'Coordinator', 'Associate', 'Senior',
    'Junior', 'Intern', 'Trainee', 'Executive', 'Officer', 'Supervisor',
    'Administrator', 'Technician', 'Designer', 'Scientist', 'Researcher',
    'Software', 'Data', 'Product', 'Project', 'Technical', 'DevOps',
    'Full Stack', 'Backend', 'Frontend', 'Machine Learning', 'AI',
    'Sales', 'Marketing', 'Business', 'Operations', 'Finance', 'HR',
    'Accountant', 'Auditor', 'Advisor', 'Representative', 'Agent'
  ];
  
  // Company name indicators (words that suggest it's a company, not a description)
  const companyIndicators = ['Inc', 'LLC', 'Corp', 'Ltd', 'Company', 'Technologies', 'Solutions', 
                            'Systems', 'Services', 'Group', 'Enterprises', 'Consulting', 'Partners'];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
    
    // Skip empty lines
    if (!line || line.length === 0) continue;
    
    // Skip if line matches exclusion patterns
    if (excludePatterns.some(pattern => pattern.test(line))) {
      // Save current job if valid
      if (currentJob && currentJob.company && currentJob.title && currentJob.duration && currentBullets.length > 0) {
        currentJob.bullets = currentBullets;
        experience.push(currentJob);
        console.log(`[Parse] ✅ Valid experience: "${currentJob.title}" at "${currentJob.company}"`);
      }
      currentJob = null;
      currentBullets = [];
      expectingPosition = false;
      continue;
    }
    
    // Check if this is a date line (standalone)
    const dateLineMatch = line.match(/^((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4})\s*[-–]\s*((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4}|Present|Current)$/i);
    
    // Check if line contains a date pattern (for position + date on same line)
    const hasDatePattern = line.match(/((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4})\s*[-–]\s*((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4}|Present|Current)/i);
    
    // Check if this looks like a company name (capitalized, reasonable length, no dates, no bullets)
    // Company names are usually: short, capitalized, don't contain action verbs, don't have dates
    const looksLikeCompanyName = /^[A-Z][A-Za-z0-9\s&.,-]{2,60}$/.test(line) &&
                                 !line.match(/^[•\-\*]/) &&
                                 !hasDatePattern &&
                                 !dateLineMatch &&
                                 !line.match(/(University|College|School|Institute|Academy)/i) &&
                                 // Don't look like a job description (no action verbs at start)
                                 !line.match(/^(Developed|Designed|Implemented|Created|Built|Led|Managed|Improved|Increased|Reduced|Optimized|Delivered|Collaborated|Worked|Responsible|Achieved|Accomplished|Maintained|Supported|Assisted|Contributed|Participated|Helped|Ensured|Established|Provided|Performed|Executed|Coordinated|Organized|Analyzed|Evaluated|Researched|Investigated|Identified|Solved|Resolved|Streamlined|Automated|Enhanced|Upgraded|Migrated|Deployed|Configured|Tested|Debugged|Fixed|Refactored|Reviewed|Documented|Trained|Mentored|Presented|Reported|Communicated)\b/i) &&
                                 // Not too long (company names are usually shorter)
                                 line.length < 60 &&
                                 // Check if next line has position + date (strong indicator this is company name)
                                 (nextLine.match(/\b(Engineer|Developer|Manager|Analyst|Architect|Specialist|Consultant|Lead|Director|Coordinator|Associate|Senior|Junior|Intern|Software|Data|Product|Technical|DevOps|Sales|Marketing|Business|Operations|Finance|HR|Accountant|Auditor|Advisor|Representative|Agent)\b/i) || 
                                  nextLine.match(/((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4})\s*[-–]/i));
    
    // Check if this is a position/title (contains job keywords, may have dates)
    const hasJobTitleKeyword = jobTitleKeywords.some(keyword => 
      new RegExp(`\\b${keyword}\\b`, 'i').test(line)
    );
    
    const looksLikePosition = hasJobTitleKeyword &&
                              !line.match(/^[•\-\*]/) &&
                              (hasDatePattern || dateLineMatch || expectingPosition);
    
    // Check if this is a bullet point
    const isBullet = /^[•\-\*]\s*/.test(line) || 
                    (currentJob && 
                     !looksLikeCompanyName && 
                     !looksLikePosition && 
                     !dateLineMatch &&
                     line.length > 10 &&
                     // Looks like a description (starts with action verb or contains work-related terms)
                     (line.match(/^(Developed|Designed|Implemented|Created|Built|Led|Managed|Improved|Increased|Reduced|Optimized|Delivered|Collaborated|Worked|Responsible|Achieved|Accomplished|Maintained|Supported|Assisted|Contributed|Participated|Helped|Ensured|Established|Provided|Performed|Executed|Coordinated|Organized|Analyzed|Evaluated|Researched|Investigated|Identified|Solved|Resolved|Streamlined|Automated|Enhanced|Upgraded|Migrated|Deployed|Configured|Tested|Debugged|Fixed|Refactored|Reviewed|Documented|Trained|Mentored|Presented|Reported|Communicated)\b/i) ||
                      line.match(/\b(team|client|customer|project|system|application|feature|service|product|process|workflow|database|api|code|software|platform|infrastructure|solution|strategy|initiative|program|campaign|budget|revenue|cost|time|efficiency|performance|quality|security|scalability|reliability)\b/i)));
    
    if (looksLikeCompanyName && !currentJob) {
      // Start new job entry - found company name
      // Save previous job if exists
      if (currentJob && currentJob.company && currentJob.title && currentJob.duration && currentBullets.length > 0) {
        currentJob.bullets = currentBullets;
        experience.push(currentJob);
        console.log(`[Parse] ✅ Valid experience: "${currentJob.title}" at "${currentJob.company}"`);
      }
      
      currentJob = {
        company: line.trim(),
        title: "",
        duration: "",
        bullets: [],
      };
      currentBullets = [];
      expectingPosition = true; // Next line should be position
      console.log(`[Parse] Found company: "${line}"`);
      
    } else if (looksLikePosition && currentJob && expectingPosition) {
      // Found position - extract title and dates
      if (hasDatePattern) {
        // Position and date on same line: "Software Engineer                    May 2024 - Aug 2025"
        const dateMatch = line.match(/((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4})\s*[-–]\s*((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4}|Present|Current)/i);
        if (dateMatch) {
          currentJob.title = line.substring(0, dateMatch.index).trim();
          currentJob.duration = `${dateMatch[1]} - ${dateMatch[2] || "Present"}`;
          expectingPosition = false;
          console.log(`[Parse] Found position: "${currentJob.title}" with dates: "${currentJob.duration}"`);
        } else {
          // Just position, dates might be on next line
          currentJob.title = line.trim();
          expectingPosition = false;
        }
      } else {
        // Position without dates on this line
        currentJob.title = line.trim();
        expectingPosition = false;
      }
      
    } else if (dateLineMatch && currentJob && !currentJob.duration && !expectingPosition) {
      // Standalone date line (after position)
      currentJob.duration = `${dateLineMatch[1]} - ${dateLineMatch[2] || "Present"}`;
      console.log(`[Parse] Found dates: "${currentJob.duration}"`);
      
    } else if (isBullet && currentJob && !expectingPosition) {
      // Bullet point - capture description
      const bulletText = line.replace(/^[•\-\*]\s*/, "").trim();
      if (bulletText.length > 5) {
        // Filter out tech lists and project links
        const isTechList = bulletText.match(/^Technologies?:|^Tech Stack:|^Built with:|^Used:/i);
        const isProjectLink = bulletText.match(/^(GitHub|GitLab|Portfolio):/i);
        
        if (!isTechList && !isProjectLink) {
          currentBullets.push(bulletText);
        }
      }
      
    } else if (looksLikeCompanyName && currentJob) {
      // New company found - save previous job
      if (currentJob.company && currentJob.title && currentJob.duration && currentBullets.length > 0) {
        currentJob.bullets = currentBullets;
        experience.push(currentJob);
        console.log(`[Parse] ✅ Valid experience: "${currentJob.title}" at "${currentJob.company}"`);
      }
      
      // Start new job
      currentJob = {
        company: line.trim(),
        title: "",
        duration: "",
        bullets: [],
      };
      currentBullets = [];
      expectingPosition = true;
      console.log(`[Parse] Found new company: "${line}"`);
    }
  }
  
  // Save last job
  if (currentJob && currentJob.company && currentJob.title && currentJob.duration && currentBullets.length > 0) {
    currentJob.bullets = currentBullets;
    experience.push(currentJob);
    console.log(`[Parse] ✅ Valid experience: "${currentJob.title}" at "${currentJob.company}"`);
  }
  
  console.log(`[Parse] Extracted ${experience.length} valid experience entries (Company → Position → Dates → Bullets format)`);
  return experience;
}

/**
 * Parse Projects section
 */
function parseProjectsSection(sectionContent: string, fullText: string): any[] {
  const projects: any[] = [];
  const lines = sectionContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let currentProject: any = null;
  let currentDescription: string[] = [];
  let currentTechnologies: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!line || line.length === 0) continue;
    
    // Project name: capitalized, not a bullet, not "Technologies:", not a section header
    const isProjectName = /^[A-Z][A-Za-z0-9\s&]+$/.test(line) && 
                         !line.match(/^Technologies?:/i) &&
                         !line.match(/^[•\-\*]/) &&
                         !line.match(/^(PROJECTS|EDUCATION|SKILLS|EXPERIENCE|CERTIFICATIONS)$/i) &&
                         line.length > 5 && line.length < 100;
    
    // Technologies line
    const techMatch = line.match(/Technologies?:\s*(.+)/i);
    
    // Check if this is a bullet point (for project descriptions)
    const isBullet = /^[•\-\*]\s*/.test(line);
    
    // Description paragraph or bullet point
    const isDescription = !isProjectName && !techMatch && 
                         (isBullet || (line.length > 15 && !line.match(/^(PROJECTS|EDUCATION|SKILLS|EXPERIENCE|CERTIFICATIONS)$/i)));
    
    if (isProjectName) {
      // Save previous project
      if (currentProject) {
        currentProject.description = currentDescription.join(" ");
        currentProject.technologies = currentTechnologies;
        // Convert description array to bullets if it looks like bullet points
        if (currentDescription.length > 0) {
          currentProject.bullets = currentDescription.map(d => d.replace(/^[•\-\*]\s*/, "").trim());
        }
        projects.push(currentProject);
      }
      // Start new project
      currentProject = {
        name: line,
        description: "",
        technologies: [],
        bullets: [],
      };
      currentDescription = [];
      currentTechnologies = [];
    } else if (techMatch && currentProject) {
      // Extract technologies
      const techString = techMatch[1];
      const techPattern = new RegExp(
        '\\b(React|Vue|Angular|Node\\.js|Python|JavaScript|TypeScript|Java|C\\+\\+|AWS|Docker|Kubernetes|MongoDB|PostgreSQL|MySQL|Git|Linux|Express|Django|Flask|Spring|FastAPI|HTML5|CSS|Microservices|OOP|REST\\s+API|CI/CD|DevOps)\\b',
        'gi'
      );
      const techs = techString.match(techPattern) || [];
      const commaTechs = techString.split(',').map(t => t.trim()).filter(t => t.length > 0);
      currentTechnologies = [...new Set([...techs, ...commaTechs])];
    } else if (isDescription && currentProject) {
      // Description paragraph or bullet point - capture all project descriptions
      const descText = line.replace(/^[•\-\*]\s*/, "").trim();
      if (descText.length > 5) {
        currentDescription.push(descText);
      }
    }
  }
  
  // Don't forget the last project
  if (currentProject) {
    currentProject.description = currentDescription.join(" ");
    currentProject.technologies = currentTechnologies;
    // Convert description array to bullets if it looks like bullet points
    if (currentDescription.length > 0) {
      currentProject.bullets = currentDescription.map(d => d.replace(/^[•\-\*]\s*/, "").trim());
    }
    projects.push(currentProject);
  }
  
  console.log(`[Parse] Extracted ${projects.length} projects from Projects section`);
  return projects;
}

/**
 * Parse Education section
 */
function parseEducationSection(sectionContent: string, fullText: string): any[] {
  const education: any[] = [];
  const lines = sectionContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Education patterns
  const degreePattern = /^(Bachelor|Master|PhD|Doctorate|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|B\.?E\.?|M\.?E\.?)/i;
  
  let currentEdu: any = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!line || line.length === 0) continue;
    
    // Check if this is a degree name
    if (degreePattern.test(line)) {
      // Save previous education
      if (currentEdu) {
        education.push(currentEdu);
      }
      // Start new education
      currentEdu = {
        degree: line,
        institution: "",
        year: "",
        coursework: [],
      };
    } else if (currentEdu) {
      // Check for institution + date/year
      const institutionMatch = line.match(/^([A-Z][A-Za-z0-9\s&.,-]+?)\s+((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4})/i);
      if (institutionMatch && !currentEdu.institution) {
        currentEdu.institution = institutionMatch[1].trim();
        currentEdu.year = institutionMatch[2]?.trim() || "";
      } else if (line.match(/^Relevant\s+Coursework?:/i)) {
        // Extract coursework
        const courseworkText = line.replace(/^Relevant\s+Coursework?:\s*/i, "");
        currentEdu.coursework = courseworkText.split(',').map(c => c.trim()).filter(c => c.length > 0);
      } else if (!currentEdu.institution && line.length > 5) {
        // Assume this is institution if not set
        currentEdu.institution = line;
      }
    }
  }
  
  // Don't forget the last education
  if (currentEdu) {
    education.push(currentEdu);
  }
  
  console.log(`[Parse] Extracted ${education.length} education entries from Education section`);
  return education;
}

/**
 * Parse Skills section
 */
function parseSkillsSection(sectionContent: string, fullText: string): string[] {
  const skills: string[] = [];
  const lines = sectionContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Common skill keywords
  const skillKeywords = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "React", "Vue", "Angular",
    "Node.js", "Express", "Django", "Flask", "PostgreSQL", "MongoDB", "MySQL",
    "AWS", "Azure", "Docker", "Kubernetes", "Git", "Linux", "Agile", "Scrum",
    "Machine Learning", "AI", "Data Science", "SQL", "NoSQL", "REST API", "GraphQL",
  ];
  
  const sectionLower = sectionContent.toLowerCase();
  
  // Extract skills from section
  skillKeywords.forEach(skill => {
    if (sectionLower.includes(skill.toLowerCase()) && !skills.includes(skill)) {
      skills.push(skill);
    }
  });
  
  // Also extract from comma-separated lists
  lines.forEach(line => {
    if (line.includes(',')) {
      const items = line.split(',').map(s => s.trim()).filter(s => s.length > 0);
      items.forEach(item => {
        if (item.length > 2 && item.length < 50 && !skills.includes(item)) {
          skills.push(item);
        }
      });
    }
  });
  
  console.log(`[Parse] Extracted ${skills.length} skills from Skills section`);
  return skills;
}

/**
 * Parse Certifications section
 */
function parseCertificationsSection(sectionContent: string, fullText: string): any[] {
  const certifications: any[] = [];
  const lines = sectionContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  for (const line of lines) {
    if (!line || line.length < 5) continue;
    
    // Pattern: "Certification Name | Issuer | Year"
    const certMatch = line.match(/^([A-Z][^|•\n\-]{5,60})\s*[|•\-]\s*([A-Z][^|•\n\-]{3,40})\s*[|•\-]\s*(\d{4})/i);
    if (certMatch) {
      certifications.push({
        name: certMatch[1].trim(),
        issuer: certMatch[2].trim(),
        year: certMatch[3].trim(),
      });
    } else if (line.length > 10) {
      // Simple format: just the name
      certifications.push({
        name: line,
        issuer: "",
        year: "",
      });
    }
  }
  
  console.log(`[Parse] Extracted ${certifications.length} certifications from Certifications section`);
  return certifications;
}

/**
 * Extract skills from entire text (fallback)
 */
function extractSkillsFromText(text: string): string[] {
  const skills: string[] = [];
  const skillKeywords = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "React", "Vue", "Angular",
    "Node.js", "Express", "Django", "Flask", "PostgreSQL", "MongoDB", "MySQL",
    "AWS", "Azure", "Docker", "Kubernetes", "Git", "Linux", "Agile", "Scrum",
    "Machine Learning", "AI", "Data Science", "SQL", "NoSQL", "REST API", "GraphQL",
  ];
  
  const textLower = text.toLowerCase();
  skillKeywords.forEach(skill => {
    if (textLower.includes(skill.toLowerCase()) && !skills.includes(skill)) {
      skills.push(skill);
    }
  });
  
  return skills;
}

/**
 * Fallback parsing for experience when section header isn't found
 * STRICT: Only extracts entries with job title + company + dates
 */
function parseExperienceFallback(text: string): any[] {
  const experience: any[] = [];
  
  // Exclude patterns (not job experience)
  const excludePatterns = [
    /Technologies?:|Tech Stack:|Built with|Used:/i,
    /GitHub|GitLab|Portfolio|Personal Project|Academic Project|Course Project|Side Project|Hackathon/i,
    /Bachelor|Master|PhD|Degree|University|College|School|Coursework/i,
    /Certification|Certificate|License|AWS Certified|Google Certified/i,
  ];
  
  // Look for experience patterns in the entire text
  // Pattern: Job Title at Company (Date - Date) or Job Title | Company | Date - Date
  const patterns = [
    // Pattern 1: "Job Title at Company (Date - Date)" - STRICT: Must have dates
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s*\([^)]+\))?)\s+(?:at|@)\s+([A-Z][A-Za-z0-9\s&.,-]+?)\s*\(([A-Za-z]+\s+\d{4}|\d{4}|Present|Current)\s*[-–]\s*([A-Za-z]+\s+\d{4}|\d{4}|Present|Current)\)/gi,
    // Pattern 2: "Job Title | Company | Date - Date" - STRICT: Must have dates
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s*\([^)]+\))?)\s*[|•\-]\s*([A-Z][A-Za-z0-9\s&.,-]+?)\s*[|•\-]\s*([A-Za-z]+\s+\d{4}|\d{4}|Present|Current)\s*[-–]\s*([A-Za-z]+\s+\d{4}|\d{4}|Present|Current)/gi,
  ];
  
  const experienceSet = new Set<string>();
  
  // Job title keywords (must contain at least one)
  const jobTitleKeywords = [
    'Engineer', 'Developer', 'Manager', 'Analyst', 'Architect', 'Specialist',
    'Consultant', 'Lead', 'Director', 'Coordinator', 'Associate', 'Senior',
    'Junior', 'Intern', 'Software', 'Data', 'Product', 'Technical', 'DevOps'
  ];
  
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null && experience.length < 15) {
      const title = match[1]?.trim();
      const company = match[2]?.trim();
      const startDate = match[3]?.trim();
      const endDate = match[4]?.trim() || "Present";
      
      // STRICT: Must have title, company, and dates
      if (!title || !company || !startDate) continue;
      
      // Check if title contains job title keywords
      const hasJobTitleKeyword = jobTitleKeywords.some(keyword => 
        new RegExp(`\\b${keyword}\\b`, 'i').test(title)
      );
      if (!hasJobTitleKeyword) continue;
      
      // Exclude if matches exclusion patterns
      const context = `${title} ${company}`;
      if (excludePatterns.some(pattern => pattern.test(context))) continue;
      
      // Exclude if company looks like a university/school
      if (company.match(/(University|College|School|Institute|Academy)/i)) continue;
      
      const key = `${title}|${company}`;
      if (!experienceSet.has(key)) {
        experienceSet.add(key);
        experience.push({
          title,
          company,
          duration: `${startDate} - ${endDate}`,
          bullets: [],
        });
        console.log(`[Parse] ✅ Fallback extracted valid experience: "${title}" at "${company}"`);
      }
    }
  }
  
  // Only try additional patterns if we found nothing (very strict)
  if (experience.length === 0) {
    const jobTitlePatterns = [
      /(Software\s+(?:Engineer|Developer|Architect|Consultant|Specialist))/i,
      /(Senior\s+Software\s+(?:Engineer|Developer|Architect))/i,
      /(Full\s+Stack\s+(?:Developer|Engineer))/i,
      /(Backend\s+(?:Developer|Engineer|Architect))/i,
      /(Frontend\s+(?:Developer|Engineer|Architect))/i,
      /(DevOps\s+(?:Engineer|Specialist|Architect))/i,
      /(Data\s+(?:Scientist|Engineer|Analyst|Architect))/i,
      /(Product\s+(?:Manager|Owner|Specialist))/i,
      /(Project\s+Manager)/i,
      /(Technical\s+(?:Lead|Manager|Architect))/i,
    ];
    
    for (const titlePattern of jobTitlePatterns) {
      const titleMatch = text.match(titlePattern);
      if (titleMatch) {
        const title = titleMatch[1];
        // Look for company name AND date after the title (within next 200 chars)
        const afterTitle = text.substring(text.indexOf(titleMatch[0]) + titleMatch[0].length, text.indexOf(titleMatch[0]) + titleMatch[0].length + 200);
        const companyMatch = afterTitle.match(/([A-Z][A-Za-z0-9\s&.,-]{3,50})/);
        const dateMatch = afterTitle.match(/((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4})\s*[-–]\s*((?:May|June|January|February|March|April|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4}|Present|Current)/i);
        
        // STRICT: Must have both company AND dates
        if (companyMatch && dateMatch) {
          const company = companyMatch[1].trim();
          // Exclude if company looks like a university/school
          if (company.match(/(University|College|School|Institute|Academy)/i)) continue;
          
          const key = `${title}|${company}`;
          if (!experienceSet.has(key)) {
            experienceSet.add(key);
            experience.push({
              title,
              company,
              duration: `${dateMatch[1]} - ${dateMatch[2] || "Present"}`,
              bullets: [],
            });
            console.log(`[Parse] ✅ Fallback extracted valid experience: "${title}" at "${company}"`);
          }
        }
      }
    }
  }
  
  console.log(`[Parse] Fallback extracted ${experience.length} valid experience entries (strict filtering)`);
  return experience;
}

/**
 * Fallback parsing for projects when section header isn't found
 */
function parseProjectsFallback(text: string): any[] {
  const projects: any[] = [];
  
  // Look for project name patterns (capitalized words, not too long)
  // Fixed: Changed +{5,80} to {5,80} (can't combine + with range quantifier)
  const projectNamePattern = /^([A-Z][A-Za-z0-9\s&]{5,80})$/gm;
  const matches = text.matchAll(projectNamePattern);
  
  const projectSet = new Set<string>();
  for (const match of matches) {
    const name = match[1].trim();
    // Skip if it looks like a job title, section header, or other non-project text
    if (
      !name.match(/^(PROJECTS|EDUCATION|SKILLS|EXPERIENCE|CERTIFICATIONS)$/i) &&
      !name.match(/^(Software|Senior|Associate|Full|Backend|Frontend|DevOps|Data|Machine|Product|Project|Technical)/i) &&
      name.length > 5 && name.length < 80
    ) {
      if (!projectSet.has(name)) {
        projectSet.add(name);
        projects.push({
          name,
          description: "",
          technologies: [],
        });
      }
    }
  }
  
  console.log(`[Parse] Fallback extracted ${projects.length} projects`);
  return projects;
}

/**
 * Fallback parsing for education when section header isn't found
 */
function parseEducationFallback(text: string): any[] {
  const education: any[] = [];
  
  // Look for degree patterns
  const degreePatterns = [
    /(Bachelor|Master|PhD|Doctorate|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?)[^•\n]{0,50}\s*[•\-]\s*([A-Z][^•\n]{5,50})\s*[•\-]\s*([0-9]{4})/gi,
    /([A-Z][^•\n]{10,50})\s*[•\-]\s*([A-Z][^•\n]{5,50})\s*[•\-]\s*([0-9]{4})/gi,
  ];
  
  const educationSet = new Set<string>();
  
  for (const pattern of degreePatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null && education.length < 5) {
      const degree = match[1]?.trim() || "Degree";
      const institution = match[2]?.trim() || "Institution";
      const year = match[3]?.trim() || "Year";
      
      const key = `${degree}|${institution}`;
      if (!educationSet.has(key) && degree && institution) {
        educationSet.add(key);
        education.push({
          degree,
          institution,
          year,
        });
      }
    }
  }
  
  console.log(`[Parse] Fallback extracted ${education.length} education entries`);
  return education;
}

/**
 * Fallback parsing for certifications when section header isn't found
 */
function parseCertificationsFallback(text: string): any[] {
  const certifications: any[] = [];
  
  // Look for certification patterns
  const certPatterns = [
    /([A-Z][^|•\n\-]{5,60})\s*[|•\-]\s*([A-Z][^|•\n\-]{3,40})\s*[|•\-]\s*(\d{4})/gi,
    /([A-Z][^•\n\(]{5,60})\s*\(([A-Z][^,)]{3,40}),\s*(\d{4})\)/gi,
  ];
  
  const certSet = new Set<string>();
  
  for (const pattern of certPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null && certifications.length < 10) {
      const name = match[1]?.trim();
      const issuer = match[2]?.trim();
      const year = match[3]?.trim();
      
      const key = `${name}|${issuer}`;
      if (!certSet.has(key) && name && issuer) {
        certSet.add(key);
        certifications.push({
          name,
          issuer,
          year: year || new Date().getFullYear().toString(),
        });
      }
    }
  }
  
  console.log(`[Parse] Fallback extracted ${certifications.length} certifications`);
  return certifications;
}

/**
 * Content-based classifier to differentiate between Experience and Projects
 * 
 * Key indicators for EXPERIENCE:
 * - Has company name (not just a project name)
 * - Has job title (Engineer, Developer, Manager, etc.)
 * - Has employment dates (month/year format)
 * - Mentions "at [Company]", "Company Name", professional context
 * - Bullets mention professional achievements, team work, business impact
 * 
 * Key indicators for PROJECTS:
 * - No company name (or company name is clearly a project/portfolio name)
 * - Project name (not a job title)
 * - Technologies explicitly listed ("Technologies:", "Stack:", "Built with")
 * - Academic/personal context ("Course project", "Personal project", "GitHub")
 * - Bullets focus on technical implementation, features, not business impact
 */
function reclassifyExperienceAndProjects(
  experience: any[],
  projects: any[]
): { experience: any[]; projects: any[] } {
  const finalExperience: any[] = [];
  const finalProjects: any[] = [];

  // Common job title keywords (strong indicator of experience)
  const jobTitleKeywords = [
    'engineer', 'developer', 'manager', 'analyst', 'architect', 'specialist',
    'consultant', 'lead', 'director', 'coordinator', 'associate', 'senior',
    'junior', 'intern', 'trainee', 'executive', 'officer', 'supervisor',
    'administrator', 'technician', 'designer', 'scientist', 'researcher'
  ];

  // Common company indicators (strong indicator of experience)
  const companyIndicators = [
    'inc', 'llc', 'corp', 'ltd', 'company', 'technologies', 'solutions',
    'systems', 'services', 'group', 'enterprises', 'consulting', 'partners'
  ];

  // Project indicators (strong indicator of projects)
  const projectIndicators = [
    'technologies:', 'tech stack:', 'stack:', 'built with', 'used:',
    'github', 'gitlab', 'portfolio', 'personal project', 'academic project',
    'course project', 'side project', 'hackathon', 'demo', 'prototype'
  ];

  // Academic/personal context (indicator of projects)
  const academicContext = [
    'university', 'college', 'school', 'course', 'thesis', 'dissertation',
    'research project', 'capstone', 'final project', 'assignment'
  ];

  /**
   * Score an entry to determine if it's experience or project
   * Returns: { isExperience: boolean, confidence: number }
   */
  function classifyEntry(entry: any, entryType: 'experience' | 'project'): { isExperience: boolean; confidence: number } {
    let experienceScore = 0;
    let projectScore = 0;

    const title = (entry.title || entry.name || '').toLowerCase();
    const company = (entry.company || '').toLowerCase();
    const duration = (entry.duration || '').toLowerCase();
    const bullets = (entry.bullets || []).join(' ').toLowerCase();
    const description = (entry.description || '').toLowerCase();
    const technologies = (entry.technologies || []).join(' ').toLowerCase();
    const allText = `${title} ${company} ${duration} ${bullets} ${description} ${technologies}`.toLowerCase();

    // EXPERIENCE INDICATORS (increase experienceScore)
    
    // 1. Has company name (strong indicator)
    if (company && company.length > 2) {
      experienceScore += 3;
      // Check if company name contains company indicators
      if (companyIndicators.some(ind => company.includes(ind))) {
        experienceScore += 2;
      }
    }

    // 2. Has job title keywords (strong indicator)
    if (jobTitleKeywords.some(keyword => title.includes(keyword))) {
      experienceScore += 4;
    }

    // 3. Has employment dates (month/year format)
    if (duration.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i) ||
        duration.match(/\d{4}\s*[-–]\s*\d{4}/) ||
        duration.includes('present') || duration.includes('current')) {
      experienceScore += 3;
    }

    // 4. Mentions "at [Company]" pattern
    if (allText.match(/\bat\s+[a-z]+/i) || allText.match(/[a-z]+\s+company/i)) {
      experienceScore += 2;
    }

    // 5. Professional context in bullets (team, business, impact)
    if (bullets.match(/(team|collaborated|led|managed|improved|increased|reduced|delivered|client|customer|business|revenue|cost)/i)) {
      experienceScore += 2;
    }

    // PROJECT INDICATORS (increase projectScore)

    // 1. No company name but has project name (indicator of project)
    if (!company || company.length < 2) {
      if (title && title.length > 3 && !jobTitleKeywords.some(keyword => title.includes(keyword))) {
        projectScore += 3;
      }
    }

    // 2. Technologies explicitly listed (strong indicator of project)
    if (technologies.length > 0 || allText.match(/technologies?:|tech stack:|stack:|built with|used:/i)) {
      projectScore += 4;
    }

    // 3. Academic/personal context
    if (academicContext.some(context => allText.includes(context))) {
      projectScore += 3;
    }

    // 4. Project indicators in text
    if (projectIndicators.some(ind => allText.includes(ind))) {
      projectScore += 3;
    }

    // 5. GitHub/GitLab mentions (indicator of project)
    if (allText.includes('github') || allText.includes('gitlab')) {
      projectScore += 2;
    }

    // 6. Technical implementation focus (not business impact)
    if (bullets.match(/(implemented|built|developed|created|designed|architected|algorithm|api|database|framework)/i) &&
        !bullets.match(/(team|collaborated|led|managed|improved|increased|reduced|delivered|client|customer|business)/i)) {
      projectScore += 2;
    }

    // 7. If it was originally classified as project and has project-like structure
    if (entryType === 'project' && !company && title && !jobTitleKeywords.some(keyword => title.includes(keyword))) {
      projectScore += 1;
    }

    // Decision logic
    const confidence = Math.abs(experienceScore - projectScore);
    const isExperience = experienceScore > projectScore;

    return { isExperience, confidence };
  }

  // Classify all experience entries - STRICT: Must have company AND duration
  for (const exp of experience) {
    // STRICT REQUIREMENT: Must have both company and duration to be valid experience
    if (!exp.company || !exp.duration) {
      console.log(`[Parse] ❌ Filtering out incomplete experience entry: "${exp.title || exp.name}" (missing company: ${!exp.company}, missing duration: ${!exp.duration})`);
      // If it looks like a project, add it to projects; otherwise discard
      const classification = classifyEntry(exp, 'experience');
      if (!classification.isExperience && classification.confidence >= 2) {
        console.log(`[Parse] Reclassified incomplete entry as project: "${exp.title || exp.name}"`);
        finalProjects.push({
          name: exp.title || exp.name || 'Project',
          description: exp.bullets?.join(' ') || '',
          technologies: [],
          ...exp
        });
      }
      continue; // Skip this entry - not valid experience
    }
    
    const classification = classifyEntry(exp, 'experience');
    // STRICT: Only keep if clearly experience with high confidence
    if (classification.isExperience && classification.confidence >= 2) {
      finalExperience.push(exp);
      console.log(`[Parse] ✅ Valid experience entry: "${exp.title || exp.name}" at "${exp.company}" (confidence: ${classification.confidence})`);
    } else if (!classification.isExperience && classification.confidence >= 2) {
      // Reclassify as project if clearly a project
      console.log(`[Parse] Reclassified experience entry as project: "${exp.title || exp.name}" (confidence: ${classification.confidence})`);
      finalProjects.push({
        name: exp.title || exp.name || 'Project',
        description: exp.bullets?.join(' ') || '',
        technologies: [],
        ...exp
      });
    } else {
      // Low confidence - filter out to avoid false positives
      console.log(`[Parse] ❌ Filtering out ambiguous entry: "${exp.title || exp.name}" (confidence: ${classification.confidence})`);
    }
  }

  // Classify all project entries
  for (const proj of projects) {
    const classification = classifyEntry(proj, 'project');
    if (!classification.isExperience && classification.confidence >= 1) {
      finalProjects.push(proj);
    } else if (classification.isExperience && classification.confidence >= 2) {
      // Reclassify as experience
      console.log(`[Parse] Reclassified project entry as experience: "${proj.name || proj.title}" (confidence: ${classification.confidence})`);
      finalExperience.push({
        title: proj.name || proj.title || 'Position',
        company: proj.company || '',
        duration: proj.duration || '',
        bullets: proj.description ? [proj.description] : (proj.bullets || []),
        ...proj
      });
    } else {
      // Low confidence - keep original classification but log
      console.log(`[Parse] Keeping ambiguous entry as project: "${proj.name || proj.title}" (confidence: ${classification.confidence})`);
      finalProjects.push(proj);
    }
  }

  return { experience: finalExperience, projects: finalProjects };
}

/**
 * Generates a better name for the resume based on structured data
 * Format: "Job Title - Company" or "Resume - Month Year" as fallback
 */
function generateResumeName(structured: any, rawText: string): string {
  // Try to extract name from experience (most recent job)
  if (structured.experience && structured.experience.length > 0) {
    const latestExp = structured.experience[0];
    const title = latestExp.title || latestExp.job_title || "";
    const company = latestExp.company || "";
    
    if (title && company) {
      return `${title} - ${company}`;
    } else if (title) {
      return title;
    } else if (company) {
      return `${company} Resume`;
    }
  }

  // Try to extract from raw text (look for name patterns at the start)
  const firstLines = rawText.split("\n").slice(0, 5).join(" ").trim();
  const nameMatch = firstLines.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
  if (nameMatch) {
    const name = nameMatch[1];
    // Check if it's followed by a job title
    const titleMatch = rawText.match(new RegExp(`${name}[\\s\\n]+([A-Z][^\\n]{10,50})`));
    if (titleMatch) {
      return `${nameMatch[1]} - ${titleMatch[1].trim()}`;
    }
    return `${name} Resume`;
  }

  // Fallback: Use current date
  const now = new Date();
  const month = now.toLocaleString("default", { month: "short" });
  const year = now.getFullYear();
  return `Resume - ${month} ${year}`;
}

