import { NextRequest, NextResponse } from "next/server";
// @ts-ignore - pdf-lib types
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
// @ts-ignore - docx types
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
} from "docx";
import { getCVStrategy, type JobLevel, enhanceBulletPoint, extractMetrics } from "@/lib/cv/strategy";
import { prepareCVSections, getSectionLimits } from "@/lib/cv/renderer";
import { getCVStyle, getToneInstructions, getATSSectionTitle, type CVTemplate } from "@/lib/cv/styles";

/**
 * API Route: POST /api/cv/generate
 * 
 * Generates custom CV in both PDF and DOCX formats with professional formatting
 * Uses intelligent section ordering based on job level and career stage
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      resume_id,
      tailored_sections, // NEW: Structured sections from focused prompts
      tailored_text, // Fallback: JSON string
      structured_data, // Fallback: Original structured data
      raw_text, // Optional: for extracting contact info
      template = "modern",
      job_title,
      job_level = "mid", // Default to mid-level
      domain = "general",
      job_description, // For keyword extraction
      cv_name, // Custom name to appear on CV
    } = body;

    console.log("[CV Generation] ==================== NEW REQUEST ====================");
    console.log("[CV Generation] Inputs:", {
      resume_id,
      job_title,
      job_level,
      domain,
      template,
      has_tailored_sections: !!tailored_sections,
      has_tailored_text: !!tailored_text,
      has_structured: !!structured_data,
      has_raw: !!raw_text,
    });

    // Use tailored_sections if available (from focused prompts), otherwise fallback
    if (!tailored_sections && !tailored_text && !structured_data) {
      return NextResponse.json(
        { error: "Missing required fields: tailored_sections (or tailored_text/structured_data)" },
        { status: 400 }
      );
    }

    // Priority: tailored_sections > tailored_text (JSON) > structured_data
    let finalData: any = {};
    
    // Parse tailored_sections if it's a string (from database JSONB)
    let parsedTailoredSections = tailored_sections;
    if (tailored_sections && typeof tailored_sections === 'string') {
      try {
        parsedTailoredSections = JSON.parse(tailored_sections);
        console.log("[CV Generation] ✅ Parsed tailored_sections from string");
      } catch (e) {
        console.warn("[CV Generation] ⚠️ Failed to parse tailored_sections as JSON:", e);
        parsedTailoredSections = null;
      }
    }
    
    if (parsedTailoredSections) {
      // NEW: Use structured sections from focused prompts (best quality)
      console.log("[CV Generation] ✅ Using tailored_sections from focused prompts");
      console.log("[CV Generation] Sections:", Object.keys(parsedTailoredSections));
      
      // Convert to format expected by CV renderer
      // Handle skills format: can be array of objects {skill, matched} or simple array
      let skillsFormatted: any[] = [];
      if (parsedTailoredSections.technical_skills && parsedTailoredSections.technical_skills.length > 0) {
        if (typeof parsedTailoredSections.technical_skills[0] === 'object' && 'skill' in parsedTailoredSections.technical_skills[0]) {
          // New format: array of objects
          skillsFormatted = parsedTailoredSections.technical_skills;
        } else {
          // Old format: simple array, convert to new format
          skillsFormatted = parsedTailoredSections.technical_skills.map((skill: string) => ({ skill, matched: true }));
        }
      }
      
      // Only include one: about_me (Career Objective) OR professional_summary
      finalData = {
        about_me: parsedTailoredSections.about_me || "", // Career Objective (if used)
        professional_summary: parsedTailoredSections.professional_summary || "", // Professional Summary (if used)
        experience: parsedTailoredSections.experience || [],
        skills: skillsFormatted,
        projects: parsedTailoredSections.projects || [],
        education: parsedTailoredSections.education || [],
        certifications: parsedTailoredSections.certifications || [],
      };
      
      console.log("[CV Generation] FINAL data counts:", {
        summary: finalData.professional_summary?.length > 0,
        experience: finalData.experience?.length || 0,
        skills: finalData.skills?.length || 0,
        projects: finalData.projects?.length || 0,
        education: finalData.education?.length || 0,
        certifications: finalData.certifications?.length || 0,
      });
    } else if (tailored_text) {
      // Fallback: Try to parse tailored_text as JSON
      try {
        const tailoredParsed = JSON.parse(tailored_text);
        console.log("[CV Generation] ✅ Parsed tailored_text as JSON");
        
        finalData = {
          about_me: tailoredParsed.about_me,
          professional_summary: tailoredParsed.professional_summary,
          experience: tailoredParsed.experience || [],
          skills: tailoredParsed.technical_skills || tailoredParsed.skills || [],
          projects: tailoredParsed.projects || [],
          education: tailoredParsed.education || [],
          certifications: tailoredParsed.certifications || [],
        };
      } catch (e) {
        console.log("[CV Generation] ⚠️ tailored_text is not JSON, using structured_data");
        finalData = structured_data || {};
      }
    } else {
      // Last fallback: Use original structured_data
      console.log("[CV Generation] ⚠️ Using original structured_data (fallback)");
      finalData = structured_data || {};
    }
    
    console.log("[CV Generation] FINAL data counts:", {
      summary: finalData.professional_summary?.length > 0,
      experience: finalData.experience?.length || 0,
      skills: finalData.skills?.length || 0,
      projects: finalData.projects?.length || 0,
      education: finalData.education?.length || 0,
      certifications: finalData.certifications?.length || 0,
    });

    // Extract contact info from final data or raw text
    const contactInfo = extractContactInfo(finalData, raw_text);
    
    // Override name with custom cv_name if provided
    if (cv_name && cv_name.trim()) {
      contactInfo.name = cv_name.trim();
      console.log(`[CV Generation] Using custom name: ${contactInfo.name}`);
    }

    // Get CV strategy based on job level
    const strategy = getCVStrategy(job_level as JobLevel, domain);
    console.log(`[CV Strategy] Level: ${job_level}, Template: ${template}`);
    console.log(`[CV Strategy] Section Order:`, strategy.sectionOrder);
    console.log(`[CV Strategy] Emphasize:`, strategy.emphasize);

    // Use professional_summary from finalData if available, otherwise use tailored_text
    const summaryText = finalData.professional_summary || tailored_text || "";

    // Generate PDF with final optimized data
    const pdfBuffer = await generatePDF(
      finalData, 
      summaryText, 
      template, 
      job_title,
      contactInfo,
      strategy
    );

    // Generate DOCX with final optimized data
    const docxBuffer = await generateDOCX(
      finalData, 
      summaryText, 
      template, 
      job_title,
      contactInfo,
      strategy
    );

    // Upload both to Supabase Storage
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const timestamp = Date.now();
    
    // Extract user_id from resume_id
    let userId = "unknown";
    if (resume_id) {
      const { data: resumeData } = await supabase
        .from("resumes")
        .select("user_id")
        .eq("id", resume_id)
        .single();
      if (resumeData) {
        userId = resumeData.user_id;
      }
    }

    // Upload PDF
    const pdfPath = `cv/${userId}/${timestamp}.pdf`;
    const { data: pdfData, error: pdfError } = await supabase.storage
      .from("resumes")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (pdfError) {
      console.error("PDF upload error:", pdfError);
    }

    // Upload DOCX
    const docxPath = `cv/${userId}/${timestamp}.docx`;
    const { data: docxData, error: docxError } = await supabase.storage
      .from("resumes")
      .upload(docxPath, docxBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (docxError) {
      console.error("DOCX upload error:", docxError);
    }

    // Get public URLs
    const { data: pdfUrlData } = supabase.storage.from("resumes").getPublicUrl(pdfPath);
    const { data: docxUrlData } = supabase.storage.from("resumes").getPublicUrl(docxPath);

    return NextResponse.json({
      pdf_url: pdfUrlData?.publicUrl,
      docx_url: docxUrlData?.publicUrl,
      pdf_path: pdfPath,
      docx_path: docxPath,
    });
  } catch (error: any) {
    console.error("CV generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate CV" },
      { status: 500 }
    );
  }
}

/**
 * Extract contact information from structured data or raw text
 */
