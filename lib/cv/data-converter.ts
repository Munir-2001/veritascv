/**
 * Data Converter
 * 
 * Converts structured data from CV generation API to CVData format for LaTeX renderer
 */

import type { CVData, ExperienceEntry, EducationEntry, ProjectEntry, SkillEntry, CertificationEntry } from './latex-renderer';

export interface StructuredData {
  about_me?: string;
  professional_summary?: string;
  experience?: any[];
  education?: any[];
  projects?: any[];
  skills?: any[];
  certifications?: any[];
  achievements?: any[];
}

export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

/**
 * Convert structured data to CVData format
 */
export function convertToCVData(
  structured: StructuredData,
  contactInfo: ContactInfo,
  targetJob?: string,
  keywords?: string[],
  impactStatement?: string
): CVData {
  return {
    // Contact Info
    name: contactInfo.name || 'Your Name',
    phone: contactInfo.phone,
    email: contactInfo.email || '',
    linkedin: contactInfo.linkedin,
    github: contactInfo.github,
    portfolio: contactInfo.portfolio,
    targetJob: targetJob,
    
    // Summary
    summary: structured.professional_summary || structured.about_me || '',
    aboutMe: structured.about_me,
    professionalSummary: structured.professional_summary,
    
    // Experience
    experience: convertExperience(structured.experience || []),
    
    // Education
    education: convertEducation(structured.education || []),
    
    // Projects
    projects: convertProjects(structured.projects || []),
    
    // Skills
    skills: convertSkills(structured.skills || []),
    
    // Certifications
    certifications: convertCertifications(structured.certifications || []),
    
    // Optional sections
    achievements: structured.achievements?.map((ach: any) => ({
      title: ach.title || ach.name || '',
      description: ach.description || '',
      year: ach.year || '',
    })),
    
    // Keywords & Impact
    keywords: keywords || [],
    impactStatement: impactStatement || '',
  };
}

/**
 * Convert experience entries
 */
function convertExperience(experience: any[]): ExperienceEntry[] {
  return experience.map((exp: any) => ({
    title: exp.title || exp.job_title || '',
    company: exp.company || exp.company_name || '',
    location: exp.location || '',
    duration: exp.duration || exp.period || (exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` : '') || '',
    bullets: exp.bullets || exp.responsibilities || (exp.description ? [exp.description] : []),
  }));
}

/**
 * Convert education entries
 */
function convertEducation(education: any[]): EducationEntry[] {
  return education.map((edu: any) => ({
    degree: edu.degree || edu.degree_name || '',
    institution: edu.institution || edu.school || edu.university || '',
    location: edu.location || '',
    gpa: edu.gpa || edu.grade || '',
    duration: edu.duration || edu.period || (edu.start_date && edu.end_date ? `${edu.start_date} - ${edu.end_date}` : '') || edu.year || '',
    coursework: edu.coursework || [],
  }));
}

/**
 * Convert project entries
 */
function convertProjects(projects: any[]): ProjectEntry[] {
  return projects.map((proj: any) => ({
    name: proj.name || proj.title || '',
    description: proj.description || '',
    technologies: proj.technologies || proj.tech_stack || (typeof proj.tech === 'string' ? proj.tech.split(',').map((t: string) => t.trim()) : []) || [],
    duration: proj.duration || proj.period || '',
    bullets: proj.bullets || (proj.description ? [proj.description] : []),
  }));
}

/**
 * Convert skills entries
 */
function convertSkills(skills: any[]): SkillEntry[] {
  // Handle different skill formats
  if (skills.length === 0) return [];
  
  // If skills is array of strings
  if (typeof skills[0] === 'string') {
    return [{
      category: 'Technical Skills',
      items: skills as string[],
    }];
  }
  
  // If skills is array of objects with {skill, matched}
  if (skills[0]?.skill) {
    return [{
      category: 'Technical Skills',
      items: skills.map((s: any) => s.skill),
    }];
  }
  
  // If skills is array of objects with {category, items}
  if (skills[0]?.category || skills[0]?.name) {
    return skills.map((skill: any) => ({
      category: skill.category || skill.name || 'Skills',
      items: Array.isArray(skill.items) ? skill.items : (skill.skills || []),
    }));
  }
  
  // Default: treat as single category
  return [{
    category: 'Technical Skills',
    items: skills,
  }];
}

/**
 * Convert certification entries
 */
function convertCertifications(certifications: any[]): CertificationEntry[] {
  return certifications.map((cert: any) => ({
    name: cert.name || cert.title || '',
    issuer: cert.issuer || cert.organization || cert.institution || '',
    year: cert.year || cert.date || '',
  }));
}

