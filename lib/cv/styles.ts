/**
 * CV Style Configuration
 * 
 * Defines fonts, typography, spacing, and tone for different CV templates
 */

import { rgb } from "pdf-lib";

export type CVTemplate = "modern" | "classic" | "creative" | "ats-friendly" | "professional" | "minimalist" | "executive";

export interface CVStyle {
  // Typography
  fonts: {
    body: string; // PDF font name
    heading: string; // PDF font name
    docxBody?: string; // DOCX font family
    docxHeading?: string; // DOCX font family
  };
  
  // Font sizes (in points)
  fontSize: {
    name: number; // Name at top
    sectionHeader: number; // Section titles
    jobTitle: number; // Job titles
    body: number; // Regular text
    contact: number; // Contact info
    bullet: number; // Bullet points
  };
  
  // Spacing (in points)
  spacing: {
    sectionTop: number; // Space before section
    sectionBottom: number; // Space after section
    betweenItems: number; // Space between experience/project items
    lineHeight: number; // Line height multiplier
    bulletIndent: number; // Indent for bullets
  };
  
  // Colors (RGB 0-1)
  colors: {
    text: any; // Main text color
    heading: any; // Section heading color
    accent: any; // Accent color (for highlights)
    secondary: any; // Secondary text (dates, locations)
  };
  
  // Layout
  layout: {
    margin: number; // Page margins
    contentWidth: number; // Content area width
    headerStyle: "underline" | "bold" | "bold-underline" | "border"; // Section header style
    bulletStyle: "dash" | "dot" | "arrow" | "none"; // Bullet point style
  };
  
  // Tone & Writing Style
  tone: {
    formality: "formal" | "professional" | "conversational" | "technical";
    verbosity: "concise" | "moderate" | "detailed";
    emphasis: "achievements" | "skills" | "experience" | "balanced";
    language: "action-oriented" | "descriptive" | "metric-focused" | "balanced";
  };
  
  // ATS Optimization
  atsOptimized: boolean; // Whether optimized for ATS parsing
}

/**
 * Get CV style configuration for a template
 */
