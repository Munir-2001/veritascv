"use client";

import { generateStructuredData, generateOrganizationData } from "@/lib/seo/metadata";

interface StructuredDataProps {
  type?: "WebApplication" | "Organization" | "BreadcrumbList";
  data?: any;
}

export default function StructuredData({ type = "WebApplication", data }: StructuredDataProps) {
  let structuredData;

  if (data) {
    structuredData = data;
  } else if (type === "Organization") {
    structuredData = generateOrganizationData();
  } else {
    structuredData = generateStructuredData({
      description:
        "Create resumes that get interviews. AI-powered resume tailoring, cover letter generation, and CV auditing to help you land your dream job.",
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

