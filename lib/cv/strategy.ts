/**
 * CV Strategy Engine
 * 
 * Determines optimal CV structure and content based on job level,
 * domain, and recruiter best practices
 */

export type JobLevel = "entry" | "junior" | "mid" | "senior" | "executive" | "internship";
export type Domain = 
  | "software-engineering"
  | "data-science"
  | "product-management"
  | "design"
  | "business"
  | "marketing"
  | "general";

export interface CVStrategy {
  sectionOrder: string[];
  emphasize: string[];
  deemphasize: string[];
  maxPages: number;
  showGPA: boolean;
  showCoursework: boolean;
  projectsImportance: "critical" | "important" | "optional" | "skip";
  certificationsImportance: "critical" | "important" | "optional";
  summaryStyle: "objective" | "professional" | "executive";
  experienceStyle: "detailed" | "achievements" | "leadership";
}

/**
 * Get CV strategy based on job level
 */
export function getCVStrategy(jobLevel: JobLevel, domain: Domain = "general"): CVStrategy {
  switch (jobLevel) {
    case "entry":
    case "internship":
      return {
        sectionOrder: [
          "contact",
          "about_me",
          "summary",
          "education",
          "projects",
          "skills",
          "experience",
          "certifications",
          "achievements",
        ],
        emphasize: ["projects", "certifications", "skills", "education"],
        deemphasize: ["experience"],
        maxPages: 1,
        showGPA: true,
        showCoursework: true,
        projectsImportance: "critical",
        certificationsImportance: "critical",
        summaryStyle: "objective",
        experienceStyle: "detailed",
      };

    case "junior":
      return {
        sectionOrder: [
          "contact",
          "about_me",
          "summary",
          "experience",
          "projects",
          "skills",
          "education",
          "certifications",
        ],
        emphasize: ["experience", "projects", "skills"],
        deemphasize: [],
        maxPages: 1,
        showGPA: false,
        showCoursework: false,
        projectsImportance: "important",
        certificationsImportance: "important",
        summaryStyle: "professional",
        experienceStyle: "achievements",
      };

    case "mid":
      return {
        sectionOrder: [
          "contact",
          "about_me",
          "summary",
          "experience",
          "skills",
          "projects",
          "education",
          "certifications",
        ],
        emphasize: ["experience", "skills"],
        deemphasize: ["projects"],
        maxPages: 2,
        showGPA: false,
        showCoursework: false,
        projectsImportance: "optional",
        certificationsImportance: "important",
        summaryStyle: "professional",
        experienceStyle: "achievements",
      };

    case "senior":
      return {
        sectionOrder: [
          "contact",
          "about_me",
          "summary",
          "achievements",
          "experience",
          "skills",
          "education",
          "certifications",
        ],
        emphasize: ["experience", "achievements", "skills"],
        deemphasize: ["projects", "education"],
        maxPages: 2,
        showGPA: false,
        showCoursework: false,
        projectsImportance: "skip",
        certificationsImportance: "optional",
        summaryStyle: "executive",
        experienceStyle: "leadership",
      };

    case "executive":
      return {
        sectionOrder: [
          "contact",
          "about_me",
          "summary",
          "achievements",
          "experience",
          "education",
          "certifications",
        ],
        emphasize: ["achievements", "experience"],
        deemphasize: ["skills", "projects"],
        maxPages: 2,
        showGPA: false,
        showCoursework: false,
        projectsImportance: "skip",
        certificationsImportance: "optional",
        summaryStyle: "executive",
        experienceStyle: "leadership",
      };

    default:
      return getCVStrategy("mid", domain);
  }
}

/**
 * Action verbs for different contexts
 */
export const ACTION_VERBS = {
  leadership: ["Led", "Directed", "Managed", "Coordinated", "Supervised", "Mentored", "Guided", "Trained"],
  achievement: ["Achieved", "Exceeded", "Delivered", "Improved", "Increased", "Reduced", "Saved", "Generated"],
  technical: ["Developed", "Designed", "Engineered", "Architected", "Implemented", "Built", "Programmed", "Optimized"],
  innovation: ["Pioneered", "Launched", "Established", "Created", "Initiated", "Introduced", "Transformed", "Revolutionized"],
  analysis: ["Analyzed", "Evaluated", "Assessed", "Researched", "Investigated", "Streamlined", "Identified"],
  collaboration: ["Collaborated", "Partnered", "Facilitated", "Coordinated", "Aligned", "Unified"],
};

/**
 * Enhance bullet point with action verbs and STAR format
 */
export function enhanceBulletPoint(text: string, context: "leadership" | "technical" | "achievement" = "achievement"): string {
  // Remove existing bullet point markers
  let enhanced = text.replace(/^[•\-\*]\s*/, "").trim();
  
  // Check if starts with action verb
  const startsWithActionVerb = Object.values(ACTION_VERBS)
    .flat()
    .some((verb) => enhanced.toLowerCase().startsWith(verb.toLowerCase()));
  
  if (!startsWithActionVerb) {
    // Add appropriate action verb based on context
    const verbs = ACTION_VERBS[context] || ACTION_VERBS.achievement;
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    
    // Lowercase first letter of original text
    enhanced = enhanced.charAt(0).toLowerCase() + enhanced.slice(1);
    enhanced = `${verb} ${enhanced}`;
  }
  
  return enhanced;
}

