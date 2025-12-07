import { Metadata } from "next";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta({
  title: "Dashboard - VeritasCV",
  description: "Manage your resumes, track job applications, and generate AI-powered tailored CVs and cover letters.",
  keywords: ["dashboard", "resume management", "job tracking", "CV dashboard"],
  path: "/dashboard",
  noIndex: true, // Dashboard pages are private
});

