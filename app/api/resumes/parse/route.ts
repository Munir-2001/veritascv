import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Note: Install these packages: npm install pdf-parse mammoth
// For PDF: npm install pdf-parse
// For DOCX: npm install mammoth
// Types: npm install --save-dev @types/pdf-parse

interface ParseRequest {
  file_path: string;
  public_url: string;
  user_id: string;
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
    const { file_path, public_url, user_id } = body;

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

    // Step 3: Extract structured data using AI parsing (MUCH better than regex!)
    console.log(`[Parse] Raw text length: ${rawText.length}`);
    console.log(`[Parse] First 200 chars:`, rawText.substring(0, 200));
    
    // Try AI-powered parsing first
    try {
      const { parseResumeWithAI, convertToInternalFormat } = await import("@/lib/ai/resumeParser");
      const aiParsed = await parseResumeWithAI(rawText);
      
      if (aiParsed) {
        console.log(`[Parse] ✅ AI parsing successful!`);
        structuredData = convertToInternalFormat(aiParsed);
      } else {
        console.log(`[Parse] ⚠️ AI parsing failed, falling back to regex`);
        structuredData = extractStructuredData(rawText);
      }
    } catch (error: any) {
      console.error(`[Parse] ❌ AI parsing error: ${error.message}, falling back to regex`);
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

    // Step 5: Generate a better name for the resume
    const resumeName = generateResumeName(structuredData, rawText);

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

    // Step 7: Update profile flags
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        has_uploaded_resume: true,
        resume_id: resume.id,
        updated_at: new Date().toISOString(),
        // Keep onboarding_completed as false until user completes profile/KB
      })
      .eq("id", user_id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      // Don't fail the request, resume is already saved
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
 * Extracts structured data from raw text using pattern matching and heuristics
 * 
 * In production, you might want to use an AI service (OpenAI, Anthropic) for better extraction
 */
function extractStructuredData(text: string): any {
  const structured: any = {
    experience: [],
    skills: [],
    education: [],
    projects: [],
    certifications: [],
  };

  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);

  // Extract Experience - improved patterns
  // Pattern 1: "Job Title | Company | Date - Date"
  const expPattern1 = /([A-Z][^|•\n\-]{5,60})\s*[|•\-]\s*([A-Z][^|•\n\-]{3,50})\s*[|•\-]\s*([A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{4}|Present|Current|\d{4})\s*[-–]\s*([A-Za-z]+\s+\d{4}|Present|Current|\d{4})?/gi;
  
  // Pattern 2: "Job Title at Company (Date - Date)"
  const expPattern2 = /([A-Z][^•\n\(]{5,60})\s+(?:at|@)\s+([A-Z][^•\n\(]{3,50})\s*\(([A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{4}|Present|Current|\d{4})\s*[-–]\s*([A-Za-z]+\s+\d{4}|Present|Current|\d{4})?\)/gi;
  
  // Pattern 3: "Company - Job Title - Date"
  const expPattern3 = /([A-Z][^•\n\-]{3,50})\s*[-–]\s*([A-Z][^•\n\-]{5,60})\s*[-–]\s*([A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{4}|Present|Current|\d{4})/gi;

  const experienceSet = new Set<string>(); // Avoid duplicates
  
  [expPattern1, expPattern2, expPattern3].forEach((pattern) => {
    let match;
    pattern.lastIndex = 0; // Reset regex
    while ((match = pattern.exec(text)) !== null && structured.experience.length < 15) {
      let title, company, startDate, endDate;
      
      if (pattern === expPattern1 || pattern === expPattern2) {
        title = match[1]?.trim();
        company = match[2]?.trim();
        startDate = match[3]?.trim();
        endDate = match[4]?.trim() || "Present";
      } else {
        // Pattern 3: company first
        company = match[1]?.trim();
        title = match[2]?.trim();
        startDate = match[3]?.trim();
        endDate = "Present";
      }
      
      const key = `${title}|${company}`;
      if (!experienceSet.has(key) && title && company) {
        experienceSet.add(key);
        structured.experience.push({
          title: title,
          company: company,
          duration: endDate ? `${startDate} - ${endDate}` : startDate,
          description: "",
        });
      }
    }
  });

  // Also look for experience sections
  const expSectionMatch = text.match(/(?:EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|PROFESSIONAL EXPERIENCE)[\s\S]{0,2000}/i);
  if (expSectionMatch) {
    const expSection = expSectionMatch[0];
    // Extract bullet points as descriptions
    const bullets = expSection.match(/[•\-\*]\s*([^\n]{10,200})/g);
    if (bullets && structured.experience.length > 0) {
      bullets.forEach((bullet, idx) => {
        if (idx < structured.experience.length) {
          structured.experience[idx].description = bullet.replace(/^[•\-\*]\s*/, "");
        }
      });
    }
  }

  // Extract Skills (common tech stack keywords)
  const skillKeywords = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "React", "Vue", "Angular",
    "Node.js", "Express", "Django", "Flask", "PostgreSQL", "MongoDB", "MySQL",
    "AWS", "Azure", "Docker", "Kubernetes", "Git", "Linux", "Agile", "Scrum",
    "Machine Learning", "AI", "Data Science", "SQL", "NoSQL", "REST API", "GraphQL",
  ];

  const textLower = text.toLowerCase();
  skillKeywords.forEach((skill) => {
    if (textLower.includes(skill.toLowerCase())) {
      if (!structured.skills.includes(skill)) {
        structured.skills.push(skill);
      }
    }
  });

  // Extract Education (look for degree patterns)
  const educationPatterns = [
    /(?:^|\n)(Bachelor|Master|PhD|Doctorate|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?)[^•\n]{0,50}\s*[•\-]\s*([A-Z][^•\n]{5,50})\s*[•\-]\s*([0-9]{4})/gi,
    /(?:^|\n)([A-Z][^•\n]{10,50})\s*[•\-]\s*([A-Z][^•\n]{5,50})\s*[•\-]\s*([0-9]{4})/gi,
  ];

  let educationIndex = 0;
  for (const pattern of educationPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null && educationIndex < 5) {
      structured.education.push({
        degree: match[1]?.trim() || "Degree",
        institution: match[2]?.trim() || "Institution",
        year: match[3]?.trim() || "Year",
      });
      educationIndex++;
    }
  }

  // Extract Projects - improved extraction
  const projectSectionMatch = text.match(/(?:PROJECTS|PROJECT|PORTFOLIO|SIDE PROJECTS)[\s\S]{0,2000}/i);
  if (projectSectionMatch) {
    const projectSection = projectSectionMatch[0];
    
    // Pattern 1: Project name on its own line followed by description
    const projectPattern1 = /(?:^|\n)([A-Z][^\n•\-]{5,60})\s*\n([^\n]{20,300})/g;
    let match;
    while ((match = projectPattern1.exec(projectSection)) !== null && structured.projects.length < 10) {
      const name = match[1]?.trim();
      const description = match[2]?.trim();
      
      // Extract technologies from description
      const techPattern = /\b(React|Vue|Angular|Node\.js|Python|JavaScript|TypeScript|Java|C\+\+|AWS|Docker|Kubernetes|MongoDB|PostgreSQL|MySQL|Git|Linux)\b/gi;
      const technologies = description.match(techPattern) || [];
      
      structured.projects.push({
        name: name || "Project",
        description: description,
        technologies: [...new Set(technologies)], // Remove duplicates
      });
    }
    
    // Pattern 2: Bullet points with project names
    const projectBullets = projectSection.match(/[•\-\*]\s*([A-Z][^•\n]{10,200})/g);
    if (projectBullets && structured.projects.length < 10) {
      projectBullets.forEach((bullet) => {
        const content = bullet.replace(/^[•\-\*]\s*/, "");
        if (content.length > 20) {
          structured.projects.push({
            name: content.substring(0, 50),
            description: content,
            technologies: [],
          });
        }
      });
    }
  }

  // Extract Certifications - improved extraction
  const certSectionMatch = text.match(/(?:CERTIFICATIONS|CERTIFICATION|CERTIFICATES|LICENSES)[\s\S]{0,1000}/i);
  if (certSectionMatch) {
    const certSection = certSectionMatch[0];
    
    // Pattern 1: "Certification Name | Issuer | Year"
    const certPattern1 = /([A-Z][^|•\n\-]{5,60})\s*[|•\-]\s*([A-Z][^|•\n\-]{3,40})\s*[|•\-]\s*(\d{4})/gi;
    
    // Pattern 2: "Certification Name (Issuer, Year)"
    const certPattern2 = /([A-Z][^•\n\(]{5,60})\s*\(([A-Z][^,)]{3,40}),\s*(\d{4})\)/gi;
    
    // Pattern 3: Common cert issuers
    const certIssuers = ["AWS", "Google", "Microsoft", "Cisco", "CompTIA", "Oracle", "IBM", "Salesforce", "Adobe", "HubSpot"];
    const certPattern3 = new RegExp(`([A-Z][^•\n]{5,60})\\s*[•\\-]\\s*(${certIssuers.join("|")})[^•\\n]{0,30}\\s*[•\\-]\\s*(\\d{4})`, "gi");
    
    const certSet = new Set<string>();
    
    [certPattern1, certPattern2, certPattern3].forEach((pattern) => {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(certSection)) !== null && structured.certifications.length < 10) {
        let name, issuer, year;
        
        if (pattern === certPattern2) {
          name = match[1]?.trim();
          issuer = match[2]?.trim();
          year = match[3]?.trim();
        } else {
          name = match[1]?.trim();
          issuer = match[2]?.trim();
          year = match[3]?.trim();
        }
        
        const key = `${name}|${issuer}`;
        if (!certSet.has(key) && name && issuer) {
          certSet.add(key);
          structured.certifications.push({
            name: name,
            issuer: issuer,
            year: year || new Date().getFullYear().toString(),
          });
        }
      }
    });
    
    // Also extract from bullet points
    const certBullets = certSection.match(/[•\-\*]\s*([A-Z][^•\n]{10,100})/g);
    if (certBullets && structured.certifications.length < 10) {
      certBullets.forEach((bullet) => {
        const content = bullet.replace(/^[•\-\*]\s*/, "");
        // Check if it looks like a certification
        if (content.match(/\d{4}/) && (content.match(/AWS|Google|Microsoft|Cisco|CompTIA/i) || content.length < 80)) {
          const parts = content.split(/[•\-|]/).map(p => p.trim());
          if (parts.length >= 2) {
            structured.certifications.push({
              name: parts[0] || "Certification",
              issuer: parts[1] || "Issuer",
              year: parts[2]?.match(/\d{4}/)?.[0] || new Date().getFullYear().toString(),
            });
          }
        }
      });
    }
  }

  return structured;
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