function extractContactInfo(structured: any, rawText?: string): {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
} {
  const contact: any = {
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
    location: "",
  };

  // Try to extract from raw text first (more reliable)
  if (rawText) {
    const lines = rawText.split("\n").slice(0, 10);
    const headerText = lines.join(" ");

    // Extract name (usually first line, capitalized)
    const nameMatch = headerText.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
    if (nameMatch) contact.name = nameMatch[1].trim();

    // Extract email
    const emailMatch = headerText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) contact.email = emailMatch[1].trim();

    // Extract phone
    const phoneMatch = headerText.match(/(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})/);
    if (phoneMatch) contact.phone = phoneMatch[1].trim();

    // Extract LinkedIn
    const linkedinMatch = headerText.match(/(?:linkedin\.com\/in\/|linkedin\.com\/profile\/)([a-zA-Z0-9-]+)/i);
    if (linkedinMatch) contact.linkedin = `linkedin.com/in/${linkedinMatch[1]}`;

    // Extract GitHub
    const githubMatch = headerText.match(/(?:github\.com\/)([a-zA-Z0-9-]+)/i);
    if (githubMatch) contact.github = `github.com/${githubMatch[1]}`;
  }

  // Fallback to structured data
  if (!contact.name && structured.name) contact.name = structured.name;
  if (!contact.email && structured.email) contact.email = structured.email;
  if (!contact.phone && structured.phone) contact.phone = structured.phone;

  return contact;
}

/**
 * Extract keywords from job description for bolding
 */
function extractKeywordsForBolding(jobDescription: string): string[] {
  const keywords: string[] = [];
  const commonTech = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Rust", "Go", "Kotlin", "Swift",
    "React", "Vue", "Angular", "Node.js", "Express", "Django", "FastAPI", "Flask", "Spring",
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "CI/CD", "Git", "GitHub", "GitLab",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQL", "NoSQL",
    "Machine Learning", "ML", "AI", "Deep Learning", "TensorFlow", "PyTorch",
    "Agile", "Scrum", "DevOps", "Microservices", "REST", "GraphQL", "API",
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
    "full stack", "backend", "frontend", "cloud computing",
  ];
  phrases.forEach((phrase) => {
    if (textLower.includes(phrase)) {
      keywords.push(phrase);
    }
  });
  
  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Generate PDF using pdf-lib with professional formatting
 * Adapts structure based on career level strategy
 */
