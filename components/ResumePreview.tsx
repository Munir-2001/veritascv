"use client";

import { useState, useEffect } from "react";

interface Resume {
  id: string;
  name?: string;
  file_path: string;
  raw_text: string;
  structured: any;
  parsed_at: string;
}

interface ResumePreviewProps {
  resume: Resume;
  onClose: () => void;
}

export default function ResumePreview({ resume, onClose }: ResumePreviewProps) {
  const [activeTab, setActiveTab] = useState<"file" | "raw" | "structured">("file");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const structured = resume.structured || {};
  const fileExt = resume.file_path.split(".").pop()?.toLowerCase();
  const isPdf = fileExt === "pdf";

  // Fetch preview URL on mount
  useEffect(() => {
    const fetchPreviewUrl = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/resumes/preview?resume_id=${resume.id}`);
        if (!response.ok) {
          throw new Error("Failed to get preview URL");
        }
        const data = await response.json();
        setPreviewUrl(data.signed_url || data.public_url);
      } catch (err: any) {
        console.error("Preview URL error:", err);
        setError(err.message || "Failed to load preview");
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [resume.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-steel/20 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-steel/20">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {resume.name || "Resume Preview"}
            </h2>
            <p className="text-sm text-steel-light mt-1">
              {resume.parsed_at ? new Date(resume.parsed_at).toLocaleDateString() : "Recently uploaded"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-steel/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-steel-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-steel/20">
          <button
            onClick={() => setActiveTab("file")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "file"
                ? "text-accent border-b-2 border-accent"
                : "text-steel-light hover:text-foreground"
            }`}
          >
            File Preview
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "raw"
                ? "text-accent border-b-2 border-accent"
                : "text-steel-light hover:text-foreground"
            }`}
          >
            Raw Text
          </button>
          <button
            onClick={() => setActiveTab("structured")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "structured"
                ? "text-accent border-b-2 border-accent"
                : "text-steel-light hover:text-foreground"
            }`}
          >
            Structured Data
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "file" ? (
            <div className="bg-steel/5 rounded-xl p-6 border border-steel/20 min-h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-96 text-center">
                  <p className="text-red-400 mb-4">{error}</p>
                  <a
                    href={previewUrl || "#"}
                    download
                    className="px-4 py-2 bg-accent text-background rounded-lg hover:bg-accent/90 transition-colors"
                  >
                    Download File
                  </a>
                </div>
              ) : previewUrl ? (
                <div className="w-full h-full">
                  {isPdf ? (
                    <iframe
                      src={previewUrl}
                      className="w-full h-[600px] rounded-lg border border-steel/20"
                      title="Resume Preview"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-center">
                      <p className="text-steel-light mb-4">
                        Preview not available for {fileExt?.toUpperCase()} files
                      </p>
                      <a
                        href={previewUrl}
                        download
                        className="px-6 py-3 bg-accent text-background rounded-lg hover:bg-accent/90 transition-colors font-semibold"
                      >
                        Download {fileExt?.toUpperCase()} File
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-steel-light">
                  No preview available
                </div>
              )}
            </div>
          ) : activeTab === "raw" ? (
            <div className="bg-steel/5 rounded-xl p-6 border border-steel/20">
              <pre className="whitespace-pre-wrap text-foreground text-sm font-mono leading-relaxed">
                {resume.raw_text || "No raw text available"}
              </pre>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Experience */}
              {structured.experience && structured.experience.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-4">Experience</h3>
                  <div className="space-y-4">
                    {structured.experience.map((exp: any, idx: number) => (
                      <div key={idx} className="bg-steel/5 rounded-xl p-4 border border-steel/20">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-foreground">
                              {exp.title || exp.job_title || "Position"}
                            </p>
                            <p className="text-sm text-steel-light">
                              {exp.company || "Company"}
                            </p>
                          </div>
                          {exp.duration && (
                            <span className="text-xs text-steel-light bg-steel/10 px-2 py-1 rounded">
                              {exp.duration}
                            </span>
                          )}
                        </div>
                        {exp.description && (
                          <p className="text-sm text-foreground mt-2">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {structured.skills && structured.skills.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-4">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {structured.skills.map((skill: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-accent/20 text-accent rounded-lg text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {structured.education && structured.education.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-4">Education</h3>
                  <div className="space-y-3">
                    {structured.education.map((edu: any, idx: number) => (
                      <div key={idx} className="bg-steel/5 rounded-xl p-4 border border-steel/20">
                        <p className="font-semibold text-foreground">
                          {edu.degree || "Degree"}
                        </p>
                        <p className="text-sm text-steel-light">
                          {edu.institution || "Institution"}
                          {edu.year && ` • ${edu.year}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {structured.projects && structured.projects.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-4">Projects</h3>
                  <div className="space-y-4">
                    {structured.projects.map((project: any, idx: number) => (
                      <div key={idx} className="bg-steel/5 rounded-xl p-4 border border-steel/20">
                        <p className="font-semibold text-foreground mb-2">
                          {project.name || `Project ${idx + 1}`}
                        </p>
                        {project.description && (
                          <p className="text-sm text-foreground mb-2">{project.description}</p>
                        )}
                        {project.technologies && project.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {project.technologies.map((tech: string, techIdx: number) => (
                              <span
                                key={techIdx}
                                className="px-2 py-1 bg-steel/20 text-steel-light rounded text-xs"
                              >
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

              {/* Certifications */}
              {structured.certifications && structured.certifications.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-4">Certifications</h3>
                  <div className="space-y-3">
                    {structured.certifications.map((cert: any, idx: number) => (
                      <div key={idx} className="bg-steel/5 rounded-xl p-4 border border-steel/20">
                        <p className="font-semibold text-foreground">
                          {cert.name || `Certification ${idx + 1}`}
                        </p>
                        <p className="text-sm text-steel-light">
                          {cert.issuer || "Issuer"}
                          {cert.year && ` • ${cert.year}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {(!structured.experience || structured.experience.length === 0) &&
                (!structured.skills || structured.skills.length === 0) &&
                (!structured.education || structured.education.length === 0) &&
                (!structured.projects || structured.projects.length === 0) &&
                (!structured.certifications || structured.certifications.length === 0) && (
                  <div className="text-center py-12 text-steel-light">
                    <p>No structured data available</p>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4 p-6 border-t border-steel/20">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-steel/30 rounded-xl text-steel-light hover:border-accent/50 hover:text-accent transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

