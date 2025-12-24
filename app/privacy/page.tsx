"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function PrivacyPolicyPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="w-full border-b border-steel/20 sticky top-0 bg-background/95 backdrop-blur-md z-50 shadow-sm">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-lg">V</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-accent/70 bg-clip-text text-transparent">
              VeritasCV
            </h1>
          </Link>
          
          <div className="flex items-center gap-4">
            {!loading && (
              <>
                {isLoggedIn ? (
                  <Link
                    href="/dashboard"
                    className="px-6 py-2 bg-accent text-background text-sm font-semibold rounded-lg hover:bg-accent/90 transition-all duration-300"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="px-6 py-2 bg-accent text-background text-sm font-semibold rounded-lg hover:bg-accent/90 transition-all duration-300"
                  >
                    Login / Sign Up
                  </Link>
                )}
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">Privacy Policy</h1>
          <p className="text-steel-light text-lg mb-2">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p className="text-steel-light mb-12">
            This Privacy Policy describes how VeritasCV ("we", "our", or "us") collects, uses, and protects your personal information when you use our services. We are committed to protecting your privacy and ensuring compliance with the General Data Protection Regulation (GDPR) and other applicable data protection laws.
          </p>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">1. Data Controller</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              VeritasCV is the data controller responsible for your personal data. If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="bg-steel/10 rounded-lg p-6 border border-steel/20 mb-4">
              <p className="text-steel-light mb-2"><strong className="text-foreground">Email:</strong> privacy@veritascv.com</p>
              <p className="text-steel-light"><strong className="text-foreground">Website:</strong> <Link href="/" className="text-accent hover:underline">veritascv.com</Link></p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">2. Information We Collect</h2>
            
            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">2.1 Account Information</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              When you create an account, we collect:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li>Email address</li>
              <li>Password (stored in encrypted form)</li>
              <li>Account creation date and last login information</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">2.2 Resume and CV Data</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              When you upload a resume or CV, we collect and process:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li>Personal identification information (name, email, phone number, address)</li>
              <li>Professional information (work experience, education, skills, certifications)</li>
              <li>Professional profiles (LinkedIn, GitHub, portfolio links)</li>
              <li>Resume files (PDF, DOCX, TXT formats)</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">2.3 Job Application Data</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              When you use our resume tailoring service, we collect:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li>Job title and description</li>
              <li>Company name and description</li>
              <li>Recruiter information (name, email) if provided</li>
              <li>Additional notes and preferences</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">2.4 Payment Information</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              When you make a purchase, we process payments through Stripe. We do not store your full payment card details. Stripe collects and processes:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li>Payment method information (processed by Stripe)</li>
              <li>Billing address</li>
              <li>Transaction history</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">2.5 Usage Data</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              We automatically collect certain information when you use our services:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li>IP address and device information</li>
              <li>Browser type and version</li>
              <li>Pages visited and time spent on pages</li>
              <li>Date and time of access</li>
              <li>Referral source</li>
            </ul>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">2.6 Waitlist Information</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              If you join our waitlist, we collect your email address to notify you about early access opportunities.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">3. Legal Basis for Processing</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              We process your personal data based on the following legal grounds under GDPR:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li><strong className="text-foreground">Consent:</strong> When you create an account, upload a resume, or join our waitlist, you provide explicit consent for us to process your data.</li>
              <li><strong className="text-foreground">Contract Performance:</strong> Processing is necessary to provide our services, including resume tailoring, CV generation, and cover letter creation.</li>
              <li><strong className="text-foreground">Legitimate Interests:</strong> We process data to improve our services, prevent fraud, and ensure security.</li>
              <li><strong className="text-foreground">Legal Obligation:</strong> We may process data to comply with legal requirements, such as tax and accounting obligations.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">4. How We Use Your Information</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              We use your personal information for the following purposes:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li>To provide and maintain our services (resume tailoring, CV generation, cover letter creation)</li>
              <li>To process payments and manage subscriptions</li>
              <li>To authenticate your account and ensure security</li>
              <li>To communicate with you about your account, services, and updates</li>
              <li>To improve and optimize our services using AI-powered analysis</li>
              <li>To send you marketing communications (with your consent, which you can withdraw at any time)</li>
              <li>To comply with legal obligations and prevent fraud</li>
              <li>To analyze usage patterns and enhance user experience</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">5. Data Sharing and Third-Party Services</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              We share your data with trusted third-party service providers who assist us in operating our services:
            </p>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">5.1 Supabase</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              We use Supabase for database storage, file storage, and authentication. Your data is stored securely on Supabase's infrastructure. Supabase is GDPR compliant and processes data in accordance with their privacy policy.
            </p>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">5.2 AI Service Providers</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              We use AI services (including but not limited to OpenAI, Anthropic, Google Gemini, and Groq) to process and analyze your resume data for tailoring and optimization. These services may process your data in the United States or other jurisdictions. We ensure that appropriate safeguards are in place for international data transfers.
            </p>
            <p className="text-steel-light mb-4 leading-relaxed">
              <strong className="text-foreground">Important:</strong> When you use our AI-powered features, your resume content is sent to these AI providers for processing. We do not use your data to train AI models without your explicit consent.
            </p>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">5.3 Stripe</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              We use Stripe to process payments. Stripe collects and processes payment information in accordance with their privacy policy and PCI-DSS standards. We do not store your full payment card details.
            </p>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">5.4 Other Service Providers</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              We may use other service providers for hosting, analytics, and customer support. All service providers are contractually obligated to protect your data and use it only for the purposes we specify.
            </p>

            <h3 className="text-2xl font-semibold mb-3 text-foreground mt-6">5.5 Legal Requirements</h3>
            <p className="text-steel-light mb-4 leading-relaxed">
              We may disclose your information if required by law, court order, or government regulation, or to protect our rights, property, or safety, or that of our users.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">6. Data Retention</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              We retain your personal data for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li><strong className="text-foreground">Account Data:</strong> Retained for the duration of your account and up to 30 days after account deletion (to allow for account recovery).</li>
              <li><strong className="text-foreground">Resume Data:</strong> Retained until you delete your account or manually delete the resume.</li>
              <li><strong className="text-foreground">Payment Records:</strong> Retained for 7 years as required by tax and accounting laws.</li>
              <li><strong className="text-foreground">Usage Data:</strong> Retained for up to 2 years for analytics and service improvement purposes.</li>
            </ul>
            <p className="text-steel-light mb-4 leading-relaxed">
              You can request deletion of your data at any time by contacting us or using the account deletion feature in your dashboard.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">7. Your Rights Under GDPR</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              As a data subject under GDPR, you have the following rights:
            </p>

            <div className="space-y-4 mb-4">
              <div className="bg-steel/10 rounded-lg p-4 border border-steel/20">
                <h3 className="text-xl font-semibold mb-2 text-foreground">7.1 Right of Access</h3>
                <p className="text-steel-light leading-relaxed">
                  You have the right to request access to your personal data and receive a copy of the data we hold about you.
                </p>
              </div>

              <div className="bg-steel/10 rounded-lg p-4 border border-steel/20">
                <h3 className="text-xl font-semibold mb-2 text-foreground">7.2 Right to Rectification</h3>
                <p className="text-steel-light leading-relaxed">
                  You have the right to request correction of inaccurate or incomplete personal data. You can update most information directly in your account dashboard.
                </p>
              </div>

              <div className="bg-steel/10 rounded-lg p-4 border border-steel/20">
                <h3 className="text-xl font-semibold mb-2 text-foreground">7.3 Right to Erasure ("Right to be Forgotten")</h3>
                <p className="text-steel-light leading-relaxed">
                  You have the right to request deletion of your personal data when it is no longer necessary for the purposes for which it was collected, or when you withdraw consent.
                </p>
              </div>

              <div className="bg-steel/10 rounded-lg p-4 border border-steel/20">
                <h3 className="text-xl font-semibold mb-2 text-foreground">7.4 Right to Restrict Processing</h3>
                <p className="text-steel-light leading-relaxed">
                  You have the right to request restriction of processing of your personal data in certain circumstances, such as when you contest the accuracy of the data.
                </p>
              </div>

              <div className="bg-steel/10 rounded-lg p-4 border border-steel/20">
                <h3 className="text-xl font-semibold mb-2 text-foreground">7.5 Right to Data Portability</h3>
                <p className="text-steel-light leading-relaxed">
                  You have the right to receive your personal data in a structured, commonly used, and machine-readable format and to transmit that data to another controller.
                </p>
              </div>

              <div className="bg-steel/10 rounded-lg p-4 border border-steel/20">
                <h3 className="text-xl font-semibold mb-2 text-foreground">7.6 Right to Object</h3>
                <p className="text-steel-light leading-relaxed">
                  You have the right to object to processing of your personal data based on legitimate interests or for direct marketing purposes.
                </p>
              </div>

              <div className="bg-steel/10 rounded-lg p-4 border border-steel/20">
                <h3 className="text-xl font-semibold mb-2 text-foreground">7.7 Right to Withdraw Consent</h3>
                <p className="text-steel-light leading-relaxed">
                  Where processing is based on consent, you have the right to withdraw your consent at any time. Withdrawal does not affect the lawfulness of processing before withdrawal.
                </p>
              </div>
            </div>

            <p className="text-steel-light mb-4 leading-relaxed">
              To exercise any of these rights, please contact us at <a href="mailto:privacy@veritascv.com" className="text-accent hover:underline">privacy@veritascv.com</a>. We will respond to your request within 30 days.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">8. Data Security</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal data:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li>Encryption of data in transit using TLS/SSL</li>
              <li>Encryption of sensitive data at rest</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security assessments and updates</li>
              <li>Limited access to personal data on a need-to-know basis</li>
              <li>Secure file storage with access controls</li>
            </ul>
            <p className="text-steel-light mb-4 leading-relaxed">
              While we strive to protect your data, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security but are committed to maintaining industry-standard security practices.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">9. International Data Transfers</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              Your data may be transferred to and processed in countries outside the European Economic Area (EEA), including the United States, where our service providers operate. We ensure that appropriate safeguards are in place for such transfers:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
              <li>Adequacy decisions where applicable</li>
              <li>Other appropriate safeguards as required by GDPR</li>
            </ul>
            <p className="text-steel-light mb-4 leading-relaxed">
              By using our services, you consent to the transfer of your data to these countries.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">10. Cookies and Tracking Technologies</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              We use cookies and similar tracking technologies to enhance your experience:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li><strong className="text-foreground">Essential Cookies:</strong> Required for the website to function properly (authentication, security)</li>
              <li><strong className="text-foreground">Functional Cookies:</strong> Remember your preferences and settings</li>
              <li><strong className="text-foreground">Analytics Cookies:</strong> Help us understand how you use our website (with your consent)</li>
            </ul>
            <p className="text-steel-light mb-4 leading-relaxed">
              You can control cookies through your browser settings. However, disabling certain cookies may affect the functionality of our services.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">11. Children's Privacy</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              Our services are not intended for individuals under the age of 16. We do not knowingly collect personal information from children under 16. If you believe we have collected information from a child under 16, please contact us immediately, and we will take steps to delete such information.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">12. Changes to This Privacy Policy</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by:
            </p>
            <ul className="list-disc list-inside text-steel-light mb-4 space-y-2 ml-4">
              <li>Posting the updated policy on this page</li>
              <li>Updating the "Last Updated" date</li>
              <li>Sending you an email notification for significant changes (if you have an account)</li>
            </ul>
            <p className="text-steel-light mb-4 leading-relaxed">
              We encourage you to review this Privacy Policy periodically to stay informed about how we protect your data.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">13. Your Right to Lodge a Complaint</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              If you believe that we have violated your data protection rights, you have the right to lodge a complaint with your local data protection authority (DPA). For users in the European Union, you can find your DPA at:{" "}
              <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                https://edpb.europa.eu/about-edpb/about-edpb/members_en
              </a>
            </p>
            <p className="text-steel-light mb-4 leading-relaxed">
              We encourage you to contact us first at <a href="mailto:privacy@veritascv.com" className="text-accent hover:underline">privacy@veritascv.com</a> so we can address your concerns directly.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground border-b border-steel/20 pb-2">14. Contact Us</h2>
            <p className="text-steel-light mb-4 leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-steel/10 rounded-lg p-6 border border-steel/20">
              <p className="text-steel-light mb-2"><strong className="text-foreground">Email:</strong> <a href="mailto:privacy@veritascv.com" className="text-accent hover:underline">privacy@veritascv.com</a></p>
              <p className="text-steel-light mb-2"><strong className="text-foreground">General Inquiries:</strong> <a href="mailto:support@veritascv.com" className="text-accent hover:underline">support@veritascv.com</a></p>
              <p className="text-steel-light"><strong className="text-foreground">Website:</strong> <Link href="/" className="text-accent hover:underline">veritascv.com</Link></p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-steel/20">
            <p className="text-steel-light text-sm">
              This Privacy Policy is effective as of the date listed above and applies to all users of VeritasCV services.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background text-steel border-t border-steel/20 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <span className="text-background font-bold text-lg">V</span>
                </div>
                <span className="text-foreground font-bold text-xl">VeritasCV</span>
              </div>
              <p className="text-sm text-steel-light">
                AI-powered resume optimization to help you land your dream job.
              </p>
            </div>
            <div>
              <h5 className="text-foreground font-semibold mb-4">Product</h5>
              <ul className="space-y-2 text-sm">
                <li><Link href="/#features" className="hover:text-accent transition text-steel-light">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-accent transition text-steel-light">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-foreground font-semibold mb-4">Legal</h5>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-accent transition text-steel-light">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-accent transition text-steel-light">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-foreground font-semibold mb-4">Support</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:support@veritascv.com" className="hover:text-accent transition text-steel-light">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-steel/20 pt-8 text-center text-sm text-steel">
            © {new Date().getFullYear()} VeritasCV. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}



