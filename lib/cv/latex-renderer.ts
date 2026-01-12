/**
 * LaTeX Template Renderer
 * 
 * Handles LaTeX template loading, placeholder replacement, and compilation
 */

import fs from 'fs';
import path from 'path';

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  useCases: string[];
  file: string;
  category: string;
  optimizedFor: string[];
}

export interface CVData {
  // Contact Info
  name: string;
  phone?: string;
  email: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  targetJob?: string;
  
  // Content
  summary?: string;
  aboutMe?: string;
  professionalSummary?: string;
  
  // Sections
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  skills: SkillEntry[];
  certifications: CertificationEntry[];
  achievements?: AchievementEntry[];
  publications?: PublicationEntry[];
  awards?: AwardEntry[];
  volunteer?: VolunteerEntry[];
  
  // Keywords & Impact
  keywords?: string[];
  impactStatement?: string;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  location?: string;
  duration: string;
  bullets: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  location?: string;
  gpa?: string;
  duration: string;
  coursework?: string[];
}

export interface ProjectEntry {
  name: string;
  description?: string;
  technologies?: string[];
  duration?: string;
  bullets?: string[];
}

export interface SkillEntry {
  category: string;
  items: string[];
}

export interface CertificationEntry {
  name: string;
  issuer?: string;
  year?: string;
}

export interface AchievementEntry {
  title: string;
  description?: string;
  year?: string;
}

export interface PublicationEntry {
  title: string;
  authors: string[];
  venue?: string;
  year?: string;
}

export interface AwardEntry {
  name: string;
  issuer?: string;
  year?: string;
  amount?: string;
}

export interface VolunteerEntry {
  position: string;
  organization: string;
  duration?: string;
  description?: string;
}

/**
 * Load template metadata
 */
export function loadTemplateMetadata(): TemplateMetadata[] {
  const metadataPath = path.join(process.cwd(), 'templates', 'cv', 'templates.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  return metadata.templates;
}

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): TemplateMetadata | null {
  const templates = loadTemplateMetadata();
  return templates.find(t => t.id === templateId) || null;
}

/**
 * Load LaTeX template file
 */
export function loadTemplate(templateId: string): string {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  
  const templatePath = path.join(process.cwd(), 'templates', 'cv', template.file);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }
  
  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Render LaTeX template with data
 */
export function renderLatexTemplate(templateId: string, data: CVData): string {
  let template = loadTemplate(templateId);
  
  // Replace basic placeholders
  template = template.replace(/\{\{NAME\}\}/g, escapeLatex(data.name));
  template = template.replace(/\{\{EMAIL\}\}/g, escapeLatex(data.email || ''));
  template = template.replace(/\{\{PHONE\}\}/g, escapeLatex(data.phone || ''));
  template = template.replace(/\{\{LINKEDIN_URL\}\}/g, data.linkedin || '');
  template = template.replace(/\{\{LINKEDIN_DISPLAY\}\}/g, escapeLatex(formatLinkedIn(data.linkedin) || ''));
  template = template.replace(/\{\{LINKEDIN_USERNAME\}\}/g, escapeLatex(
    data.linkedin?.match(/linkedin\.com\/in\/([^\/\?]+)/)?.[1] || ''
  ));
  template = template.replace(/\{\{GITHUB_URL\}\}/g, data.github || '');
  template = template.replace(/\{\{GITHUB_DISPLAY\}\}/g, escapeLatex(formatGitHub(data.github) || ''));
  template = template.replace(/\{\{GITHUB_USERNAME\}\}/g, escapeLatex(
    data.github?.match(/github\.com\/([^\/\?]+)/)?.[1] || ''
  ));
  template = template.replace(/\{\{PORTFOLIO_URL\}\}/g, data.portfolio || '');
  template = template.replace(/\{\{PORTFOLIO_DISPLAY\}\}/g, escapeLatex(data.portfolio || 'Portfolio'));
  template = template.replace(/\{\{TARGET_JOB\}\}/g, escapeLatex(data.targetJob || ''));
  
  // Summary/About Me
  const summary = data.summary || data.aboutMe || data.professionalSummary || '';
  template = template.replace(/\{\{SUMMARY\}\}/g, escapeLatex(summary));
  
  // Keywords
  if (data.keywords && data.keywords.length > 0) {
    const keywordsHtml = data.keywords.slice(0, 4).map(k => 
      `\\textbullet \\hspace{0.1cm} ${escapeLatex(k)}`
    ).join(' \\end{minipage}\\begin{minipage}[b]{0.25\\textwidth} ');
    template = template.replace(/\{\{KEYWORDS\}\}/g, 
      `\\begin{minipage}[b]{0.25\\textwidth} ${keywordsHtml} \\end{minipage}`
    );
  } else {
    template = template.replace(/\{\{KEYWORDS\}\}/g, '');
  }
  
  // Impact Statement
  template = template.replace(/\{\{IMPACT_STATEMENT\}\}/g, escapeLatex(data.impactStatement || ''));
  
  // Render sections based on template type
  if (templateId === 'ats-friendly-technical') {
    template = renderATSTemplate(template, data);
  } else if (templateId === 'entry-level') {
    template = renderEntryLevelTemplate(template, data);
  } else if (templateId === 'modern-cv') {
    template = renderModernCVTemplate(template, data);
  } else if (templateId === 'professional-resume') {
    template = renderProfessionalResumeTemplate(template, data);
  } else if (templateId === 'senior-level') {
    template = renderSeniorLevelTemplate(template, data);
  }
  
  return template;
}