/**
 * Extract and highlight quantifiable metrics from text
 */
export function extractMetrics(text: string): { hasMetrics: boolean; metrics: string[] } {
  const metricPatterns = [
    /\d+%/g, // Percentages
    /\$[\d,]+/g, // Dollar amounts
    /\d+[KMB]/g, // Thousands, Millions, Billions
    /\d+\s*(?:users|customers|clients|employees|projects|months|years|days|hours)/gi,
    /\d+x/g, // Multipliers
  ];
  
  const metrics: string[] = [];
  metricPatterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      metrics.push(...matches);
    }
  });
  
  return {
    hasMetrics: metrics.length > 0,
    metrics: [...new Set(metrics)], // Remove duplicates
  };
}

/**
 * Score CV completeness and quality
 */
export function scoreCVQuality(data: {
  hasContact: boolean;
  hasSummary: boolean;
  experienceCount: number;
  hasMetrics: boolean;
  skillsCount: number;
  projectsCount: number;
  certificationsCount: number;
  educationCount: number;
  jobLevel: JobLevel;
}): { score: number; feedback: string[] } {
  let score = 0;
  const feedback: string[] = [];
  
  // Contact info (critical)
  if (data.hasContact) {
    score += 15;
  } else {
    feedback.push("❌ Missing contact information");
  }
  
  // Professional summary (critical)
  if (data.hasSummary) {
    score += 15;
  } else {
    feedback.push("❌ Missing professional summary");
  }
  
  // Experience (weight based on level)
  const expWeight = ["entry", "internship"].includes(data.jobLevel) ? 15 : 25;
  if (data.experienceCount >= 2) {
    score += expWeight;
  } else if (data.experienceCount >= 1) {
    score += expWeight / 2;
    feedback.push("⚠️ Limited work experience");
  } else {
    feedback.push("❌ No work experience listed");
  }
  
  // Metrics and quantification
  if (data.hasMetrics) {
    score += 15;
  } else {
    feedback.push("⚠️ Add quantifiable achievements (numbers, percentages, impact)");
  }
  
  // Skills
  if (data.skillsCount >= 5) {
    score += 10;
  } else if (data.skillsCount > 0) {
    score += 5;
    feedback.push("⚠️ Add more relevant skills");
  } else {
    feedback.push("❌ No skills listed");
  }
  
  // Projects (critical for entry-level)
  if (["entry", "internship", "junior"].includes(data.jobLevel)) {
    if (data.projectsCount >= 3) {
      score += 15;
    } else if (data.projectsCount >= 1) {
      score += 10;
      feedback.push("⚠️ Add more projects to showcase skills");
    } else {
      feedback.push("❌ Projects are critical for entry-level roles");
    }
  } else {
    score += 10; // Less critical for senior roles
  }
  
  // Certifications
  if (data.certificationsCount > 0) {
    score += 10;
  } else {
    feedback.push("💡 Consider adding relevant certifications");
  }
  
  // Education
  if (data.educationCount > 0) {
    score += 10;
  } else {
    feedback.push("❌ Missing education information");
  }
  
  // Add positive feedback based on score
  if (score >= 90) {
    feedback.unshift("✅ Excellent CV! Ready to impress recruiters");
  } else if (score >= 75) {
    feedback.unshift("✅ Good CV! Minor improvements suggested");
  } else if (score >= 60) {
    feedback.unshift("⚠️ Decent CV but needs improvement");
  } else {
    feedback.unshift("❌ CV needs significant improvement");
  }
  
  return { score: Math.min(100, score), feedback };
}

/**
 * Get domain-specific keywords for optimization
 */
export function getDomainKeywords(domain: Domain): string[] {
  const keywords: Record<Domain, string[]> = {
    "software-engineering": [
      "Agile", "CI/CD", "DevOps", "Microservices", "API", "Database", "Testing",
      "Architecture", "Code Review", "Git", "Cloud", "Performance", "Security"
    ],
    "data-science": [
      "Machine Learning", "Deep Learning", "Python", "R", "SQL", "Statistics",
      "Data Visualization", "Feature Engineering", "Model Deployment", "ETL",
      "Big Data", "A/B Testing", "Predictive Analytics"
    ],
    "product-management": [
      "Product Strategy", "Roadmap", "Stakeholder Management", "User Research",
      "A/B Testing", "Metrics", "PRD", "Agile", "User Stories", "Go-to-Market",
      "Product Launch", "Customer Feedback"
    ],
    "design": [
      "UI/UX", "User Research", "Prototyping", "Wireframing", "Design Systems",
      "Accessibility", "User Testing", "Figma", "Sketch", "Information Architecture",
      "Interaction Design", "Visual Design"
    ],
    "business": [
      "Strategy", "Analysis", "Financial Modeling", "Stakeholder Management",
      "Process Improvement", "P&L", "ROI", "Business Development", "Partnerships",
      "Revenue Growth", "Market Analysis"
    ],
    "marketing": [
      "Digital Marketing", "SEO", "SEM", "Content Strategy", "Social Media",
      "Email Marketing", "Analytics", "Campaign Management", "Brand Strategy",
      "Growth Marketing", "Conversion Optimization"
    ],
    "general": [
      "Leadership", "Communication", "Problem Solving", "Teamwork", "Project Management",
      "Time Management", "Critical Thinking", "Adaptability"
    ],
  };
  
  return keywords[domain] || keywords.general;
}

