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
import { getCVStyle, type CVTemplate } from "@/lib/cv/styles";

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
  | "cv-name"
  | "job-description"
  | "job-title"
  | "company-details"
  | "recruiter-details"
  | "additional-context"
  | "review"
  | "generating"
  | "success";

interface JobApplicationData {
  cv_name?: string; // Custom name to appear on CV
  job_title: string;
  job_description: string;
  job_level?: string; // Optional - will be detected by AI
  domain?: string; // Optional - will be detected by AI
  company_name?: string;
  company_description?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  additional_notes?: string;
  template?: string;
}

const TOTAL_STEPS = 8;

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
  const [tailoredSections, setTailoredSections] = useState<any>(null); // Store structured sections for saving
  const [generatedCvUrl, setGeneratedCvUrl] = useState<{ pdf?: string; docx?: string }>({});
  const [applicationId, setApplicationId] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState<JobApplicationData>({
    cv_name: "", // Will be pre-filled from resume if available
    job_title: "",
    job_description: "",
    company_name: "",
    company_description: "",
    recruiter_name: "",
    recruiter_email: "",
    additional_notes: "",
    template: "modern",
  });

  const fetchResumes = async (userId: string) => {
    try {
      const response = await fetch(`/api/resumes/list?user_id=${userId}`);
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
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.push("/login");
        return;
      }

      setUser(session.user);

      if (session.user.id) {
        await fetchResumes(session.user.id);
      }

      setLoading(false);
    };

    checkSession();
  }, [router]);

  const getCurrentStepNumber = (): number => {
    const stepMap: Record<TailorStep, number> = {
      "select-resume": 1,
      "cv-name": 2,
      "job-description": 3,
      "job-title": 4,
      "company-details": 5,
      "recruiter-details": 6,
      "additional-context": 7,
      "review": 8,
      "generating": 8,
      "success": 8,
    };
    return stepMap[step] || 1;
  };

  const handleNext = () => {
    setError(null);
    const stepOrder: TailorStep[] = [
      "select-resume",
      "cv-name",
      "job-description",
      "job-title",
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
      "cv-name",
      "job-description",
      "job-title",
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
      "cv-name",
      "job-description",
      "job-title",
      "company-details",
      "recruiter-details",
      "additional-context",
      "review",
    ];
    if (stepNumber >= 1 && stepNumber <= stepOrder.length) {
      setStep(stepOrder[stepNumber - 1]);
    }
  };

  // Extract name from resume (from raw text or structured data)
  const extractNameFromResume = (resume: Resume): string => {
    // Try structured data first
    if (resume.structured?.contact?.name) {
      return resume.structured.contact.name;
    }
    if (resume.structured?.name) {
      return resume.structured.name;
    }
    
    // Try extracting from raw text (first line usually contains name)
    if (resume.raw_text) {
      const lines = resume.raw_text.split("\n").filter(line => line.trim());
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        // Check if first line looks like a name (2-4 words, no special chars except spaces/hyphens)
        if (firstLine.match(/^[A-Za-z\s\-]{2,50}$/) && firstLine.split(/\s+/).length <= 4) {
          return firstLine;
        }
      }
    }
    
    return "";
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
      // Step 1: Tailor the resume using focused prompts (uses raw_text as primary source)
      const tailorResponse = await fetch("/api/resumes/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_id: selectedResume.id,
          raw_text: selectedResume.raw_text, // Primary source - complete raw text
          structured_data: selectedResume.structured, // Optional fallback
          job_description: formData.job_description,
          job_title: formData.job_title,
          // job_level and domain are optional - will be detected by AI
          company_name: formData.company_name,
          company_description: formData.company_description,
          additional_context: formData.additional_notes,
          template: formData.template || "modern", // Pass template for style
        }),
      });

      if (!tailorResponse.ok) {
        throw new Error("Failed to tailor resume");
      }

      const tailorData = await tailorResponse.json();
      
      // Store both structured sections and text format
      setTailoredText(tailorData.tailored_resume);
      setTailoredSections(tailorData.tailored_sections); // Store structured data for saving
      
      // Use detected job level and domain from API (or fallback to defaults)
      const detectedJobLevel = tailorData.detected_job_level || "mid";
      const detectedDomain = tailorData.detected_domain || "general";
      
      // Update formData with detected values for review page
      setFormData(prev => ({
        ...prev,
        job_level: detectedJobLevel,
        domain: detectedDomain,
      }));
      
      // Step 2: Generate CV files (PDF and DOCX) using structured sections
      const cvResponse = await fetch("/api/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_id: selectedResume.id,
          tailored_sections: tailorData.tailored_sections, // NEW: Structured sections from focused prompts
          tailored_text: tailorData.tailored_resume, // Fallback: JSON string
          structured_data: tailorData.tailored_sections || selectedResume.structured, // Use tailored sections
          raw_text: selectedResume.raw_text, // Pass raw text for contact info extraction
          template: formData.template || "modern",
          job_title: formData.job_title,
          job_level: detectedJobLevel, // Use detected value
          domain: detectedDomain, // Use detected value
          job_description: formData.job_description, // For keyword extraction
          cv_name: formData.cv_name, // Custom name for CV
          user_id: user.id, // Pass user_id for quota checking
        }),
      });

      if (!cvResponse.ok) {
        const errorData = await cvResponse.json();
        // Handle quota limit error
        if (cvResponse.status === 429) {
          throw new Error(
            errorData.message || 
            `Daily limit reached! You've used ${errorData.dailyLimit || 10} CV generations today. Try again tomorrow.`
          );
        }
        throw new Error(errorData.error || errorData.message || "Failed to generate CV");
      }

      const cvData = await cvResponse.json();

      // Store tailored text for saving later
      setTailoredText(tailorData.tailored_resume);

      setGeneratedCvUrl({
        pdf: cvData.pdf_url,
        docx: cvData.docx_url,
      });
      
      // Step 3: Save job application with tailored data
      try {
        const appResponse = await fetch("/api/job-applications/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            resume_id: selectedResume.id,
            job_title: formData.job_title,
            job_description: formData.job_description,
            job_level: detectedJobLevel,
            domain: detectedDomain,
            company_name: formData.company_name,
            company_description: formData.company_description,
            recruiter_name: formData.recruiter_name,
            recruiter_email: formData.recruiter_email,
            additional_notes: formData.additional_notes,
            tailored_resume_text: tailorData.tailored_resume,
            tailored_sections: tailorData.tailored_sections || tailoredSections, // Store structured data for regeneration
            template: formData.template || "modern",
            cv_name: formData.cv_name,
          }),
        });

        if (appResponse.ok) {
          const appData = await appResponse.json();
          setApplicationId(appData.application_id);
          console.log(`[CV Generation] Job application saved: ${appData.application_id}`);
        }
      } catch (err: any) {
        console.error("Failed to save job application:", err);
        // Don't fail the whole flow if saving fails
      }
      
      setStep("success");
    } catch (err: any) {
      console.error("Generate CV error:", err);
      setError(err.message || "Failed to generate CV");
      setStep("review");
    }
  };

  const handleDownload = async (format: "pdf" | "docx" | "docx-as-pdf") => {
    if (format === "docx-as-pdf") {
      // Download the DOCX file and let browser handle it
      // Note: Most modern browsers can open DOCX files, and users can save as PDF from there
      // Or we can use the existing PDF URL which should match
      if (!generatedCvUrl.docx) {
        setError("DOCX file not available");
        return;
      }

      try {
        setError(null);
        // Simply download the DOCX file - user can convert it using their preferred method
        // Or use the PDF that was generated alongside it (should match)
        const url = generatedCvUrl.pdf || generatedCvUrl.docx;
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        // If PDF exists, download as PDF, otherwise download DOCX
        const fileExtension = generatedCvUrl.pdf ? "pdf" : "docx";
        a.download = `${formData.job_title || "resume"}-${Date.now()}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        
        if (!generatedCvUrl.pdf) {
          setError("PDF not available. DOCX downloaded - you can convert it to PDF using Microsoft Word or an online converter.");
        }
      } catch (err: any) {
        console.error("Download error:", err);
        setError(err.message || "Failed to download file");
      }
      return;
    }

    // Regular download for PDF or DOCX
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

  const handleSaveApplication = async () => {
    if (!selectedResume || !tailoredText) {
      setError("Missing resume or tailored text");
      return;
    }

    try {
      const appResponse = await fetch("/api/job-applications/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          resume_id: selectedResume.id,
          job_title: formData.job_title,
          job_description: formData.job_description,
          job_level: formData.job_level || "mid", // Use detected value if available
          domain: formData.domain || "general", // Use detected value if available
          company_name: formData.company_name,
          company_description: formData.company_description,
          recruiter_name: formData.recruiter_name,
          recruiter_email: formData.recruiter_email,
          additional_notes: formData.additional_notes,
          tailored_resume_text: tailoredText,
          tailored_sections: tailoredSections, // Store structured data for regeneration
          template: formData.template || "modern",
          cv_name: formData.cv_name,
        }),
      });

      if (!appResponse.ok) {
        const errorData = await appResponse.json();
        throw new Error(errorData.error || "Failed to save application");
      }

      const appData = await appResponse.json();
      setApplicationId(appData.application_id);
      
      // Show success message
      alert("Application saved successfully! You can track it in your applications.");
    } catch (err: any) {
      console.error("Save application error:", err);
      setError(err.message || "Failed to save application");
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
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete "${resume.name || 'this resume'}"? This action cannot be undone.`)) {
                              try {
                                const response = await fetch("/api/resumes/delete", {
                                  method: "DELETE",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    resume_id: resume.id,
                                    user_id: user?.id,
                                  }),
                                });

                                if (response.ok) {
                                  // Refresh the resume list
                                  if (user?.id) {
                                    await fetchResumes(user.id);
                                  }
                                  // If the deleted resume was selected, clear selection
                                  if (selectedResume?.id === resume.id) {
                                    setSelectedResume(null);
                                  }
                                } else {
                                  const errorData = await response.json();
                                  alert(`Failed to delete resume: ${errorData.error || "Unknown error"}`);
                                }
                              } catch (err: any) {
                                console.error("Delete resume error:", err);
                                alert(`Failed to delete resume: ${err.message || "Unknown error"}`);
                              }
                            }
                          }}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg
                            className="w-5 h-5 text-steel-light hover:text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedResume(resume);
                            // Extract name from resume if available
                            const extractedName = extractNameFromResume(resume);
                            if (extractedName && !formData.cv_name) {
                              setFormData(prev => ({ ...prev, cv_name: extractedName }));
                            }
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

        {/* Step 2: CV Name */}
        {step === "cv-name" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Your Name on CV</h3>
            <p className="text-sm text-steel-light mb-4">
              Enter the name you want to appear at the top of your CV. This will be displayed prominently on your resume.
            </p>

            <input
              type="text"
              value={formData.cv_name}
              onChange={(e) => {
                setFormData({ ...formData, cv_name: e.target.value });
              }}
              placeholder="e.g., John Doe, Jane Smith"
              className="w-full p-4 bg-background border border-steel/20 rounded-xl text-foreground placeholder-steel-light focus:outline-none focus:border-accent/50"
              required
            />
            <p className="text-xs text-steel-light mt-2">
              {formData.cv_name ? `${formData.cv_name.length} characters` : "This name will appear at the top of your CV"}
            </p>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.cv_name || formData.cv_name.trim().length === 0}
                className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Job Description */}
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

        {/* Step 4: Company Details */}
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

        {/* Step 5: Recruiter Details */}
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

        {/* Step 6: Additional Context */}
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

        {/* Step 7: Review */}
        {step === "review" && (
          <div className="bg-steel/5 rounded-2xl border border-steel/20 p-8">
            <h3 className="text-2xl font-bold mb-6">Review & Generate</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground">CV Information</h4>
                <div className="bg-background rounded-xl p-4 border border-steel/20 space-y-2 text-sm">
                  {formData.cv_name && (
                    <p>
                      <span className="text-steel-light">Name on CV:</span>{" "}
                      <span className="font-semibold">{formData.cv_name}</span>
                    </p>
                  )}
                </div>
                <h4 className="font-semibold text-foreground">Job Information</h4>
                <div className="bg-background rounded-xl p-4 border border-steel/20 space-y-2 text-sm">
                  <p>
                    <span className="text-steel-light">Title:</span>{" "}
                    <span className="font-semibold">{formData.job_title}</span>
                  </p>
                  {formData.job_level && (
                    <p>
                      <span className="text-steel-light">Level:</span>{" "}
                      <span className="font-semibold capitalize">{formData.job_level}</span>
                      <span className="text-xs text-steel-light ml-2">(AI-detected)</span>
                    </p>
                  )}
                  {formData.domain && (
                    <p>
                      <span className="text-steel-light">Domain:</span>{" "}
                      <span className="font-semibold capitalize">{formData.domain}</span>
                      <span className="text-xs text-steel-light ml-2">(AI-detected)</span>
                    </p>
                  )}
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
                  <option value="professional">Professional</option>
                  <option value="minimalist">Minimalist</option>
                  <option value="executive">Executive</option>
                  <option value="ats-friendly">ATS-Friendly</option>
                </select>
                
                {/* Style Details Display */}
                {formData.template && (
                  <TemplateStyleDetails template={formData.template as CVTemplate} />
                )}
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
                {applicationId
                  ? "Your custom CV has been generated and saved to your applications"
                  : "Your custom CV has been generated. Download it and save to track your application."}
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

              {/* <button
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
              </button> */}

              <button
                onClick={() => handleDownload("docx-as-pdf")}
                className="w-full px-6 py-4 bg-primary/10 text-foreground rounded-xl font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 border border-primary/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Download PDF (Same as DOCX)
              </button>
              <p className="text-xs text-center text-steel-light">
                💡 <strong>Note:</strong> Downloads the PDF version that matches the DOCX content. Use this if the regular PDF download shows a different format.
              </p>
            </div>

            {/* Save Application Button */}
            {!applicationId && (
              <div className="mb-6">
                <button
                  onClick={handleSaveApplication}
                  className="w-full px-6 py-4 bg-gradient-to-r from-accent to-accent/80 text-background rounded-xl font-semibold hover:from-accent/90 hover:to-accent/70 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  Save Application to Track
                </button>
                <p className="text-xs text-center text-steel-light mt-2">
                  Save this application to track your job applications and follow up with recruiters
                </p>
              </div>
            )}

            {/* Cover Letter CTA */}
            {applicationId && (
              <div className="mb-6 p-6 bg-gradient-to-br from-accent/10 via-accent/5 to-accent/10 rounded-2xl border-2 border-accent/30">
                <div className="text-center">
                  <h4 className="text-xl font-bold text-foreground mb-2">
                    Complete Your Application
                  </h4>
                  <p className="text-steel-light mb-4">
                    Stand out with a personalized cover letter tailored to this role
                  </p>
                  <button
                    onClick={() => router.push(`/dashboard/cover-letter/${applicationId}`)}
                    className="w-full px-6 py-4 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Draft a Cover Letter
                  </button>
                </div>
              </div>
            )}

            {applicationId && (
              <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-xl">
                <div className="flex items-center gap-2 text-accent">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-semibold">Application saved successfully!</span>
                </div>
              </div>
            )}

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

/**
 * Component to display template style details
 */
function TemplateStyleDetails({ template }: { template: CVTemplate }) {
  const style = getCVStyle(template);
  
  const templateDescriptions: Record<CVTemplate, { name: string; description: string; bestFor: string }> = {
    modern: {
      name: "Modern",
      description: "Clean, contemporary design with balanced spacing",
      bestFor: "Tech roles, startups, modern companies"
    },
    classic: {
      name: "Classic",
      description: "Traditional, formal design with conservative styling",
      bestFor: "Finance, law, academia, traditional industries"
    },
    creative: {
      name: "Creative",
      description: "Bold, spacious design emphasizing achievements",
      bestFor: "Design, marketing, creative roles"
    },
    professional: {
      name: "Professional",
      description: "Polished, corporate design with balanced hierarchy",
      bestFor: "Corporate roles, mid-to-senior positions"
    },
    minimalist: {
      name: "Minimalist",
      description: "Clean, minimal design optimized for space",
      bestFor: "Tech roles, startups, when space is limited"
    },
    executive: {
      name: "Executive",
      description: "Authoritative, formal design for senior roles",
      bestFor: "C-level, senior executive, board positions"
    },
    "ats-friendly": {
      name: "ATS-Friendly",
      description: "Minimal, keyword-optimized design for ATS systems",
      bestFor: "Online applications, ATS systems"
    }
  };
  
  const templateInfo = templateDescriptions[template];
  const headerStyleMap: Record<string, string> = {
    "bold": "Bold",
    "underline": "Underlined",
    "bold-underline": "Bold + Underline",
    "border": "Bordered"
  };
  
  const bulletStyleMap: Record<string, string> = {
    "dot": "• (Dot)",
    "dash": "— (Dash)",
    "arrow": "→ (Arrow)",
    "none": "None"
  };
  
  return (
    <div className="mt-4 p-4 bg-steel/5 border border-steel/20 rounded-xl">
      <div className="mb-3">
        <h5 className="font-semibold text-foreground mb-1">{templateInfo.name}</h5>
        <p className="text-sm text-steel-light">{templateInfo.description}</p>
        <p className="text-xs text-steel-light mt-1">
          <span className="font-medium">Best for:</span> {templateInfo.bestFor}
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div>
          <span className="text-steel-light">Font:</span>
          <span className="ml-2 font-medium text-foreground">
            {style.fonts.docxBody || style.fonts.body}
          </span>
        </div>
        <div>
          <span className="text-steel-light">Header Style:</span>
          <span className="ml-2 font-medium text-foreground">
            {headerStyleMap[style.layout.headerStyle] || style.layout.headerStyle}
          </span>
        </div>
        <div>
          <span className="text-steel-light">Bullet Style:</span>
          <span className="ml-2 font-medium text-foreground">
            {bulletStyleMap[style.layout.bulletStyle] || style.layout.bulletStyle}
          </span>
        </div>
        <div>
          <span className="text-steel-light">Line Height:</span>
          <span className="ml-2 font-medium text-foreground">
            {style.spacing.lineHeight.toFixed(2)}x
          </span>
        </div>
        <div>
          <span className="text-steel-light">Formality:</span>
          <span className="ml-2 font-medium text-foreground capitalize">
            {style.tone.formality}
          </span>
        </div>
        <div>
          <span className="text-steel-light">Emphasis:</span>
          <span className="ml-2 font-medium text-foreground capitalize">
            {style.tone.emphasis}
          </span>
        </div>
      </div>
      
      {style.atsOptimized && (
        <div className="mt-3 pt-3 border-t border-steel/20">
          <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">
            ✓ ATS Optimized
          </span>
        </div>
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