export function getCVStyle(template: CVTemplate): CVStyle {
  switch (template) {
    case "modern":
      return {
        fonts: {
          body: "Helvetica",
          heading: "Helvetica-Bold",
          docxBody: "Calibri",
          docxHeading: "Calibri",
        },
        fontSize: {
          name: 20, // Large, prominent name
          sectionHeader: 12, // Clear section headers
          jobTitle: 11, // Job titles
          body: 10, // Regular text
          contact: 9, // Contact info (smaller)
          bullet: 10, // Bullet points
        },
        spacing: {
          sectionTop: 18,
          sectionBottom: 12,
          betweenItems: 10,
          lineHeight: 1.3, // Tighter line height for better space usage
          bulletIndent: 20, // More indent for better bullet visibility
        },
        colors: {
          text: rgb(0, 0, 0), // Pure black
          heading: rgb(0, 0, 0), // Pure black
          accent: rgb(0, 0, 0), // Pure black
          secondary: rgb(0.3, 0.3, 0.3), // Dark gray for dates/locations
        },
        layout: {
          margin: 40, // Reduced margins for better width utilization
          contentWidth: 515, // Increased content width (595 - 40*2 = 515)
          headerStyle: "bold-underline", // Bold with underline
          bulletStyle: "dot", // Standard bullet points
        },
        tone: {
          formality: "professional",
          verbosity: "moderate",
          emphasis: "balanced",
          language: "action-oriented",
        },
        atsOptimized: false,
      };

    case "classic":
      return {
        fonts: {
          body: "Times-Roman",
          heading: "Times-Bold",
          docxBody: "Times New Roman",
          docxHeading: "Times New Roman",
        },
        fontSize: {
          name: 18, // Traditional size
          sectionHeader: 11, // Classic headers
          jobTitle: 11,
          body: 10,
          contact: 9,
          bullet: 10,
        },
        spacing: {
          sectionTop: 18,
          sectionBottom: 12,
          betweenItems: 10,
          lineHeight: 1.3,
          bulletIndent: 12,
        },
        colors: {
          text: rgb(0, 0, 0),
          heading: rgb(0, 0, 0),
          accent: rgb(0, 0, 0),
          secondary: rgb(0.2, 0.2, 0.2),
        },
        layout: {
          margin: 60, // Wider margins (traditional)
          contentWidth: 475,
          headerStyle: "bold", // Simple bold headers
          bulletStyle: "dash", // Dashes for bullets
        },
        tone: {
          formality: "formal",
          verbosity: "concise",
          emphasis: "experience",
          language: "descriptive",
        },
        atsOptimized: false,
      };

    case "creative":
      return {
        fonts: {
          body: "Helvetica",
          heading: "Helvetica-Bold",
          docxBody: "Arial",
          docxHeading: "Arial",
        },
        fontSize: {
          name: 22, // Larger, more prominent
          sectionHeader: 13, // Bold section headers
          jobTitle: 12, // Slightly larger job titles
          body: 10,
          contact: 9,
          bullet: 10,
        },
        spacing: {
          sectionTop: 25, // More breathing room
          sectionBottom: 18,
          betweenItems: 15,
          lineHeight: 1.5, // More line spacing
          bulletIndent: 18,
        },
        colors: {
          text: rgb(0, 0, 0),
          heading: rgb(0, 0, 0),
          accent: rgb(0, 0, 0),
          secondary: rgb(0.4, 0.4, 0.4),
        },
        layout: {
          margin: 45, // Tighter margins for more content
          contentWidth: 505,
          headerStyle: "bold-underline", // Bold with underline
          bulletStyle: "arrow", // Creative arrow bullets
        },
        tone: {
          formality: "professional",
          verbosity: "detailed",
          emphasis: "achievements",
          language: "metric-focused",
        },
        atsOptimized: false,
      };

    case "ats-friendly":
      return {
        fonts: {
          body: "Helvetica", // Simple, ATS-friendly font
          heading: "Helvetica-Bold",
          docxBody: "Arial", // ATS-friendly
          docxHeading: "Arial",
        },
        fontSize: {
          name: 16, // Standard size
          sectionHeader: 11, // Standard headers
          jobTitle: 11,
          body: 10,
          contact: 9,
          bullet: 10,
        },
        spacing: {
          sectionTop: 15,
          sectionBottom: 12,
          betweenItems: 10,
          lineHeight: 1.2, // Tighter spacing for ATS
          bulletIndent: 12,
        },
        colors: {
          text: rgb(0, 0, 0), // Pure black (no colors for ATS)
          heading: rgb(0, 0, 0),
          accent: rgb(0, 0, 0),
          secondary: rgb(0, 0, 0), // All black for ATS
        },
        layout: {
          margin: 50,
          contentWidth: 495,
          headerStyle: "bold", // Simple bold (no underlines for ATS)
          bulletStyle: "dot", // Standard bullets
        },
        tone: {
          formality: "professional",
          verbosity: "concise",
          emphasis: "skills", // Skills-focused for ATS
          language: "action-oriented",
        },
        atsOptimized: true,
      };

    case "professional":
      return {
        fonts: {
          body: "Helvetica",
          heading: "Helvetica-Bold",
          docxBody: "Calibri",
          docxHeading: "Calibri Bold",
        },
        fontSize: {
          name: 22, // Prominent name
          sectionHeader: 13, // Clear section headers
          jobTitle: 11,
          body: 10,
          contact: 9,
          bullet: 10,
        },
        spacing: {
          sectionTop: 20,
          sectionBottom: 14,
          betweenItems: 12,
          lineHeight: 1.35,
          bulletIndent: 22,
        },
        colors: {
          text: rgb(0.15, 0.15, 0.15), // Slightly softer black
          heading: rgb(0, 0, 0), // Pure black for headers
          accent: rgb(0.2, 0.4, 0.8), // Professional blue accent
          secondary: rgb(0.35, 0.35, 0.35), // Medium gray
        },
        layout: {
          margin: 45,
          contentWidth: 505,
          headerStyle: "bold-underline",
          bulletStyle: "dot",
        },
        tone: {
          formality: "professional",
          verbosity: "moderate",
          emphasis: "balanced",
          language: "action-oriented",
        },
        atsOptimized: false,
      };

    case "minimalist":
      return {
        fonts: {
          body: "Helvetica",
          heading: "Helvetica-Bold",
          docxBody: "Arial",
          docxHeading: "Arial Bold",
        },
        fontSize: {
          name: 18, // Clean, not too large
          sectionHeader: 11, // Subtle headers
          jobTitle: 10,
          body: 9.5, // Slightly smaller for minimalist look
          contact: 8.5,
          bullet: 9.5,
        },
        spacing: {
          sectionTop: 16,
          sectionBottom: 10,
          betweenItems: 8,
          lineHeight: 1.25, // Tighter spacing
          bulletIndent: 15,
        },
        colors: {
          text: rgb(0.2, 0.2, 0.2), // Soft black
          heading: rgb(0.1, 0.1, 0.1), // Dark gray
          accent: rgb(0, 0, 0),
          secondary: rgb(0.4, 0.4, 0.4), // Light gray
        },
        layout: {
          margin: 50,
          contentWidth: 495,
          headerStyle: "bold", // Simple bold, no underline
          bulletStyle: "dash", // Minimal dashes
        },
        tone: {
          formality: "professional",
          verbosity: "concise",
          emphasis: "balanced",
          language: "action-oriented",
        },
        atsOptimized: false,
      };

    case "executive":
      return {
        fonts: {
          body: "Times-Roman",
          heading: "Times-Bold",
          docxBody: "Times New Roman",
          docxHeading: "Times New Roman Bold",
        },
        fontSize: {
          name: 24, // Large, authoritative
          sectionHeader: 14, // Prominent headers
          jobTitle: 12,
          body: 11, // Slightly larger for readability
          contact: 10,
          bullet: 11,
        },
        spacing: {
          sectionTop: 24,
          sectionBottom: 16,
          betweenItems: 14,
          lineHeight: 1.4, // More breathing room
          bulletIndent: 25,
        },
        colors: {
          text: rgb(0, 0, 0), // Pure black
          heading: rgb(0, 0, 0), // Pure black
          accent: rgb(0, 0, 0),
          secondary: rgb(0.25, 0.25, 0.25), // Dark gray
        },
        layout: {
          margin: 55, // Generous margins
          contentWidth: 485,
          headerStyle: "bold-underline", // Bold with underline
          bulletStyle: "dot",
        },
        tone: {
          formality: "formal",
          verbosity: "detailed",
          emphasis: "experience",
          language: "descriptive",
        },
        atsOptimized: false,
      };

    default:
      return getCVStyle("modern");
  }
}

