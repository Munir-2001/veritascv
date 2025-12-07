import { Metadata } from "next";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";

export const metadata: Metadata = genMeta({
  title: "Login - VeritasCV",
  description: "Sign in to VeritasCV to access AI-powered resume optimization, CV tailoring, and cover letter generation tools.",
  keywords: ["login", "sign in", "resume builder login", "CV builder account"],
  path: "/login",
});

