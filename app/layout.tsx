import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://veritascv.com"),
  title: {
    default: "VeritasCV - AI-Powered Resume Optimization & CV Builder",
    template: "%s | VeritasCV",
  },
  description: "Create resumes that get interviews. AI-powered resume tailoring, cover letter generation, and CV auditing to help you land your dream job. Free ATS-optimized resume builder.",
  keywords: [
    "resume builder",
    "CV builder",
    "AI resume",
    "resume optimization",
    "ATS resume",
    "cover letter generator",
    "resume tailor",
    "job application",
    "career tools",
    "resume writing",
    "CV optimization",
    "resume checker",
  ],
  authors: [{ name: "VeritasCV" }],
  creator: "VeritasCV",
  publisher: "VeritasCV",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://veritascv.com",
    siteName: "VeritasCV",
    title: "VeritasCV - AI-Powered Resume Optimization & CV Builder",
    description: "Create resumes that get interviews. AI-powered resume tailoring, cover letter generation, and CV auditing to help you land your dream job.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VeritasCV - AI-Powered Resume Builder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VeritasCV - AI-Powered Resume Optimization & CV Builder",
    description: "Create resumes that get interviews. AI-powered resume tailoring, cover letter generation, and CV auditing.",
    images: ["/og-image.png"],
    creator: "@veritascv",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    yahoo: process.env.YAHOO_SITE_VERIFICATION,
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL || "https://veritascv.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
