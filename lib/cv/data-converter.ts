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
 * Fix mangled education text (add spaces where missing)
 */
function fixMangledEducationText(text: string): string {
  if (!text || text.length === 0) return text;
  
  // Step 1: Split camelCase words (e.g., "MasterofScience" -> "Master of Science")
  let fixed = text.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Step 2: Add space before opening parentheses if missing
  fixed = fixed.replace(/([a-zA-Z0-9])(\()/g, '$1 $2');
  
  // Step 3: Add space after closing parentheses if missing
  fixed = fixed.replace(/(\))([A-Za-z])/g, '$1 $2');
  
  // Step 4: Add space before commas if missing
  fixed = fixed.replace(/([a-zA-Z0-9])(,)([A-Za-z])/g, '$1$2 $3');
  
  // Step 5: Fix common degree patterns
  fixed = fixed.replace(/\bMasterof\s*Science/gi, 'Master of Science');
  fixed = fixed.replace(/\bMasterof\s*Arts/gi, 'Master of Arts');
  fixed = fixed.replace(/\bBachelorof\s*Science/gi, 'Bachelor of Science');
  fixed = fixed.replace(/\bBachelorof\s*Arts/gi, 'Bachelor of Arts');
  fixed = fixed.replace(/\bBachelorof\s*Engineering/gi, 'Bachelor of Engineering');
  
  // Step 6: Fix common honor patterns
  fixed = fixed.replace(/\b(MeritScholar|Merit\s*Scholar)/gi, 'Merit Scholar');
  fixed = fixed.replace(/\b(BatchGoldMedalist|Batch\s*Gold\s*Medalist)/gi, 'Batch Gold Medalist');
  
  // Step 7: Fix location patterns
  fixed = fixed.replace(/([A-Z][a-z]+),([A-Z][a-z]+)/g, '$1, $2');
  
  // Step 8: Clean up multiple spaces
  fixed = fixed.replace(/\s+/g, ' ').trim();
  
  return fixed;
}

/**
 * Convert education entries
 */
function convertEducation(education: any[]): EducationEntry[] {
  return education.map((edu: any) => ({
    degree: fixMangledEducationText(edu.degree || edu.degree_name || ''),
    institution: fixMangledEducationText(edu.institution || edu.school || edu.university || ''),
    location: fixMangledEducationText(edu.location || ''),
    gpa: edu.gpa || edu.grade || '',
    duration: edu.duration || edu.period || (edu.start_date && edu.end_date ? `${edu.start_date} - ${edu.end_date}` : '') || edu.year || '',
    coursework: (edu.coursework || []).map((c: string) => fixMangledEducationText(c)),
  }));
}

/**
 * Convert project entries
 */
function convertProjects(projects: any[]): ProjectEntry[] {
  // Filter out education entries that might have been misclassified as projects
  const educationIndicators = [
    /^(Bachelor|Master|PhD|Doctorate|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|B\.?E\.?|M\.?E\.?)/i,
    /University|College|School|Institute|Academy/i,
    /Degree|Diploma|Certificate|Graduation/i,
    /GPA|Grade|Honors|Dean's List|Cum Laude/i,
    /Coursework|Courses|Relevant Coursework/i,
    /MeritScholar|BatchGoldMedalist/i,
  ];
  
  return projects
    .filter((project: any) => {
      const projName = (project.name || project.title || '').toLowerCase();
      const projDesc = (project.description || '').toLowerCase();
      const projText = `${projName} ${projDesc}`.toLowerCase();
      
      const isEducation = educationIndicators.some(pattern => pattern.test(projText));
      if (isEducation) {
        console.log(`[Data Converter] ⚠️ Filtering out education entry from projects: "${project.name || project.title}"`);
        return false;
      }
      return true;
    })
    .map((proj: any) => ({
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