/**
 * Render ATS-Friendly Technical template sections
 */
function renderATSTemplate(template: string, data: CVData): string {
  // Technical Skills
  const programmingLanguages = data.skills
    .find(s => s.category.toLowerCase().includes('programming') || s.category.toLowerCase().includes('language'))
    ?.items.join(', ') || '';
  const frameworks = data.skills
    .find(s => s.category.toLowerCase().includes('framework') || s.category.toLowerCase().includes('deep learning'))
    ?.items.join(', ') || '';
  const tools = data.skills
    .find(s => s.category.toLowerCase().includes('tool') || s.category.toLowerCase().includes('library'))
    ?.items.join(', ') || '';
  
  template = template.replace(/\{\{PROGRAMMING_LANGUAGES\}\}/g, escapeLatex(programmingLanguages));
  template = template.replace(/\{\{DEEP_LEARNING_FRAMEWORKS\}\}/g, escapeLatex(frameworks));
  template = template.replace(/\{\{LIBRARIES_TOOLS\}\}/g, escapeLatex(tools));
  
  // Projects - filter out education entries
  const educationIndicatorsATS = [
    /^(Bachelor|Master|PhD|Doctorate|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|B\.?E\.?|M\.?E\.?)/i,
    /University|College|School|Institute|Academy/i,
    /Degree|Diploma|Certificate|Graduation/i,
    /GPA|Grade|Honors|Dean's List|Cum Laude/i,
    /Coursework|Courses|Relevant Coursework/i,
    /MeritScholar|BatchGoldMedalist/i,
  ];
  
  const filteredProjectsATS = data.projects.filter(project => {
    const projName = (project.name || '').toLowerCase();
    const projDesc = (project.description || '').toLowerCase();
    const projText = `${projName} ${projDesc}`.toLowerCase();
    return !educationIndicatorsATS.some(pattern => pattern.test(projText));
  });
  
  const projectsLatex = filteredProjectsATS.map(project => {
    const tech = project.technologies?.join(', ') || '';
    const bullets = project.bullets?.map(b => 
      `\\resumeItem{\\textbullet\\ ${escapeLatex(b)}}`
    ).join('\n          ') || '';
    
    return `  \\resumeSubheading
      {${escapeLatex(project.name)}}{${escapeLatex(project.duration || '')}}
      {${escapeLatex(project.description || '')}}{${escapeLatex(tech)}}
      \\resumeSubHeadingList
          ${bullets}
      \\resumeSubHeadingListEnd`;
  }).join('\n  ');
  template = template.replace(/\{\{PROJECTS\}\}/g, projectsLatex || '');
  
  // Experience
  const experienceLatex = data.experience.map(exp => {
    const bullets = exp.bullets.map(b => 
      `\\resumeItem{\\textbullet\\ ${escapeLatex(b)}}`
    ).join('\n          ');
    
    return `  \\resumeSubheading
      {${escapeLatex(exp.title)}}{${escapeLatex(exp.duration)}}
      {${escapeLatex(exp.company)}}{${escapeLatex(exp.location || '')}}
      \\resumeSubHeadingList
          ${bullets}
      \\resumeSubHeadingListEnd`;
  }).join('\n  ');
  template = template.replace(/\{\{EXPERIENCE\}\}/g, experienceLatex || '');
  
  // Education
  const educationLatex = data.education.map(edu => {
    const degree = fixMangledEducationText(edu.degree);
    const institution = fixMangledEducationText(edu.institution);
    const location = fixMangledEducationText(edu.location || '');
    const duration = fixMangledEducationText(edu.duration);
    return `  \\resumeSubheading
      {${escapeLatex(institution)}}{${escapeLatex(duration)}}
      {${escapeLatex(degree)}}{${escapeLatex(location)}}`;
  }).join('\n  ');
  template = template.replace(/\{\{EDUCATION\}\}/g, educationLatex || '');
  
  // Certifications
  const certificationsLatex = data.certifications.map(cert => {
    return `  \\resumeItem{\\textbullet\\ ${escapeLatex(cert.name)}${cert.issuer ? ` - ${escapeLatex(cert.issuer)}` : ''}${cert.year ? ` (${cert.year})` : ''}}`;
  }).join('\n  ');
  template = template.replace(/\{\{CERTIFICATIONS\}\}/g, certificationsLatex || '');
  
  return template;
}

