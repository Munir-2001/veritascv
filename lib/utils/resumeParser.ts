/**
 * Resume Parser Utilities
 * 
 * This file contains helper functions for parsing resumes.
 * In production, consider using AI services (OpenAI, Anthropic) for better extraction.
 */

export interface ParsedResume {
  raw_text: string;
  structured: {
    experience: Array<{
      title: string;
      company: string;
      duration: string;
      description: string;
    }>;
    skills: string[];
    education: Array<{
      degree: string;
      institution: string;
      year: string;
    }>;
    projects: Array<{
      name: string;
      description: string;
      technologies: string[];
    }>;
    certifications: Array<{
      name: string;
      issuer: string;
      year: string;
    }>;
  };
}

/**
 * Calculate CV completeness score based on extracted data
 */
export function calculateCompletenessScore(structured: ParsedResume["structured"]): number {
  let score = 0;
  const maxScore = 100;

  // Experience (40 points)
  if (structured.experience && structured.experience.length > 0) {
    score += Math.min(40, structured.experience.length * 10);
  }

  // Skills (20 points)
  if (structured.skills && structured.skills.length > 0) {
    score += Math.min(20, structured.skills.length * 2);
  }

  // Education (20 points)
  if (structured.education && structured.education.length > 0) {
    score += Math.min(20, structured.education.length * 10);
  }

  // Projects (10 points)
  if (structured.projects && structured.projects.length > 0) {
    score += Math.min(10, structured.projects.length * 5);
  }

  // Certifications (10 points)
  if (structured.certifications && structured.certifications.length > 0) {
    score += Math.min(10, structured.certifications.length * 5);
  }

  return Math.min(maxScore, score);
}

/**
 * Pre-fill knowledge base fields from parsed resume
 */
export function prefillKnowledgeBase(structured: ParsedResume["structured"]): Record<string, any> {
  const kb: Record<string, any> = {};

  // Extract skills
  if (structured.skills && structured.skills.length > 0) {
    kb.skills = structured.skills;
  }

  // Extract work experience summary
  if (structured.experience && structured.experience.length > 0) {
    kb.work_experience = structured.experience.map((exp) => ({
      role: exp.title,
      company: exp.company,
      period: exp.duration,
    }));
  }

  // Extract education summary
  if (structured.education && structured.education.length > 0) {
    kb.education = structured.education.map((edu) => ({
      degree: edu.degree,
      institution: edu.institution,
      year: edu.year,
    }));
  }

  return kb;
}

