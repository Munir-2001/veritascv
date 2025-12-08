"use client";

import { useState, useRef, useEffect } from "react";

interface OnboardingModalProps {
  userId: string;
  onComplete: () => void;
}

interface ParsedResume {
  raw_text: string;
  structured: {
    experience?: Array<{
      title: string;
      company: string;
      duration: string;
      description: string;
    }>;
    skills?: string[];
    education?: Array<{
      degree: string;
      institution: string;
      year: string;
    }>;
    projects?: Array<{
      name: string;
      description: string;
      technologies: string[];
    }>;
    certifications?: Array<{
      name: string;
      issuer: string;
      year: string;
    }>;
  };
}

export default function OnboardingModal({ userId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<"upload" | "review" | "processing" | "payment">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user has premium access when modal opens - if so, skip payment step entirely
  useEffect(() => {
    const checkPremiumStatus = async () => {
      try {
        const response = await fetch(`/api/profiles/get?user_id=${userId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.profile?.subscription_tier === "premium") {
            console.log("✅ OnboardingModal: User has premium, will skip payment step");
          }
        }
      } catch (error) {
        console.error("Error checking premium status:", error);
      }
    };
    
    if (userId) {
      checkPremiumStatus();
    }
  }, [userId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
      ];
      
      if (!validTypes.includes(selectedFile.type)) {
        setError("Please upload a PDF, DOCX, or TXT file");
        return;
      }
      
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setStep("processing");

    try {
      // Step 1: Upload file to Supabase Storage using secure API
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("user_id", userId);

      const uploadResponse = await fetch("/api/resumes/upload", {
        method: "POST",
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json();
        throw new Error(uploadError.error || "Failed to upload file");
      }

      const uploadData = await uploadResponse.json();
      const apiFilePath = uploadData.file_path;
      const originalFilename = uploadData.original_filename;

      // Step 2: Call API to parse the resume
      const response = await fetch("/api/resumes/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_path: apiFilePath, // API needs full path: "resumes/{userId}/{file}"
          user_id: userId,
          original_filename: originalFilename, // Pass original filename for resume name
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to parse resume");
      }

      const data = await response.json();
      setParsedData(data);
      setStep("review");
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload and parse resume");
      setStep("upload");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedData) return;

    setUploading(true);
    setError(null);
    try {
      // The resume is already saved by the API route
      // Just update the profile to mark resume as uploaded
      // CRITICAL: Preserve subscription fields when updating!
      // First, fetch current profile to preserve subscription fields
      const profileResponse = await fetch(`/api/profiles/get?user_id=${userId}`);
      let currentProfile = null;
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        currentProfile = profileData.profile;
      }

      const updateData: any = {
        has_uploaded_resume: true,
      };

      // Preserve subscription-related fields if they exist
      if (currentProfile) {
        if (currentProfile.subscription_tier) {
          updateData.subscription_tier = currentProfile.subscription_tier;
        }
        if (currentProfile.cv_generations_remaining !== undefined) {
          updateData.cv_generations_remaining = currentProfile.cv_generations_remaining;
        }
        if (currentProfile.unlimited_access !== undefined) {
          updateData.unlimited_access = currentProfile.unlimited_access;
        }
        if (currentProfile.subscription_id) {
          updateData.subscription_id = currentProfile.subscription_id;
        }
        if (currentProfile.user_status) {
          updateData.user_status = currentProfile.user_status;
        }
        if (currentProfile.onboarding_completed !== undefined) {
          updateData.onboarding_completed = currentProfile.onboarding_completed;
        }
      } else {
        // Profile doesn't exist, create it with default values
        updateData.onboarding_completed = false;
        updateData.user_status = "new";
      }

      // Update profile using secure API
      const updateResponse = await fetch("/api/profiles/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          ...updateData,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        // If profile doesn't exist, try to create it
        if (errorData.error?.includes("not found") || errorData.error?.includes("No rows")) {
          const createResponse = await fetch("/api/profiles/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: userId,
              has_uploaded_resume: true,
              onboarding_completed: false,
              user_status: "new",
            }),
          });
          
          if (!createResponse.ok) {
            const createError = await createResponse.json();
            throw new Error(createError.error || "Failed to create profile");
          }
        } else {
          throw new Error(errorData.error || "Failed to update profile");
        }
      }

      const updateResult = await updateResponse.json();
      const profileData = updateResult.profile || currentProfile;

      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if user already has premium access - if so, skip payment and complete onboarding
      // Use currentProfile (already fetched) or profileData (just updated) to check subscription status
      const subscriptionTier = currentProfile?.subscription_tier || profileData?.subscription_tier;
      
      if (subscriptionTier === "premium") {
        // User already has premium - complete onboarding without payment step
        console.log("✅ User has premium access, skipping payment step");
        setUploading(false);
        // Mark onboarding as complete and close modal using secure API
        await fetch("/api/profiles/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            onboarding_completed: true,
          }),
        });
        onComplete();
      } else {
        // Move to payment step only if user doesn't have premium
        console.log("ℹ️ User does not have premium, showing payment step");
        setStep("payment");
        setUploading(false);
      }
    } catch (err: any) {
      console.error("Confirm error:", err);
      setError(err.message || "Failed to save resume. Please try again.");
      setUploading(false);
    }
  };

  const handlePayment = async () => {
    if (!userId) return;

    setCheckoutLoading(true);
    setError(null);

    try {
      // Create checkout session
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          // Will use EARLY_ADOPTER price from env if not provided
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err.message || "Failed to start checkout. Please try again.");
      setCheckoutLoading(false);
    }
  };

  const handleSkipPayment = () => {
    // Allow user to skip payment for now
    onComplete();
  };

  const handleSkip = () => {
    // Allow user to skip CV upload for now
    onComplete();
  };

  const handleClose = () => {
    onComplete();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-accent/30 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-lg bg-steel/20 hover:bg-steel/30 transition-colors text-foreground hover:text-accent z-50 cursor-pointer"
          aria-label="Close modal"
          type="button"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              {step === "upload" && "Welcome to VeritasCV!"}
              {step === "processing" && "Processing Your Resume..."}
              {step === "review" && "Review Your Resume"}
              {step === "payment" && "Complete Your Setup"}
            </h2>
            <p className="text-steel-light">
              {step === "upload" && "Let's start by uploading your CV to build your profile"}
              {step === "processing" && "We're extracting information from your resume"}
              {step === "review" && "Please review the extracted information"}
              {step === "payment" && "Get unlimited CV generations with our Early Adopter Pack"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Upload Step */}
          {step === "upload" && (
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-accent/40 rounded-xl p-12 text-center cursor-pointer hover:border-accent/60 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-lg font-semibold text-foreground mb-2">
                  {file ? file.name : "Click to upload your CV"}
                </p>
                <p className="text-sm text-steel-light">
                  Supports PDF, DOCX, and TXT files (max 10MB)
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-3 px-6 border border-steel/30 rounded-lg text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="flex-1 py-3 px-6 bg-accent text-background rounded-lg font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload & Parse
                </button>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {step === "processing" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-steel-light">Extracting information from your resume...</p>
            </div>
          )}

          {/* Review Step */}
          {step === "review" && parsedData && (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Raw Text Preview */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Extracted Text</h3>
                <div className="bg-steel/10 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <p className="text-sm text-steel-light whitespace-pre-wrap">
                    {parsedData.raw_text.substring(0, 500)}
                    {parsedData.raw_text.length > 500 && "..."}
                  </p>
                </div>
              </div>

              {/* Structured Data */}
              <div className="space-y-4">
                {parsedData.structured.experience && parsedData.structured.experience.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Experience ({parsedData.structured.experience.length})
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {parsedData.structured.experience.map((exp, idx) => (
                        <div key={idx} className="bg-steel/10 rounded-lg p-3">
                          <p className="font-semibold text-foreground">{exp.title}</p>
                          <p className="text-sm text-steel-light">{exp.company} • {exp.duration}</p>
                          {exp.description && (
                            <p className="text-xs text-steel-light mt-1 line-clamp-2">{exp.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedData.structured.skills && parsedData.structured.skills.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Skills ({parsedData.structured.skills.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {parsedData.structured.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {parsedData.structured.education && parsedData.structured.education.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Education ({parsedData.structured.education.length})
                    </h3>
                    <div className="space-y-2">
                      {parsedData.structured.education.map((edu, idx) => (
                        <div key={idx} className="bg-steel/10 rounded-lg p-3">
                          <p className="font-semibold text-foreground">{edu.degree}</p>
                          <p className="text-sm text-steel-light">{edu.institution} • {edu.year}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedData.structured.projects && parsedData.structured.projects.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Projects ({parsedData.structured.projects.length})
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {parsedData.structured.projects.map((project, idx) => (
                        <div key={idx} className="bg-steel/10 rounded-lg p-3">
                          <p className="font-semibold text-foreground">{project.name}</p>
                          <p className="text-sm text-steel-light line-clamp-2">{project.description}</p>
                          {project.technologies && project.technologies.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {project.technologies.map((tech, techIdx) => (
                                <span key={techIdx} className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsedData.structured.certifications && parsedData.structured.certifications.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Certifications ({parsedData.structured.certifications.length})
                    </h3>
                    <div className="space-y-2">
                      {parsedData.structured.certifications.map((cert, idx) => (
                        <div key={idx} className="bg-steel/10 rounded-lg p-3">
                          <p className="font-semibold text-foreground">{cert.name}</p>
                          <p className="text-sm text-steel-light">{cert.issuer} • {cert.year}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setStep("upload")}
                  className="flex-1 py-3 px-6 border border-steel/30 rounded-lg text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
                >
                  Upload Different File
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={uploading}
                  className="flex-1 py-3 px-6 bg-accent text-background rounded-lg font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "Saving..." : "Confirm & Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Payment Step */}
          {step === "payment" && (
            <div className="space-y-6">
              <div className="p-6 bg-gradient-to-br from-accent/10 via-accent/5 to-accent/10 rounded-xl border-2 border-accent/30">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-1">
                      Early Adopter Pack
                    </h3>
                    <p className="text-steel-light">One-time payment</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-accent">€20</div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-steel-light">Unlimited CV generations</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-steel-light">Premium features unlocked</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-steel-light">Early adopter exclusive pricing</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleSkipPayment}
                    className="flex-1 py-3 px-6 border border-steel/30 rounded-lg text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={checkoutLoading}
                    className="flex-1 py-3 px-6 bg-accent text-background rounded-lg font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkoutLoading ? "Loading..." : "Get Early Adopter Pack - €20"}
                  </button>
                </div>

                <p className="mt-4 text-xs text-steel-light text-center">
                  Secure payment powered by Stripe
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