/**
 * Render Entry-Level template sections
 */
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

function renderEntryLevelTemplate(template: string, data: CVData): string {
  // Education
  const educationLatex = data.education.map(edu => {
    const degree = fixMangledEducationText(edu.degree);
    const institution = fixMangledEducationText(edu.institution);
    const location = fixMangledEducationText(edu.location || '');
    const duration = fixMangledEducationText(edu.duration);
    const gpa = edu.gpa ? `, GPA: ${fixMangledEducationText(edu.gpa)}` : '';
    return `\\subsection*{${escapeLatex(degree)}${gpa}, {\\normalsize \\normalfont ${escapeLatex(institution)}} \\hfill ${escapeLatex(duration)}} 
\\vspace{0.1cm}`;
  }).join('\n');
  template = template.replace(/\{\{EDUCATION\}\}/g, educationLatex || '');
  
  // Projects section removed - no longer included in CVs
  template = template.replace(/\{\{PROJECTS\}\}/g, '');
  
  // Experience
  const experienceLatex = data.experience.map(exp => {
    const bullets = exp.bullets.map(b => 
      `        \\item ${escapeLatex(b)}`
    ).join('\n        ');
    
    return `\\subsection*{${escapeLatex(exp.title)}${exp.location ? ` {\\normalsize\\normalfont (${escapeLatex(exp.location)})}` : ''} \\hfill ${escapeLatex(exp.duration)}} 
\\subtext{${escapeLatex(exp.company)}${exp.location ? ` \\hfill ${escapeLatex(exp.location)}` : ''}} 
    \\begin{zitemize}
        ${bullets}
    \\end{zitemize}`;
  }).join('\n\n');
  template = template.replace(/\{\{EXPERIENCE\}\}/g, experienceLatex || '');
  
  // Skills
  const skillsLatex = data.skills.map(skill => {
    const items = skill.items.join(', ');
    return `\\hskills{${escapeLatex(skill.category)}} &  ${escapeLatex(items)} \\\\`;
  }).join('\n');
  template = template.replace(/\{\{SKILLS\}\}/g, 
    `\\begin{tabular}{p{7em} p{48em}}\n${skillsLatex}\n\\end{tabular}\n\\vspace{-0.2cm}` || '');
  
  // Optional sections (can be empty)
  template = template.replace(/\{\{VOLUNTEER_EXPERIENCE\}\}/g, '');
  template = template.replace(/\{\{PUBLICATIONS\}\}/g, '');
  template = template.replace(/\{\{AWARDS_HONORS\}\}/g, '');
  
  return template;
}

/**
 * Render Modern CV template sections
 */