/**
 * Get ATS-friendly section title (standard names that ATS systems recognize)
 */
export function getATSSectionTitle(originalTitle: string, template: CVTemplate): string {
  if (template !== "ats-friendly") {
    return originalTitle; // Keep original for non-ATS templates
  }
  
  // Map to ATS-recognizable standard section names
  const titleLower = originalTitle.toLowerCase();
  
  if (titleLower.includes("career objective") || titleLower.includes("objective")) {
    return "OBJECTIVE";
  }
  if (titleLower.includes("professional summary") || titleLower.includes("summary")) {
    return "PROFESSIONAL SUMMARY";
  }
  if (titleLower.includes("experience") || titleLower.includes("work")) {
    return "PROFESSIONAL EXPERIENCE";
  }
  if (titleLower.includes("education")) {
    return "EDUCATION";
  }
  if (titleLower.includes("skill")) {
    return "TECHNICAL SKILLS";
  }
  if (titleLower.includes("project")) {
    return "PROJECTS";
  }
  if (titleLower.includes("certification")) {
    return "CERTIFICATIONS";
  }
  if (titleLower.includes("achievement") || titleLower.includes("honor")) {
    return "ACHIEVEMENTS";
  }
  
  // Default: uppercase the original
  return originalTitle.toUpperCase();
}

/**
 * Get tone instructions for AI prompts based on style
 */
export function getToneInstructions(style: CVStyle): string {
  const { tone } = style;
  
  const formalityMap = {
    formal: "Use formal language, avoid contractions, use third person where appropriate",
    professional: "Use professional language, can use first person, maintain business tone",
    conversational: "Use conversational but professional tone, first person preferred",
    technical: "Use technical terminology, precise language, industry-standard terms",
  };
  
  const verbosityMap = {
    concise: "Be very concise, use short sentences, eliminate filler words",
    moderate: "Use moderate detail, balance between concise and descriptive",
    detailed: "Provide more detail, use descriptive language, include context",
  };
  
  const emphasisMap = {
    achievements: "Emphasize achievements, metrics, and quantifiable results",
    skills: "Emphasize technical skills, technologies, and competencies",
    experience: "Emphasize work experience, responsibilities, and progression",
    balanced: "Balance achievements, skills, and experience equally",
  };
  
  const languageMap = {
    "action-oriented": "Start with strong action verbs, focus on what was accomplished",
    descriptive: "Use descriptive language, explain context and impact",
    "metric-focused": "Include quantifiable metrics, percentages, numbers in every point",
    balanced: "Mix action verbs, descriptions, and metrics appropriately",
  };
  
  const atsOptimization = style.atsOptimized ? `
ATS OPTIMIZATION REQUIREMENTS:
- Use standard section header names (EDUCATION, EXPERIENCE, SKILLS, etc.)
- Include keywords from job description naturally throughout
- Use standard date formats (MM/YYYY or Month YYYY)
- Avoid special characters, symbols, or graphics
- Use simple bullet points (• or -)
- Keep formatting minimal and clean
- Prioritize keyword matching and skills alignment` : "";
  
  return `
WRITING TONE & STYLE:
- Formality: ${formalityMap[tone.formality]}
- Verbosity: ${verbosityMap[tone.verbosity]}
- Emphasis: ${tone.emphasis}
- Language: ${tone.language}
${atsOptimization}
`;
}

