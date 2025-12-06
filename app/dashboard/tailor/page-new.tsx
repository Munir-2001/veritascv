"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import OnboardingModal from "@/components/OnboardingModal";
import ResumePreview from "@/components/ResumePreview";
import ProgressBar from "@/components/ProgressBar";
import AISuggestions from "@/components/AISuggestions";
import RecruiterInfoBanner from "@/components/RecruiterInfoBanner";

interface Resume {
  id: string;
  name?: string;
  file_path: string;
  raw_text: string;
  structured: any;
  parsed_at: string;
}

type TailorStep =
  | "select-resume"
  | "job-description"
  | "job-title"
  | "job-level"
  | "domain"
  | "company-details"
  | "recruiter-details"
  | "additional-context"
  | "review"
  | "generating"
  | "success";

interface JobApplicationData {
  job_title: string;
  job_description: string;
  job_level: string;
  domain: string;
  company_name?: string;
  company_description?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  additional_notes?: string;
  template?: string;
}

const TOTAL_STEPS = 9;

export default function TailorResume() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [step, setStep] = useState<TailorStep>("select-resume");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [tailoredText, setTailoredText] = useState<string>("");
  const [generatedCvUrl, setGeneratedCvUrl] = useState<{ pdf?: string; docx?: string }>({});
  const [applicationId, setApplicationId] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState<JobApplicationData>({
    job_title: "",
    job_description: "",
    job_level: "",
    domain: "",
    company_name: "",
    company_description: "",
    recruiter_name: "",
    recruiter_email: "",
    additional_notes: "",
    template: "modern",
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      if (session.user.id) {
        try {
          const response = await fetch(`/api/resumes/list?user_id=${session.user.id}`);
          if (response.ok) {
            const data = await response.json();
            setResumes(data.resumes || []);
            if (data.resumes.length === 0) {
              setStep("select-resume");
            }
          }
        } catch (err) {
          console.error("Failed to fetch resumes:", err);
        }
      }

      setLoading(false);
    };

    checkSession();
  }, [router]);

  const getCurrentStepNumber = (): number => {
    const stepMap: Record<TailorStep, number> = {
      "select-resume": 1,
      "job-description": 2,
      "job-title": 3,
      "job-level": 4,
      "domain": 5,
      "company-details": 6,
      "recruiter-details": 7,
      "additional-context": 8,
      "review": 9,
      "generating": 9,
      "success": 9,
    };
    return stepMap[step] || 1;
  };

  const handleNext = () => {
    setError(null);
    const stepOrder: TailorStep[] = [
      "select-resume",
      "job-description",
      "job-title",
      "job-level",
      "domain",
      "company-details",
      "recruiter-details",
      "additional-context",
      "review",
    ];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    setError(null);
    const stepOrder: TailorStep[] = [
      "select-resume",
      "job-description",
      "job-title",
      "job-level",
      "domain",
      "company-details",
      "recruiter-details",
      "additional-context",
      "review",
    ];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleStepClick = (stepNumber: number) => {
    const stepOrder: TailorStep[] = [
      "select-resume",
      "job-description",
      "job-title",
      "job-level",
      "domain",
      "company-details",
      "recruiter-details",
      "additional-context",
      "review",
    ];
    if (stepNumber >= 1 && stepNumber <= stepOrder.length) {
      setStep(stepOrder[stepNumber - 1]);
    }
  };

  const analyzeJobDescription = async (description: string) => {
    // Simple keyword extraction for AI suggestions
    const keywords = extractKeywords(description);
    const suggestions = {
      keywords: keywords.slice(0, 10),
      missingSkills: [],
      formatTips: ["Use action verbs", "Quantify achievements"],
      tone: "Professional",
    };
    setAiSuggestions(suggestions);
  };

  const extractKeywords = (text: string): string[] => {
    const commonTech = [
      "JavaScript",
      "TypeScript",
      "Python",
      "Java",
      "React",
      "Node.js",
      "AWS",
      "Docker",
      "Kubernetes",
      "PostgreSQL",
      "MongoDB",
      "SQL",
      "Machine Learning",
      "AI",
      "Agile",
      "Scrum",
    ];
    const textLower = text.toLowerCase();
    return commonTech.filter((tech) => textLower.includes(tech.toLowerCase()));
  };

  const handleGenerateCV = async () => {
    if (!selectedResume) return;

    setStep("generating");
    setError(null);

    try {
      // Step 1: Tailor the resume text
      const tailorResponse = await fetch("/api/resumes/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_id: selectedResume.id,
          resume_text: selectedResume.raw_text,
          structured_data: selectedResume.structured,
          job_description: formData.job_description,
          job_title: formData.job_title,
        }),
      });

      if (!tailorResponse.ok) {
        throw new Error("Failed to tailor resume");
      }

      const tailorData = await tailorResponse.json();
      setTailoredText(tailorData.tailored_resume);

      // Step 2: Generate CV files (PDF and DOCX)
      const cvResponse = await fetch("/api/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_id: selectedResume.id,
          tailored_text: tailorData.tailored_resume,
          structured_data: selectedResume.structured,
          raw_text: selectedResume.raw_text, // Pass raw text for contact info extraction
          template: formData.template || "modern",
          job_title: formData.job_title,
        }),
      });

      if (!cvResponse.ok) {
        throw new Error("Failed to generate CV");
      }

      const cvData = await cvResponse.json();

      // Step 3: Save job application
      const appResponse = await fetch("/api/job-applications/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          resume_id: selectedResume.id,
          job_title: formData.job_title,
          job_description: formData.job_description,
          job_level: formData.job_level,
          domain: formData.domain,
          company_name: formData.company_name,
          company_description: formData.company_description,
          recruiter_name: formData.recruiter_name,
          recruiter_email: formData.recruiter_email,
          additional_notes: formData.additional_notes,
          tailored_resume_text: tailorData.tailored_resume,
        }),
      });

      if (appResponse.ok) {
        const appData = await appResponse.json();
        setApplicationId(appData.application_id);
      }

      setGeneratedCvUrl({
        pdf: cvData.pdf_url,
        docx: cvData.docx_url,
      });
      setStep("success");
    } catch (err: any) {
      console.error("Generate CV error:", err);
      setError(err.message || "Failed to generate CV");
      setStep("review");
    }
  };

  const handleDownload = async (format: "pdf" | "docx") => {
    const url = format === "pdf" ? generatedCvUrl.pdf : generatedCvUrl.docx;
    if (!url) return;

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${formData.job_title || "resume"}-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download file");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="w-full border-b border-steel/20 sticky top-0 bg-background/95 backdrop-blur-md z-50 shadow-sm">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-lg">V</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-accent/70 bg-clip-text text-transparent">
              VeritasCV
            </h1>
          </Link>

          <Link
            href="/dashboard"
            className="px-4 py-2 text-steel-light hover:text-accent transition-colors text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-4xl font-bold mb-2">AI Resume Tailoring</h2>
          <p className="text-steel-light">Tailor your resume to match any job description</p>
        </div>

        {/* Progress Bar */}
        {step !== "select-resume" && step !== "generating" && step !== "success" && (
          <ProgressBar
            currentStep={getCurrentStepNumber()}
            totalSteps={TOTAL_STEPS}
            onStepClick={handleStepClick}
          />
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Step 1: Select Resume */}
        {step === "select-resume" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Select a Resume</h3>

            {resumes.length > 0 ? (
              <div className="space-y-4 mb-6">
                {resumes.map((resume) => (
                  <div
                    key={resume.id}
                    className="w-full p-4 bg-steel/10 rounded-xl border border-steel/20 hover:border-accent/50 hover:bg-steel/20 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">
                          {resume.name ||
                            `Resume from ${resume.parsed_at ? new Date(resume.parsed_at).toLocaleDateString() : "Recently uploaded"}`}
                        </p>
                        <p className="text-sm text-steel-light mt-1">
                          {resume.parsed_at
                            ? new Date(resume.parsed_at).toLocaleDateString()
                            : "Recently uploaded"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewResume(resume);
                          }}
                          className="p-2 hover:bg-steel/20 rounded-lg transition-colors"
                          title="Preview"
                        >
                          <svg
                            className="w-5 h-5 text-steel-light hover:text-accent"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedResume(resume);
                            handleNext();
                          }}
                          className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition-colors font-semibold"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-steel-light">
                <p className="mb-4">No resumes found</p>
              </div>
            )}

            <button
              onClick={() => setShowUploadModal(true)}
              className="w-full py-3 px-6 border-2 border-dashed border-accent/40 rounded-xl text-accent hover:border-accent/60 hover:bg-accent/5 transition-colors font-semibold"
            >
              + Upload New Resume
            </button>
          </div>
        )}

        {/* Step 2: Job Description */}
        {step === "job-description" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Job Description</h3>
            <p className="text-sm text-steel-light mb-4">
              Paste the complete job description including requirements, responsibilities, and
              qualifications
            </p>

            <textarea
              value={formData.job_description}
              onChange={(e) => {
                setFormData({ ...formData, job_description: e.target.value });
                if (e.target.value.length > 100) {
                  analyzeJobDescription(e.target.value);
                }
              }}
              placeholder="Paste the complete job description here..."
              className="w-full h-64 p-4 bg-background border border-steel/20 rounded-xl text-foreground placeholder-steel-light focus:outline-none focus:border-accent/50 resize-none"
            />
            <p className="text-xs text-steel-light mt-2">{formData.job_description.length} characters</p>

            {aiSuggestions && <AISuggestions suggestions={aiSuggestions} />}

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.job_description.trim()}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Job Title */}
        {step === "job-title" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Job Title</h3>
            <p className="text-sm text-steel-light mb-4">What position are you applying for?</p>

            <input
              type="text"
              value={formData.job_title}
              onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
              placeholder="e.g., Software Engineer, Product Manager"
              className="w-full p-4 bg-background border border-steel/20 rounded-xl text-foreground placeholder-steel-light focus:outline-none focus:border-accent/50"
            />

            {aiSuggestions && (
              <div className="mt-4 p-3 bg-accent/10 border border-accent/30 rounded-lg text-sm text-steel-light">
                💡 Based on the job description, we suggest:{" "}
                <span className="font-semibold text-accent">
                  {extractJobTitle(formData.job_description) || "Job Title"}
                </span>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.job_title.trim()}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Job Level */}
        {step === "job-level" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Job Level</h3>
            <p className="text-sm text-steel-light mb-4">Select the experience level required</p>

            <select
              value={formData.job_level}
              onChange={(e) => setFormData({ ...formData, job_level: e.target.value })}
              className="w-full p-4 bg-background border border-steel/20 rounded-xl text-foreground focus:outline-none focus:border-accent/50"
            >
              <option value="">Select job level...</option>
              <option value="internship">Internship</option>
              <option value="entry">Entry Level (0-2 years)</option>
              <option value="junior">Junior (1-3 years)</option>
              <option value="mid">Mid-Level (3-5 years)</option>
              <option value="senior">Senior (5-8 years)</option>
              <option value="lead">Lead/Principal (8+ years)</option>
              <option value="executive">Executive/C-Suite</option>
            </select>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.job_level}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Domain */}
        {step === "domain" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Domain/Industry</h3>
            <p className="text-sm text-steel-light mb-4">What industry or domain is this job in?</p>

            <select
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              className="w-full p-4 bg-background border border-steel/20 rounded-xl text-foreground focus:outline-none focus:border-accent/50"
            >
              <option value="">Select domain...</option>
              <option value="technology">Technology</option>
              <option value="design">Design</option>
              <option value="business">Business</option>
              <option value="finance">Finance</option>
              <option value="healthcare">Healthcare</option>
              <option value="education">Education</option>
              <option value="marketing">Marketing</option>
              <option value="sales">Sales</option>
              <option value="operations">Operations</option>
              <option value="other">Other</option>
            </select>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.domain}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Company Details */}
        {step === "company-details" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Company Details (Optional)</h3>
            <p className="text-sm text-steel-light mb-4">
              Adding company information helps personalize your resume
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="e.g., Google, Microsoft"
                  className="w-full p-4 bg-background border border-steel/20 rounded-xl text-foreground placeholder-steel-light focus:outline-none focus:border-accent/50"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Company Description
                </label>
                <textarea
                  value={formData.company_description}
                  onChange={(e) =>
                    setFormData({ ...formData, company_description: e.target.value })
                  }
                  placeholder="Brief description about the company..."
                  className="w-full h-32 p-4 bg-background border border-steel/20 rounded-xl text-foreground placeholder-steel-light focus:outline-none focus:border-accent/50 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Recruiter Details */}
        {step === "recruiter-details" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Recruiter Details (Optional)</h3>

            <RecruiterInfoBanner />

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Recruiter Name
                </label>
                <input
                  type="text"
                  value={formData.recruiter_name}
                  onChange={(e) => setFormData({ ...formData, recruiter_name: e.target.value })}
                  placeholder="e.g., John Smith"
                  className="w-full p-4 bg-background border border-steel/20 rounded-xl text-foreground placeholder-steel-light focus:outline-none focus:border-accent/50"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Recruiter Email
                </label>
                <input
                  type="email"
                  value={formData.recruiter_email}
                  onChange={(e) => setFormData({ ...formData, recruiter_email: e.target.value })}
                  placeholder="recruiter@company.com"
                  className="w-full p-4 bg-background border border-steel/20 rounded-xl text-foreground placeholder-steel-light focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 8: Additional Context */}
        {step === "additional-context" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Additional Context (Optional)</h3>
            <p className="text-sm text-steel-light mb-4">
              Any additional notes, requirements, or context that might help
            </p>

            <textarea
              value={formData.additional_notes}
              onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
              placeholder="Any other information that might help personalize your resume..."
              className="w-full h-48 p-4 bg-background border border-steel/20 rounded-xl text-foreground placeholder-steel-light focus:outline-none focus:border-accent/50 resize-none"
            />

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 9: Review */}
        {step === "review" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Review & Generate</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground">Job Information</h4>
                <div className="bg-background rounded-xl p-4 border border-steel/20 space-y-2 text-sm">
                  <p>
                    <span className="text-steel-light">Title:</span>{" "}
                    <span className="font-semibold">{formData.job_title}</span>
                  </p>
                  <p>
                    <span className="text-steel-light">Level:</span>{" "}
                    <span className="font-semibold capitalize">{formData.job_level}</span>
                  </p>
                  <p>
                    <span className="text-steel-light">Domain:</span>{" "}
                    <span className="font-semibold capitalize">{formData.domain}</span>
                  </p>
                  {formData.company_name && (
                    <p>
                      <span className="text-steel-light">Company:</span>{" "}
                      <span className="font-semibold">{formData.company_name}</span>
                    </p>
                  )}
                  {formData.recruiter_email && (
                    <p>
                      <span className="text-steel-light">Recruiter:</span>{" "}
                      <span className="font-semibold">{formData.recruiter_email}</span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-4">CV Template</h4>
                <select
                  value={formData.template}
                  onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  className="w-full p-4 bg-background border border-steel/20 rounded-xl text-foreground focus:outline-none focus:border-accent/50"
                >
                  <option value="modern">Modern</option>
                  <option value="classic">Classic</option>
                  <option value="creative">Creative</option>
                  <option value="ats-friendly">ATS-Friendly</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleGenerateCV}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors"
              >
                Generate Custom CV →
              </button>
            </div>
          </div>
        )}

        {/* Step 10: Generating */}
        {step === "generating" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-12 text-center">
            <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-2xl font-bold mb-2">Generating Your Custom CV...</h3>
            <p className="text-steel-light">This may take a few moments</p>
          </div>
        )}

        {/* Step 11: Success */}
        {step === "success" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2">CV Generated Successfully!</h3>
              <p className="text-steel-light">
                Your custom CV has been generated and saved to your applications
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <button
                onClick={() => handleDownload("docx")}
                className="w-full px-6 py-4 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download as DOCX (ATS-Friendly)
              </button>
              <p className="text-xs text-center text-steel-light">
                💡 <strong>Tip:</strong> Most ATS-friendly CVs are in DOCX format. Use this if
                allowed by the application system.
              </p>

              <button
                onClick={() => handleDownload("pdf")}
                className="w-full px-6 py-4 bg-steel/10 text-foreground rounded-xl font-semibold hover:bg-steel/20 transition-colors flex items-center justify-center gap-2 border border-steel/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Download as PDF
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep("select-resume");
                  setFormData({
                    job_title: "",
                    job_description: "",
                    job_level: "",
                    domain: "",
                    company_name: "",
                    company_description: "",
                    recruiter_name: "",
                    recruiter_email: "",
                    additional_notes: "",
                    template: "modern",
                  });
                  setSelectedResume(null);
                }}
                className="flex-1 px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                Apply to Another Job
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && user?.id && (
        <OnboardingModal userId={user.id} onComplete={() => setShowUploadModal(false)} />
      )}

      {/* Preview Modal */}
      {previewResume && (
        <ResumePreview resume={previewResume} onClose={() => setPreviewResume(null)} />
      )}
    </div>
  );
}

function extractJobTitle(description: string): string {
  // Simple extraction - in production, use AI
  const lines = description.split("\n").slice(0, 5);
  for (const line of lines) {
    if (line.match(/^(Senior|Junior|Lead|Principal|Staff)?\s*[A-Z][a-z]+/)) {
      return line.trim();
    }
  }
  return "";
}