function renderModernCVTemplate(template: string, data: CVData): string {
  // Extract username from URLs
  const linkedinMatch = data.linkedin?.match(/linkedin\.com\/in\/([^\/\?]+)/);
  const githubMatch = data.github?.match(/github\.com\/([^\/\?]+)/);
  
  template = template.replace(/\{\{LINKEDIN_USERNAME\}\}/g, escapeLatex(linkedinMatch ? linkedinMatch[1] : ''));
  template = template.replace(/\{\{GITHUB_USERNAME\}\}/g, escapeLatex(githubMatch ? githubMatch[1] : ''));
  
  // Education
  const educationLatex = data.education.map(edu => {
    const degree = fixMangledEducationText(edu.degree);
    const institution = fixMangledEducationText(edu.institution);
    const location = fixMangledEducationText(edu.location || '');
    const duration = fixMangledEducationText(edu.duration);
    return `\\educationHeading{${escapeLatex(institution)}}{${escapeLatex(degree)}}{${escapeLatex(location)}}{${escapeLatex(duration)}}
\\sectionsep`;
  }).join('\n');
  template = template.replace(/\{\{EDUCATION\}\}/g, educationLatex || '');
  
  // Experience
  const experienceLatex = data.experience.map(exp => {
    const bullets = exp.bullets.map(b => 
      `    \\item ${escapeLatex(b)}`
    ).join('\n    ');
    
    return `\\resumeHeading{${escapeLatex(exp.company)}}{${escapeLatex(exp.title)}}{${escapeLatex(exp.location || '')}}{${escapeLatex(exp.duration)}}
\\begin{bullets}
    ${bullets}
\\end{bullets}
\\sectionsep`;
  }).join('\n\n');
  template = template.replace(/\{\{EXPERIENCE\}\}/g, experienceLatex || '');
  
  // Projects - filter out education entries
  const educationIndicators2 = [
    /^(Bachelor|Master|PhD|Doctorate|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|B\.?E\.?|M\.?E\.?)/i,
    /University|College|School|Institute|Academy/i,
    /Degree|Diploma|Certificate|Graduation/i,
    /GPA|Grade|Honors|Dean's List|Cum Laude/i,
    /Coursework|Courses|Relevant Coursework/i,
    /MeritScholar|BatchGoldMedalist/i,
  ];
  
  const filteredProjects2 = data.projects.filter(project => {
    const projName = (project.name || '').toLowerCase();
    const projDesc = (project.description || '').toLowerCase();
    const projText = `${projName} ${projDesc}`.toLowerCase();
    return !educationIndicators2.some(pattern => pattern.test(projText));
  });
  
  // Projects section removed - no longer included in CVs
  template = template.replace(/\{\{PROJECTS\}\}/g, '');
  
  // Skills
  const skillsLatex = data.skills.map(skill => {
    const items = skill.items.join(', ');
    return `    \\singleItem{${escapeLatex(skill.category)}:}{${escapeLatex(items)}}`;
  }).join(' \\\\\n');
  template = template.replace(/\{\{SKILLS\}\}/g, 
    `\\begin{skillList}\n${skillsLatex}\n\\end{skillList}` || '');
  
  return template;
}

/**
 * Render Professional Resume template sections
 */
function renderProfessionalResumeTemplate(template: string, data: CVData): string {
  // Education
  const educationLatex = data.education.map(edu => {
    const degree = fixMangledEducationText(edu.degree);
    const institution = fixMangledEducationText(edu.institution);
    const location = fixMangledEducationText(edu.location || '');
    const duration = fixMangledEducationText(edu.duration);
    const gpa = edu.gpa ? `, GPA: ${fixMangledEducationText(edu.gpa)}` : '';
    return `  \\resumeSubHeadingListStart
    \\resumeSubheading
      {${escapeLatex(institution)}}{${escapeLatex(location)}}
      {${escapeLatex(degree)}${gpa}}{${escapeLatex(duration)}}
  \\resumeSubHeadingListEnd`;
  }).join('\n\n');
  template = template.replace(/\{\{EDUCATION\}\}/g, educationLatex || '');
  
  // Experience
  const experienceLatex = data.experience.map(exp => {
    const bullets = exp.bullets.map(b => 
      `        \\resumeItem{${escapeLatex(b)}}`
    ).join('\n');
    
    return `  \\resumeSubHeadingListStart
    \\resumeSubheading
      {${escapeLatex(exp.title)}}{${escapeLatex(exp.duration)}}
      {${escapeLatex(exp.company)}}{${escapeLatex(exp.location || '')}}
      \\resumeItemListStart
        ${bullets}
      \\resumeItemListEnd
  \\resumeSubHeadingListEnd`;
  }).join('\n\n');
  template = template.replace(/\{\{EXPERIENCE\}\}/g, experienceLatex || '');
  
  // Projects - filter out education entries
  const educationIndicatorsPro = [
    /^(Bachelor|Master|PhD|Doctorate|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|B\.?E\.?|M\.?E\.?)/i,
    /University|College|School|Institute|Academy/i,
    /Degree|Diploma|Certificate|Graduation/i,
    /GPA|Grade|Honors|Dean's List|Cum Laude/i,
    /Coursework|Courses|Relevant Coursework/i,
    /MeritScholar|BatchGoldMedalist/i,
  ];
  
  const filteredProjectsPro = data.projects.filter(project => {
    const projName = (project.name || '').toLowerCase();
    const projDesc = (project.description || '').toLowerCase();
    const projText = `${projName} ${projDesc}`.toLowerCase();
    return !educationIndicatorsPro.some(pattern => pattern.test(projText));
  });
  
  // Projects section removed - no longer included in CVs
  template = template.replace(/\{\{PROJECTS\}\}/g, '');
  
  // Skills
  const skillsLatex = data.skills.map(skill => {
    const items = skill.items.join(', ');
    return `     \\textbf{${escapeLatex(skill.category)}}{: ${escapeLatex(items)} }`;
  }).join(' \\\\\n');
  template = template.replace(/\{\{SKILLS\}\}/g, 
    ` \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n     ${skillsLatex}\n    }}\n \\end{itemize}` || '');
  
  return template;
}

