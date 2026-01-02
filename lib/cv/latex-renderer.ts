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
  
  // Projects
  const projectsLatex = data.projects.map(project => {
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
    return `  \\resumeSubheading
      {${escapeLatex(edu.institution)}}{${escapeLatex(edu.duration)}}
      {${escapeLatex(edu.degree)}}{${escapeLatex(edu.location || '')}}`;
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
function renderEntryLevelTemplate(template: string, data: CVData): string {
  // Education
  const educationLatex = data.education.map(edu => {
    const gpa = edu.gpa ? `, GPA: ${edu.gpa}` : '';
    return `\\subsection*{${escapeLatex(edu.degree)}${gpa}, {\\normalsize \\normalfont ${escapeLatex(edu.institution)}} \\hfill ${escapeLatex(edu.duration)}} 
\\vspace{0.1cm}`;
  }).join('\n');
  template = template.replace(/\{\{EDUCATION\}\}/g, educationLatex || '');
  
  // Projects
  const projectsLatex = data.projects.map(project => {
    const bullets = project.bullets?.map(b => 
      `        \\item ${escapeLatex(b)}`
    ).join('\n        ') || '';
    
    return `\\subsection*{${escapeLatex(project.name)}${project.duration ? `, {\\normalsize\\normalfont ${escapeLatex(project.description || '')}} \\hfill ${escapeLatex(project.duration)}` : ''}} 
    \\begin{zitemize}
        ${bullets}
    \\end{zitemize}`;
  }).join('\n\n');
  template = template.replace(/\{\{PROJECTS\}\}/g, projectsLatex || '');
  
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
    return `\\educationHeading{${escapeLatex(edu.institution)}}{${escapeLatex(edu.degree)}}{${escapeLatex(edu.location || '')}}{${escapeLatex(edu.duration)}}
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
  
  // Projects
  const projectsLatex = data.projects.map(project => {
    const tech = project.technologies?.join(', ') || '';
    const bullets = project.bullets?.map(b => 
      `    \\item ${escapeLatex(b)}`
    ).join('\n    ') || '';
    
    if (bullets) {
      return `\\projectHeading{${escapeLatex(project.name)}}{${escapeLatex(project.description || '')}}{${escapeLatex(tech)}}
\\begin{bullets}
    ${bullets}
\\end{bullets}
\\sectionsep`;
    } else {
      return `\\projectHeading{${escapeLatex(project.name)}}{${escapeLatex(project.description || '')}}{${escapeLatex(tech)}}
\\sectionsep`;
    }
  }).join('\n\n');
  template = template.replace(/\{\{PROJECTS\}\}/g, projectsLatex || '');
  
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
    return `  \\resumeSubHeadingListStart
    \\resumeSubheading
      {${escapeLatex(edu.institution)}}{${escapeLatex(edu.location || '')}}
      {${escapeLatex(edu.degree)}${edu.gpa ? `, GPA: ${edu.gpa}` : ''}}{${escapeLatex(edu.duration)}}
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
  
  // Projects
  const projectsLatex = data.projects.map(project => {
    const tech = project.technologies?.join(', ') || '';
    const bullets = project.bullets?.map(b => 
      `            \\resumeItem{${escapeLatex(b)}}`
    ).join('\n') || '';
    
    return `    \\resumeSubHeadingListStart
      \\resumeProjectHeading
          {\\textbf{${escapeLatex(project.name)}} $|$ \\emph{${escapeLatex(tech)}}}{${escapeLatex(project.duration || '')}}
          ${bullets ? `\\resumeItemListStart\n            ${bullets}\n          \\resumeItemListEnd` : ''}
    \\resumeSubHeadingListEnd`;
  }).join('\n\n');
  template = template.replace(/\{\{PROJECTS\}\}/g, projectsLatex || '');
  
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
    return `  \\resumeSubHeadingListStart
    \\resumeSubheading
      {${escapeLatex(edu.institution)}}{${escapeLatex(edu.location || '')}}
      {${escapeLatex(edu.degree)}${edu.gpa ? `;  CGPA: ${edu.gpa}` : ''}}{${escapeLatex(edu.duration)}}
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
  
  // Projects
  const projectsLatex = data.projects.map(project => {
    return `    \\resumeSubItem{${escapeLatex(project.name)}${project.duration ? ` (${escapeLatex(project.duration)})` : ''}}
      {${escapeLatex(project.description || project.bullets?.join('. ') || '')}}`;
  }).join('\n');
  template = template.replace(/\{\{PROJECTS\}\}/g, 
    `  \\resumeSubHeadingListStart\n${projectsLatex}\n  \\resumeSubHeadingListEnd` || '');
  
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

