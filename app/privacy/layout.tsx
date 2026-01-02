import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "VeritasCV Privacy Policy - Learn how we collect, use, and protect your personal information in compliance with GDPR and data protection laws.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}