async function generatePDF(
  structured: any,
  tailoredText: string,
  template: string,
  jobTitle: string,
  contactInfo: any,
  strategy: any,
  keywords: string[] = []
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 size
  
  // Get CV style configuration
  const cvStyle = getCVStyle(template as CVTemplate);
  
  // Embed fonts based on style
  const fontMap: Record<string, any> = {
    "Helvetica": StandardFonts.Helvetica,
    "Helvetica-Bold": StandardFonts.HelveticaBold,
    "Times-Roman": StandardFonts.TimesRoman,
    "Times-Bold": StandardFonts.TimesRomanBold,
  };
  
  const font = await pdfDoc.embedFont(fontMap[cvStyle.fonts.body] || StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(fontMap[cvStyle.fonts.heading] || StandardFonts.HelveticaBold);

  const margin = cvStyle.layout.margin;
  const contentWidth = cvStyle.layout.contentWidth;
  // Start closer to top for better page utilization (A4 is 842pt tall)
  let yPosition = 820; // Start higher up
  const lineHeight = cvStyle.spacing.lineHeight;
  const sectionSpacing = cvStyle.spacing.sectionBottom;
  
  // Optimize spacing for better page utilization
  const optimizedSectionSpacing = Math.max(sectionSpacing - 3, 10); // Reduce spacing slightly

  // Helper to sanitize text for PDF encoding (WinAnsi)
  const sanitizeText = (text: string): string => {
    if (!text) return "";
    // Replace problematic Unicode characters with ASCII equivalents
    return text
      .replace(/[\u0080-\u009F]/g, "") // Remove control characters
      .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
      .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
      .replace(/[\u2013\u2014]/g, "-") // En/em dashes
      .replace(/[\u2026]/g, "...") // Ellipsis
      .replace(/[\u00A0]/g, " ") // Non-breaking space
      .replace(/[^\x00-\x7F]/g, ""); // Remove any remaining non-ASCII characters
  };

  // Helper to wrap text with accurate width calculation
  const wrapText = (text: string, maxWidth: number, fontSize: number, font: any): string[] => {
    const sanitized = sanitizeText(text);
    if (!sanitized || sanitized.trim().length === 0) return [];
    
    const words = sanitized.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      // More accurate width calculation using font width
      // Helvetica: ~0.5-0.6 per character, Times: ~0.5-0.55
      // Use font.widthOfTextAtSize for accurate measurement
      let width: number;
      try {
        width = font.widthOfTextAtSize(testLine, fontSize);
      } catch (e) {
        // Fallback: approximate based on font
        const charWidth = cvStyle.fonts.body.includes("Times") ? 0.55 : 0.6;
        width = testLine.length * fontSize * charWidth;
      }
      
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Helper to add text with wrapping
  const addText = (
    text: string,
    x: number,
    y: number,
    size: number = 11,
    isBold: boolean = false,
    color: any = rgb(0, 0, 0),
    maxWidth?: number
  ): number => {
    // Sanitize text first to avoid encoding errors
    const sanitized = sanitizeText(text);
    if (!sanitized || sanitized.trim().length === 0) return y;
    
    const textColor = isBold ? cvStyle.colors.heading : (color || cvStyle.colors.text);
    const currentFont = isBold ? boldFont : font;
    const lines = maxWidth ? wrapText(sanitized, maxWidth, size, currentFont) : [sanitized];
    let currentY = y;
    
    // Calculate proper line spacing based on font size and line height
    const lineSpacing = size * cvStyle.spacing.lineHeight;

    for (const line of lines) {
      if (currentY < 50) {
        // Need new page
        page = pdfDoc.addPage([595, 842]);
        currentY = 800;
      }
      if (!line || line.trim().length === 0) {
        currentY -= size * 0.5; // Small spacing for empty lines
        continue;
      }
      
      try {
        page.drawText(line, {
          x,
          y: currentY,
          size,
          font: currentFont,
          color: textColor,
        });
      } catch (error: any) {
        // If encoding still fails, skip this line
        console.warn(`Failed to encode text: "${line.substring(0, 50)}..."`, error.message);
        continue;
      }
      currentY -= lineSpacing;
    }

    return currentY;
  };

  // Helper to add section header based on style
  const addSectionHeader = (title: string, y: number): number => {
    const headerSize = cvStyle.fontSize.sectionHeader;
    const headerColor = cvStyle.colors.heading;
    
    // Use ATS-friendly section title if template is ATS-friendly
    const displayTitle = getATSSectionTitle(title, template as CVTemplate);
    
    addText(displayTitle, margin, y, headerSize, true, headerColor);
    
    // Apply header style (skip underlines/borders for ATS-friendly)
    if (template === "ats-friendly") {
      // ATS-friendly: simple bold only, no underlines or borders
    } else if (cvStyle.layout.headerStyle === "underline" || cvStyle.layout.headerStyle === "bold-underline") {
      page.drawLine({
        start: { x: margin, y: y - 8 },
        end: { x: margin + 100, y: y - 8 },
        thickness: 2,
        color: headerColor,
      });
    } else if (cvStyle.layout.headerStyle === "border") {
      // Draw a border box around header (for creative style)
      const textWidth = displayTitle.length * headerSize * 0.6;
      page.drawRectangle({
        x: margin - 5,
        y: y - headerSize - 5,
        width: textWidth + 10,
        height: headerSize + 10,
        borderColor: headerColor,
        borderWidth: 1,
      });
    }
    
    // Reduce top spacing slightly for better page utilization
    const optimizedTopSpacing = Math.max(cvStyle.spacing.sectionTop - 3, 12);
    return y - (headerSize + optimizedTopSpacing);
  };
  
  // Helper to get bullet character based on style
  const getBulletChar = (): string => {
    switch (cvStyle.layout.bulletStyle) {
      case "dash": return "—";
      case "arrow": return "→";
      case "dot": return "•";
      case "none": return "";
      default: return "•";
    }
  };

    // Debug structured data
  console.log(`[PDF] Structured data:`, {
    experience: structured.experience?.length || 0,
    skills: structured.skills?.length || 0,
    education: structured.education?.length || 0,
    projects: structured.projects?.length || 0,
    certifications: structured.certifications?.length || 0,
  });

  // Prepare sections using strategy
  const sections = prepareCVSections(structured, tailoredText, contactInfo, strategy);
  console.log(`[PDF] Rendering ${sections.length} sections in order:`, sections.map(s => s.type));

  // Render sections dynamically based on strategy
  for (const section of sections) {
    // Check if we need a new page (lower threshold for better utilization)
    if (yPosition < 80 && section.type !== "contact") {
      page = pdfDoc.addPage([595, 842]);
      yPosition = 820;
    }

    // Render section based on type
    switch (section.type) {
      case "contact":
        // Header Section
        const name = contactInfo.name || "Your Name";
        yPosition = addText(name, margin, yPosition, cvStyle.fontSize.name, true, cvStyle.colors.heading);
        yPosition -= 8;

        // Contact info
        const contactParts: string[] = [];
        if (contactInfo.email) contactParts.push(contactInfo.email);
        if (contactInfo.phone) contactParts.push(contactInfo.phone);
        if (contactInfo.linkedin) contactParts.push(contactInfo.linkedin);
        if (contactInfo.github) contactParts.push(contactInfo.github);
        if (contactParts.length > 0) {
          const contactText = contactParts.join(" • ");
          yPosition = addText(contactText, margin, yPosition, cvStyle.fontSize.contact, false, cvStyle.colors.secondary, contentWidth);
        }
        yPosition -= optimizedSectionSpacing;
        break;

      case "about_me":
        yPosition = addSectionHeader(section.title, yPosition);
        const aboutMeLines = section.content.split("\n").filter((l: string) => l.trim());
        for (const line of aboutMeLines.slice(0, 8)) {
          if (yPosition < 100) break;
          yPosition = addText(line.trim(), margin, yPosition, cvStyle.fontSize.body, false, cvStyle.colors.text, contentWidth);
        }
        yPosition -= optimizedSectionSpacing;
        break;

      case "summary":
        yPosition = addSectionHeader(section.title, yPosition);
        const summaryLines = section.content.split("\n").filter((l: string) => l.trim());
        for (const line of summaryLines.slice(0, 6)) {
          if (yPosition < 100) break;
          yPosition = addText(line.trim(), margin, yPosition, cvStyle.fontSize.body, false, cvStyle.colors.text, contentWidth);
        }
        yPosition -= optimizedSectionSpacing;
        break;

      case "experience":
        yPosition = addSectionHeader(section.title, yPosition);
        const expLimit = getSectionLimits(section.importance, "experience");
        for (const exp of section.content.slice(0, expLimit)) {
          if (yPosition < 80) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = 820;
          }

          const title = exp.title || exp.job_title || "Position";
          const company = exp.company || "Company";
          const duration = exp.duration || "";

          yPosition = addText(`${title}`, margin, yPosition, cvStyle.fontSize.jobTitle, true, cvStyle.colors.heading);
          yPosition = addText(`${company}${duration ? ` • ${duration}` : ""}`, margin + 5, yPosition, cvStyle.fontSize.body, false, cvStyle.colors.secondary);
          yPosition -= 4;

          // Use bullets array if available (limit to 2), otherwise fallback to description
          const bullets = exp.bullets || [];
          if (bullets.length > 0) {
            // Limit to exactly 2 bullets per job
            for (const bullet of bullets.slice(0, 2)) {
              if (yPosition < 100) break;
              yPosition = addText(`• ${bullet.trim()}`, margin + 10, yPosition, 10, false, rgb(0, 0, 0), contentWidth - 20);
            }
          } else if (exp.description) {
            const descLines = exp.description.split("\n").filter((l: string) => l.trim());
            for (const line of descLines.slice(0, 2)) {
              if (yPosition < 100) break;
              yPosition = addText(`• ${line.trim()}`, margin + 10, yPosition, 10, false, rgb(0, 0, 0), contentWidth - 20);
            }
          }
          yPosition -= 8;
        }
        yPosition -= optimizedSectionSpacing;
        break;

      case "skills":
        yPosition = addSectionHeader(section.title, yPosition);
        const skillLimit = getSectionLimits(section.importance, "skills");
        const skillsArray = section.content.slice(0, skillLimit);
        
        // Handle both formats: array of objects {skill, matched} or simple array
        let skillsText = "";
        if (skillsArray.length > 0 && typeof skillsArray[0] === 'object' && 'skill' in skillsArray[0]) {
          // New format: array of objects - bold matching skills
          const skillStrings = skillsArray.map((s: any) => {
            const skillName = s.skill || s;
            // For PDF, we can't easily bold individual words, so we'll just list them
            // Matching skills will be marked with asterisk for now
            return s.matched ? `*${skillName}*` : skillName;
          });
          skillsText = skillStrings.join(" • ");
        } else {
          // Old format: simple array
          skillsText = skillsArray.join(" • ");
        }
        
        yPosition = addText(skillsText, margin, yPosition, cvStyle.fontSize.body, false, cvStyle.colors.text, contentWidth);
        yPosition -= optimizedSectionSpacing;
        break;

      case "education":
        yPosition = addSectionHeader(section.title, yPosition);
        const eduLimit = getSectionLimits(section.importance, "education");
        for (const edu of section.content.slice(0, eduLimit)) {
          if (yPosition < 80) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = 820;
          }

          const degree = edu.degree || edu.degree_name || "Degree";
          const institution = edu.institution || edu.school || "Institution";
          const startDate = edu.start_date || "";
          const endDate = edu.end_date || "";
          const year = edu.year || edu.graduation_year || "";
          const gpa = edu.gpa || "";
          const honors = edu.honors || "";

          yPosition = addText(`${degree}`, margin, yPosition, cvStyle.fontSize.jobTitle, true, cvStyle.colors.heading);
          let eduInfo = institution;
          // Show start/end dates if available (prefer dates over year)
          if (startDate && endDate) {
            eduInfo += ` • ${startDate} - ${endDate}`;
          } else if (startDate) {
            eduInfo += ` • ${startDate}`;
          } else if (endDate) {
            eduInfo += ` • ${endDate}`;
          } else if (year) {
            // Fallback to year only if no dates available
            eduInfo += ` • ${year}`;
          }
          if (gpa) eduInfo += ` • GPA: ${gpa}`;
          if (honors) eduInfo += ` • ${honors}`;
          yPosition = addText(eduInfo, margin + 5, yPosition, cvStyle.fontSize.body, false, cvStyle.colors.text);
          yPosition -= 4;

          // Coursework
          if (edu.coursework && edu.coursework.length > 0) {
            const courseworkText = `Relevant Coursework: ${edu.coursework.slice(0, 6).join(", ")}`;
            yPosition = addText(courseworkText, margin + 10, yPosition, 9, false, rgb(0, 0, 0), contentWidth - 20);
            yPosition -= 4;
          }

          // Achievements
          if (edu.achievements && edu.achievements.length > 0) {
            for (const achievement of edu.achievements.slice(0, 3)) {
              const bulletChar = getBulletChar();
              const bulletText = bulletChar ? `${bulletChar} ${achievement}` : achievement;
              yPosition = addText(bulletText, margin + cvStyle.spacing.bulletIndent, yPosition, cvStyle.fontSize.contact, false, cvStyle.colors.text, contentWidth - cvStyle.spacing.bulletIndent);
              yPosition -= 4;
            }
          }

          yPosition -= 4;
        }
        yPosition -= optimizedSectionSpacing;
        break;

      case "projects":
        yPosition = addSectionHeader(section.title, yPosition);
        const projLimit = getSectionLimits(section.importance, "projects");
        for (const project of section.content.slice(0, projLimit)) {
          if (yPosition < 80) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = 820;
          }
          const projName = project.name || "Project";
          yPosition = addText(projName, margin, yPosition, cvStyle.fontSize.jobTitle, true, cvStyle.colors.heading);
          
          // Use bullets if available, otherwise fallback to description
          if (project.bullets && project.bullets.length > 0) {
            for (const bullet of project.bullets) {
              const bulletChar = getBulletChar();
              const bulletText = bulletChar ? `${bulletChar} ${bullet}` : bullet;
              yPosition = addText(bulletText, margin + cvStyle.spacing.bulletIndent, yPosition, cvStyle.fontSize.bullet, false, cvStyle.colors.text, contentWidth - cvStyle.spacing.bulletIndent);
              yPosition -= 4;
            }
          } else if (project.description) {
            // Fallback to description if bullets not available
            yPosition = addText(project.description, margin + 5, yPosition, 10, false, rgb(0, 0, 0), contentWidth - 20);
            yPosition -= 4;
          }
          
          if (project.technologies && project.technologies.length > 0) {
            const techText = project.technologies.join(", ");
            yPosition = addText(`Technologies: ${techText}`, margin + cvStyle.spacing.bulletIndent, yPosition, cvStyle.fontSize.contact, false, cvStyle.colors.secondary, contentWidth - cvStyle.spacing.bulletIndent);
            yPosition -= 4;
          }
          yPosition -= 8;
        }
        yPosition -= optimizedSectionSpacing;
        break;

      case "certifications":
        yPosition = addSectionHeader(section.title, yPosition);
        const certLimit = getSectionLimits(section.importance, "certifications");
        for (const cert of section.content.slice(0, certLimit)) {
          if (yPosition < 100) break;
          const certName = cert.name || "Certification";
          const issuer = cert.issuer || "";
          const year = cert.year || "";
          yPosition = addText(`${certName}${issuer ? ` • ${issuer}` : ""}${year ? ` • ${year}` : ""}`, margin, yPosition, cvStyle.fontSize.body, false, cvStyle.colors.text);
          yPosition -= 6;
        }
        yPosition -= optimizedSectionSpacing;
        break;

      case "achievements":
        yPosition = addSectionHeader(section.title, yPosition);
        for (const achievement of section.content.slice(0, 5)) {
          if (yPosition < 100) {
            page = pdfDoc.addPage([595, 842]);
            yPosition = 800;
          }
          const achievementText = typeof achievement === "string" ? achievement : achievement.description || achievement.title || "Achievement";
          const bulletChar = getBulletChar();
          const bulletText = bulletChar ? `${bulletChar} ${achievementText}` : achievementText;
          yPosition = addText(bulletText, margin, yPosition, cvStyle.fontSize.bullet, false, cvStyle.colors.text, contentWidth);
          yPosition -= 8;
        }
        yPosition -= optimizedSectionSpacing;
        break;

      default:
        console.warn(`[PDF] Unknown section type: ${section.type}`);
        break;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Generate DOCX using docx library with professional formatting
 * Adapts structure based on career level strategy
 */
async function generateDOCX(
  structured: any,
  tailoredText: string,
  template: string,
  jobTitle: string,
  contactInfo: any,
  strategy: any
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Get CV style configuration
  const cvStyle = getCVStyle(template as CVTemplate);

  // Prepare sections using strategy
  const sections = prepareCVSections(structured, tailoredText, contactInfo, strategy);
  console.log(`[DOCX] Rendering ${sections.length} sections in order:`, sections.map(s => s.type));
  
  // Helper to create section header based on style
  const createSectionHeader = (title: string): Paragraph => {
    const headerStyle = cvStyle.layout.headerStyle;
    const children: TextRun[] = [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: cvStyle.fontSize.sectionHeader * 2, // Convert pt to half-points
        font: cvStyle.fonts.docxHeading || "Arial",
        color: cvStyle.colors.heading === rgb(0, 0, 0) ? "000000" : "000000",
        underline: headerStyle === "underline" || headerStyle === "bold-underline" ? {} : undefined,
      }),
    ];
    
    return new Paragraph({
      children,
      spacing: { 
        before: cvStyle.spacing.sectionTop * 20, 
        after: cvStyle.spacing.sectionBottom * 20 
      },
    });
  };

  // Render sections dynamically
  for (const section of sections) {
    switch (section.type) {
      case "contact":
        // Header Section
        const name = contactInfo.name || "Your Name";
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: name,
                bold: true,
                size: cvStyle.fontSize.name * 2, // Convert pt to half-points
                font: cvStyle.fonts.docxHeading || "Arial",
                color: cvStyle.colors.heading === rgb(0, 0, 0) ? "000000" : "000000",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: cvStyle.spacing.sectionTop * 20 }, // Convert to twips (1/20th of a point)
          })
        );

        // Contact Information
        const contactParts: string[] = [];
        if (contactInfo.email) contactParts.push(contactInfo.email);
        if (contactInfo.phone) contactParts.push(contactInfo.phone);
        if (contactInfo.linkedin) contactParts.push(contactInfo.linkedin);
        if (contactInfo.github) contactParts.push(contactInfo.github);

        if (contactParts.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: contactParts.join(" • "),
                  size: 20, // 10pt
                  color: "000000",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 240 },
            })
          );
        }
        break;

      case "about_me":
        children.push(createSectionHeader(section.title));
        const aboutMeLines = section.content.split("\n").filter((l: string) => l.trim());
        for (const line of aboutMeLines.slice(0, 8)) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.trim(),
                  size: cvStyle.fontSize.body * 2,
                  font: cvStyle.fonts.docxBody || "Arial",
                  color: cvStyle.colors.text === rgb(0, 0, 0) ? "000000" : "000000",
                }),
              ],
              spacing: { after: cvStyle.spacing.betweenItems * 20 },
            })
          );
        }
        break;

      case "summary":
        children.push(createSectionHeader(section.title));
        const summaryLines = section.content.split("\n").filter((l: string) => l.trim());
        for (const line of summaryLines.slice(0, 6)) {
          children.push(
            new Paragraph({
              text: line.trim(),
              spacing: { after: 60 },
            })
          );
        }
        children.push(new Paragraph({ text: "" }));
        break;

      case "experience":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.title.toUpperCase(),
                bold: true,
                size: 24,
                color: "000000",
              }),
            ],
            spacing: { before: 240, after: 120 },
          })
        );
        const expLimit2 = getSectionLimits(section.importance, "experience");
        for (const exp of section.content.slice(0, expLimit2)) {
          const title2 = exp.title || exp.job_title || "Position";
          const company2 = exp.company || "Company";
          const duration2 = exp.duration || "";

          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: title2,
                  bold: true,
                  size: cvStyle.fontSize.jobTitle * 2,
                  font: cvStyle.fonts.docxHeading || "Arial",
                  color: cvStyle.colors.heading === rgb(0, 0, 0) ? "000000" : "000000",
                }),
                new TextRun({
                  text: ` - ${company2}${duration2 ? ` • ${duration2}` : ""}`,
                  size: cvStyle.fontSize.body * 2,
                  font: cvStyle.fonts.docxBody || "Arial",
                  color: cvStyle.colors.secondary === rgb(0, 0, 0) ? "000000" : "333333",
                }),
              ],
              spacing: { after: cvStyle.spacing.betweenItems * 20 },
            })
          );

          // Use bullets array if available (limit to 2), otherwise fallback to description
          const bullets2 = exp.bullets || [];
          if (bullets2.length > 0) {
            // Limit to exactly 2 bullets per job
            for (const bullet of bullets2.slice(0, 2)) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: cvStyle.layout.bulletStyle === "dash" ? "— " : 
                            cvStyle.layout.bulletStyle === "arrow" ? "→ " : "• ", 
                      bold: true,
                      size: cvStyle.fontSize.bullet * 2,
                    }),
                    new TextRun({ 
                      text: bullet.trim(),
                      size: cvStyle.fontSize.bullet * 2,
                      font: cvStyle.fonts.docxBody || "Arial",
                      color: cvStyle.colors.text === rgb(0, 0, 0) ? "000000" : "000000",
                    }),
                  ],
                  indent: { left: cvStyle.spacing.bulletIndent * 20 },
                  spacing: { after: cvStyle.spacing.betweenItems * 20 },
                })
              );
            }
          } else if (exp.description) {
            const descLines2 = exp.description.split("\n").filter((l: string) => l.trim());
            for (const line of descLines2.slice(0, 2)) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: "• ", bold: true }),
                    new TextRun({ text: line.trim() }),
                  ],
                  indent: { left: 360 },
                  spacing: { after: 40 },
                })
              );
            }
          }
          children.push(new Paragraph({ text: "" }));
        }
        break;

      case "skills":
        children.push(createSectionHeader(section.title));
        const skillLimit2 = getSectionLimits(section.importance, "skills");
        const skillsArray2 = section.content.slice(0, skillLimit2);
        
        // Handle both formats: array of objects {skill, matched} or simple array
        if (skillsArray2.length > 0 && typeof skillsArray2[0] === 'object' && 'skill' in skillsArray2[0]) {
          // New format: array of objects - bold matching skills
          const skillRuns: any[] = [];
          skillsArray2.forEach((s: any, index: number) => {
            const skillName = s.skill || s;
            skillRuns.push(
              new TextRun({
                text: skillName,
                bold: s.matched || false, // Bold matching skills
                size: cvStyle.fontSize.body * 2,
                font: cvStyle.fonts.docxBody || "Arial",
                color: cvStyle.colors.text === rgb(0, 0, 0) ? "000000" : "000000",
              })
            );
            if (index < skillsArray2.length - 1) {
              skillRuns.push(new TextRun({ text: " • ", size: 20, color: "000000" }));
            }
          });
          children.push(
            new Paragraph({
              children: skillRuns,
              spacing: { after: 240 },
            })
          );
        } else {
          // Old format: simple array
          const skillsText2 = skillsArray2.join(" • ");
          children.push(
            new Paragraph({
              text: skillsText2,
              spacing: { after: 240 },
            })
          );
        }
        break;

      case "education":
        children.push(createSectionHeader(section.title));
        const eduLimit2 = getSectionLimits(section.importance, "education");
        for (const edu of section.content.slice(0, eduLimit2)) {
          const degree2 = edu.degree || edu.degree_name || "Degree";
          const institution2 = edu.institution || edu.school || "Institution";
          const startDate2 = edu.start_date || "";
          const endDate2 = edu.end_date || "";
          const year2 = edu.year || edu.graduation_year || "";
          const gpa2 = edu.gpa || "";
          const honors2 = edu.honors || "";

          let eduInfo2 = institution2;
          // Show start/end dates if available (prefer dates over year)
          if (startDate2 && endDate2) {
            eduInfo2 += ` • ${startDate2} - ${endDate2}`;
          } else if (startDate2) {
            eduInfo2 += ` • ${startDate2}`;
          } else if (endDate2) {
            eduInfo2 += ` • ${endDate2}`;
          } else if (year2) {
            // Fallback to year only if no dates available
            eduInfo2 += ` • ${year2}`;
          }
          if (gpa2) eduInfo2 += ` • GPA: ${gpa2}`;
          if (honors2) eduInfo2 += ` • ${honors2}`;

          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: degree2,
                  bold: true,
                  size: 22,
                  color: "000000",
                }),
                new TextRun({
                  text: ` - ${eduInfo2}`,
                  size: 20,
                  color: "000000",
                }),
              ],
              spacing: { after: 100 },
            })
          );

          // Coursework
          if (edu.coursework && edu.coursework.length > 0) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Relevant Coursework: ${edu.coursework.slice(0, 6).join(", ")}`,
                    size: 18,
                    color: "000000",
                  }),
                ],
                spacing: { after: 80 },
              })
            );
          }

          // Achievements
          if (edu.achievements && edu.achievements.length > 0) {
            for (const achievement of edu.achievements.slice(0, 3)) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `• ${achievement}`,
                      size: 18,
                      color: "000000",
                    }),
                  ],
                  spacing: { after: 60 },
                })
              );
            }
          }
        }
        children.push(new Paragraph({ text: "" })); // Spacing
        break;

      case "projects":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.title.toUpperCase(),
                bold: true,
                size: 24,
                color: "000000",
              }),
            ],
            spacing: { before: 240, after: 120 },
          })
        );
        const projLimit2 = getSectionLimits(section.importance, "projects");
        for (const project of section.content.slice(0, projLimit2)) {
          const projName2 = project.name || "Project";
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: projName2,
                  bold: true,
                  size: 22,
                }),
              ],
              spacing: { after: 60 },
            })
          );

          // Use bullets if available, otherwise fallback to description
          if (project.bullets && project.bullets.length > 0) {
            for (const bullet of project.bullets) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `• ${bullet}`,
                      size: cvStyle.fontSize.body * 2,
                      font: cvStyle.fonts.docxBody || "Arial",
                    }),
                  ],
                  indent: { left: 360 },
                  spacing: { after: 40 },
                })
              );
            }
          } else if (project.description) {
            // Fallback to description if bullets not available
            children.push(
              new Paragraph({
                text: project.description,
                indent: { left: 360 },
                spacing: { after: 40 },
              })
            );
          }

          if (project.technologies && project.technologies.length > 0) {
            const techText2 = project.technologies.join(", ");
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Technologies: ${techText2}`,
                    size: 18,
                    color: "000000",
                    italics: true,
                  }),
                ],
                indent: { left: 360 },
                spacing: { after: 80 },
              })
            );
          }
        }
        break;

      case "certifications":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.title.toUpperCase(),
                bold: true,
                size: 24,
                color: "000000",
              }),
            ],
            spacing: { before: 240, after: 120 },
          })
        );
        const certLimit2 = getSectionLimits(section.importance, "certifications");
        for (const cert of section.content.slice(0, certLimit2)) {
          const certName2 = cert.name || "Certification";
          const issuer2 = cert.issuer || "";
          const year3 = cert.year || "";

          children.push(
            new Paragraph({
              text: `${certName2}${issuer2 ? ` • ${issuer2}` : ""}${year3 ? ` • ${year3}` : ""}`,
              spacing: { after: 60 },
            })
          );
        }
        break;

      case "achievements":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.title.toUpperCase(),
                bold: true,
                size: 24,
                color: "000000",
              }),
            ],
            spacing: { before: 240, after: 120 },
          })
        );
        for (const achievement of section.content.slice(0, 5)) {
          const achievementText2 = typeof achievement === "string" ? achievement : achievement.description || achievement.title || "Achievement";
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: "• ", bold: true }),
                new TextRun({ text: achievementText2 }),
              ],
              spacing: { after: 60 },
            })
          );
        }
        break;

      default:
        console.warn(`[DOCX] Unknown section type: ${section.type}`);
        break;
    }
  }

  // OLD CODE BELOW - REMOVE LATER
  /*
  // Professional Summary
  if (tailoredText) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "PROFESSIONAL SUMMARY",
            bold: true,
            size: 24, // 12pt
            color: "000080",
          }),
        ],
        spacing: { before: 120, after: 120 },
      })
    );

    const summaryLines = tailoredText.split("\n").filter((l: string) => l.trim());
    for (const line of summaryLines.slice(0, 6)) {
      children.push(
        new Paragraph({
          text: line.trim(),
          spacing: { after: 60 },
        })
      );
    }

    children.push(new Paragraph({ text: "" })); // Extra spacing
  }

  // Experience Section
  if (structured.experience && structured.experience.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "PROFESSIONAL EXPERIENCE",
            bold: true,
            size: 24, // 12pt
            color: "000080",
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );

    for (const exp of structured.experience.slice(0, 6)) {
      const title = exp.title || exp.job_title || "Position";
      const company = exp.company || "Company";
      const duration = exp.duration || "";

      // Job Title and Company
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: 22, // 11pt
            }),
            new TextRun({
              text: ` - ${company}${duration ? ` • ${duration}` : ""}`,
              size: 20, // 10pt
              color: "666666",
            }),
          ],
          spacing: { after: 60 },
        })
      );

      // Description
      if (exp.description) {
        const descLines = exp.description.split("\n").filter((l: string) => l.trim());
        for (const line of descLines.slice(0, 4)) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "• ",
                  bold: true,
                }),
                new TextRun({
                  text: line.trim(),
                }),
              ],
              indent: { left: 360 }, // 0.25 inch
              spacing: { after: 40 },
            })
          );
        }
      }

      children.push(new Paragraph({ text: "" })); // Spacing between jobs
    }
  }

  // Skills Section
  if (structured.skills && structured.skills.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "TECHNICAL SKILLS",
            bold: true,
            size: 24, // 12pt
            color: "000080",
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );

    const skillsText = structured.skills.slice(0, 20).join(" • ");
    children.push(
      new Paragraph({
        text: skillsText,
        spacing: { after: 240 },
      })
    );
  }

  // Education Section
  if (structured.education && structured.education.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "EDUCATION",
            bold: true,
            size: 24, // 12pt
            color: "000080",
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );

    for (const edu of structured.education.slice(0, 3)) {
      const degree = edu.degree || "Degree";
      const institution = edu.institution || "Institution";
      const year = edu.year || "";

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: degree,
              bold: true,
              size: 22, // 11pt
            }),
            new TextRun({
              text: ` - ${institution}${year ? ` • ${year}` : ""}`,
              size: 20, // 10pt
              color: "666666",
            }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  }

  // Projects Section
  if (structured.projects && structured.projects.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "PROJECTS",
            bold: true,
            size: 24, // 12pt
            color: "000080",
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );

    for (const project of structured.projects.slice(0, 4)) {
      const name = project.name || "Project";
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: name,
              bold: true,
              size: 22, // 11pt
            }),
          ],
          spacing: { after: 60 },
        })
      );

      if (project.description) {
        children.push(
          new Paragraph({
            text: project.description,
            indent: { left: 360 },
            spacing: { after: 40 },
          })
        );
      }

      if (project.technologies && project.technologies.length > 0) {
        const techText = project.technologies.join(", ");
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Technologies: ${techText}`,
                size: 18, // 9pt
                color: "666666",
                italics: true,
              }),
            ],
            indent: { left: 360 },
            spacing: { after: 80 },
          })
        );
      }
    }
  }

  // Certifications Section
  if (structured.certifications && structured.certifications.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "CERTIFICATIONS",
            bold: true,
            size: 24, // 12pt
            color: "000080",
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );

    for (const cert of structured.certifications.slice(0, 5)) {
      const name = cert.name || "Certification";
      const issuer = cert.issuer || "";
      const year = cert.year || "";

      children.push(
        new Paragraph({
          text: `${name}${issuer ? ` • ${issuer}` : ""}${year ? ` • ${year}` : ""}`,
          spacing: { after: 60 },
        })
      );
    }
  }
  */
  // END OLD CODE

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}