/**
 * Render Senior-Level template sections
 */
function renderSeniorLevelTemplate(template: string, data: CVData): string {
  // Education
  const educationLatex = data.education.map(edu => {
    const degree = fixMangledEducationText(edu.degree);
    const institution = fixMangledEducationText(edu.institution);
    const location = fixMangledEducationText(edu.location || '');
    const duration = fixMangledEducationText(edu.duration);
    const gpa = edu.gpa ? `;  CGPA: ${fixMangledEducationText(edu.gpa)}` : '';
    return `  \\resumeSubHeadingListStart
    \\resumeSubheading
      {${escapeLatex(institution)}}{${escapeLatex(location)}}
      {${escapeLatex(degree)}${gpa}}{${escapeLatex(duration)}}
  \\resumeSubHeadingListEnd`;
  }).join('\n\n');
  template = template.replace(/\{\{EDUCATION\}\}/g, educationLatex || '');
  
  // Experience
  const experienceLatex = data.experience.map(exp => {
    const bullets = exp.bullets.map(b => 
      `      \\resumeItem{${escapeLatex(exp.title)}}{${escapeLatex(b)}}`
    ).join('\n');
    
    return `  \\resumeSubHeadingListStart
    \\resumeSubheading
      {${escapeLatex(exp.company)}}{${escapeLatex(exp.location || '')}}
      {${escapeLatex(exp.title)}}{${escapeLatex(exp.duration)}}
      \\resumeItemListStart
        ${bullets}
      \\resumeItemListEnd
  \\resumeSubHeadingListEnd`;
  }).join('\n\n');
  template = template.replace(/\{\{EXPERIENCE\}\}/g, experienceLatex || '');
  
  // Projects section removed - no longer included in CVs
  template = template.replace(/\{\{PROJECTS\}\}/g, '');
  
  // Achievements
  let achievementsLatex = '';
  if (data.achievements && data.achievements.length > 0) {
    achievementsLatex = data.achievements.map(ach => {
      return `    \\resumeSubItem{${escapeLatex(ach.title)}${ach.year ? ` (${ach.year})` : ''}}
      {${escapeLatex(ach.description || '')}}`;
    }).join('\n');
    achievementsLatex = `%-----------ACHIEVEMENTS-----------------\n\\section{Achievements and Responsibilities}\n  \\resumeSubHeadingListStart\n${achievementsLatex}\n  \\resumeSubHeadingListEnd`;
  }
  template = template.replace(/\{\{ACHIEVEMENTS\}\}/g, achievementsLatex || '');
  
  // Skills
  const proficientSkills = data.skills
    .filter(s => s.category.toLowerCase().includes('proficient') || s.category.toLowerCase().includes('expert'))
    .map(s => s.items.join(', '))
    .join(', ') || '';
  const comfortableSkills = data.skills
    .filter(s => !s.category.toLowerCase().includes('proficient') && !s.category.toLowerCase().includes('expert'))
    .map(s => s.items.join(', '))
    .join(', ') || '';
  
  let skillsLatex = '';
  if (proficientSkills) {
    skillsLatex += `    \\item{\n     \\textbf{Proficient}{: ${escapeLatex(proficientSkills)} }\n    }`;
  }
  if (comfortableSkills) {
    if (skillsLatex) skillsLatex += '\n';
    skillsLatex += `    \\item{\n     \\textbf{Comfortable}{: ${escapeLatex(comfortableSkills)}}\n    }`;
  }
  
  template = template.replace(/\{\{SKILLS\}\}/g, 
    ` \\resumeSubHeadingListStart\n${skillsLatex}\n \\resumeSubHeadingListEnd` || '');
  
  return template;
}

/**
 * Escape LaTeX special characters
 */
function escapeLatex(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\$/g, '\\$')
    .replace(/\&/g, '\\&')
    .replace(/\#/g, '\\#')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\_/g, '\\_')
    .replace(/\~/g, '\\textasciitilde{}')
    .replace(/\%/g, '\\%');
}

/**
 * Format LinkedIn URL for display
 */
function formatLinkedIn(url?: string): string {
  if (!url) return '';
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? `linkedin.com/in/${match[1]}` : url;
}

/**
 * Format GitHub URL for display
 */
function formatGitHub(url?: string): string {
  if (!url) return '';
  const match = url.match(/github\.com\/([^\/\?]+)/);
  return match ? `github.com/${match[1]}` : url;
}

