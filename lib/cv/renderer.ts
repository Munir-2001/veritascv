/**
 * CV Section Renderer
 * 
 * Handles intelligent rendering of CV sections based on strategy
 */

import { type CVStrategy } from "./strategy";

export interface CVSection {
  type: string;
  title: string;
  content: any;
  importance: "critical" | "important" | "optional" | "skip";
  render: boolean;
}

/**
 * Prepare CV sections based on strategy and available data
 */
export function prepareCVSections(
  structured: any,
  tailoredText: string,
  contactInfo: any,
  strategy: CVStrategy
): CVSection[] {
  const sections: CVSection[] = [];

  // Contact section (always first)
  sections.push({
    type: "contact",
    title: "Contact Information",
    content: contactInfo,
    importance: "critical",
    render: true,
  });

  // Career Objective OR Professional Summary (only one, not both)
  if (structured.about_me && structured.about_me.trim().length > 0) {
    // Career Objective (40 words, hyper-personalized)
    console.log(`[CV Renderer] ✅ Adding Career Objective section`);
    sections.push({
      type: "about_me",
      title: "Career Objective",
      content: structured.about_me,
      importance: "critical",
      render: true,
    });
  } else if (structured.professional_summary && structured.professional_summary.trim().length > 0) {
    // Professional Summary (traditional summary)
    console.log(`[CV Renderer] ✅ Adding Professional Summary section`);
    sections.push({
      type: "summary",
      title: getSummaryTitle(strategy.summaryStyle),
      content: structured.professional_summary,
      importance: "critical",
      render: true,
    });
  } else if (tailoredText && tailoredText.trim().length > 0) {
    // Fallback: use tailoredText if no professional_summary
    console.log(`[CV Renderer] ✅ Adding Professional Summary section (from tailoredText)`);
    sections.push({
      type: "summary",
      title: getSummaryTitle(strategy.summaryStyle),
      content: tailoredText,
      importance: "critical",
      render: true,
    });
  }

  // Education section (FIXED ORDER: After About Me/Summary)
  if (structured.education && structured.education.length > 0) {
    console.log(`[CV Renderer] ✅ Adding education section (${structured.education.length} entries)`);
    sections.push({
      type: "education",
      title: "Education",
      content: structured.education,
      importance: strategy.emphasize.includes("education") ? "critical" : "important",
      render: true,
    });
  } else {
    console.log(`[CV Renderer] ⚠️ Skipping education - no data (${structured.education?.length || 0} entries)`);
  }

  // Experience section (FIXED ORDER: After Education)
  if (structured.experience && structured.experience.length > 0) {
    console.log(`[CV Renderer] ✅ Adding experience section (${structured.experience.length} jobs)`);
    sections.push({
      type: "experience",
      title: "Professional Experience",
      content: structured.experience,
      importance: strategy.emphasize.includes("experience") ? "critical" : "important",
      render: true,
    });
  } else {
    console.log(`[CV Renderer] ⚠️ Skipping experience - no data (${structured.experience?.length || 0} jobs)`);
  }

  // Projects section (FIXED ORDER: After Experience)
  if (structured.projects && structured.projects.length > 0) {
    const importance = strategy.projectsImportance;
    console.log(`[CV Renderer] ✅ Adding projects section (${structured.projects.length} entries, importance: ${importance})`);
    sections.push({
      type: "projects",
      title: "Projects",
      content: structured.projects,
      importance,
      render: importance !== "skip",
    });
  } else {
    console.log(`[CV Renderer] ⚠️ Skipping projects - no data (${structured.projects?.length || 0} entries)`);
  }

  // Skills section (FIXED ORDER: After Projects)
  if (structured.skills && structured.skills.length > 0) {
    console.log(`[CV Renderer] ✅ Adding skills section (${structured.skills.length} skills)`);
    sections.push({
      type: "skills",
      title: "Technical Skills",
      content: structured.skills,
      importance: strategy.emphasize.includes("skills") ? "critical" : "important",
      render: true,
    });
  } else {
    console.log(`[CV Renderer] ⚠️ Skipping skills - no data (${structured.skills?.length || 0} skills)`);
  }

  // Certifications section
  if (structured.certifications && structured.certifications.length > 0) {
    const importance = strategy.certificationsImportance;
    console.log(`[CV Renderer] ✅ Adding certifications section (${structured.certifications.length} certs, importance: ${importance})`);
    sections.push({
      type: "certifications",
      title: "Certifications",
      content: structured.certifications,
      importance,
      render: true,
    });
  } else {
    console.log(`[CV Renderer] ⚠️ Skipping certifications - no data (${structured.certifications?.length || 0} certs)`);
  }

  // Achievements section (for senior+)
  if (structured.achievements && structured.achievements.length > 0) {
    console.log(`[CV Renderer] ✅ Adding achievements section (${structured.achievements.length} achievements)`);
    sections.push({
      type: "achievements",
      title: "Key Achievements",
      content: structured.achievements,
      importance: strategy.emphasize.includes("achievements") ? "critical" : "optional",
      render: strategy.emphasize.includes("achievements"),
    });
  } else if (strategy.emphasize.includes("achievements")) {
    console.log(`[CV Renderer] ⚠️ Achievements emphasized but no data (${structured.achievements?.length || 0} achievements)`);
  }

  // FIXED ORDER: Contact → About Me/Summary → Education → Experience → Projects → Skills → Certifications → Achievements
  const fixedOrder = [
    "contact",
    "about_me",
    "summary",
    "education",
    "experience",
    "projects",
    "skills",
    "certifications",
    "achievements",
  ];

  const orderedSections = fixedOrder
    .map((type) => sections.find((s) => s.type === type))
    .filter((s): s is CVSection => s !== undefined);

  // Add any remaining sections that weren't in the fixed order
  const remainingSections = sections.filter(
    (s) => !fixedOrder.includes(s.type)
  );
  orderedSections.push(...remainingSections);

  return orderedSections.filter((s) => s.render);
}

/**
 * Sort sections based on strategy section order
 */
function sortSectionsByStrategy(sections: CVSection[], strategy: CVStrategy): CVSection[] {
  const orderMap = new Map(strategy.sectionOrder.map((type, index) => [type, index]));

  return sections.sort((a, b) => {
    const aOrder = orderMap.get(a.type) ?? 999;
    const bOrder = orderMap.get(b.type) ?? 999;
    return aOrder - bOrder;
  });
}

/**
 * Get summary section title based on style
 */
function getSummaryTitle(style: "objective" | "professional" | "executive"): string {
  switch (style) {
    case "objective":
      return "Career Objective";
    case "executive":
      return "Executive Profile";
    default:
      return "Professional Summary";
  }
}

/**
 * Determine how many items to show for each section based on importance
 */
export function getSectionLimits(importance: string, sectionType: string): number {
  if (importance === "skip") return 0;

  const limits: Record<string, Record<string, number>> = {
    experience: { critical: 6, important: 5, optional: 3 },
    projects: { critical: 5, important: 3, optional: 2 },
    skills: { critical: 25, important: 20, optional: 15 },
    education: { critical: 3, important: 2, optional: 1 },
    certifications: { critical: 8, important: 5, optional: 3 },
    achievements: { critical: 5, important: 3, optional: 2 },
  };

  return limits[sectionType]?.[importance] || 5;
}

