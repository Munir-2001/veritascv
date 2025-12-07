import { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://veritascv.com";
const siteName = "VeritasCV";

/**
 * Generate SEO metadata for pages
 */
export function generateMetadata({
  title,
  description,
  keywords,
  path = "",
  noIndex = false,
}: {
  title: string;
  description: string;
  keywords?: string[];
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${baseUrl}${path}`;

  return {
    title,
    description,
    keywords: keywords || [],
    openGraph: {
      title,
      description,
      url,
      siteName,
      type: "website",
      images: [
        {
          url: `${baseUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${baseUrl}/og-image.png`],
    },
    alternates: {
      canonical: url,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
  };
}

/**
 * Generate structured data (JSON-LD) for SEO
 */
export function generateStructuredData({
  type = "WebApplication",
  name = siteName,
  description,
  url = baseUrl,
  applicationCategory = "BusinessApplication",
  operatingSystem = "Web",
  offers = {
    price: "0",
    priceCurrency: "USD",
  },
}: {
  type?: string;
  name?: string;
  description?: string;
  url?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
}) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name,
    description,
    url,
    applicationCategory,
    operatingSystem,
    offers: {
      "@type": "Offer",
      price: offers.price,
      priceCurrency: offers.priceCurrency,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "1000",
    },
    featureList: [
      "AI-Powered Resume Tailoring",
      "ATS-Optimized CV Generation",
      "Cover Letter Generation",
      "Job Application Tracking",
      "Multiple CV Templates",
    ],
  };
}

/**
 * Generate Organization structured data
 */
export function generateOrganizationData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    sameAs: [
      // Add your social media links here
      // "https://twitter.com/veritascv",
      // "https://linkedin.com/company/veritascv",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Service",
      email: process.env.SUPPORT_EMAIL || "support@veritascv.com",
    },
  };
}

/**
 * Generate BreadcrumbList structured data
 */
export function generateBreadcrumbData(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

