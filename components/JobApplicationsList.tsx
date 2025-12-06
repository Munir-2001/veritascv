"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface JobApplication {
  id: string;
  job_title: string;
  company_name?: string;
  job_level?: string;
  domain?: string;
  status: string;
  created_at: string;
  applied_at?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  resumes?: {
    id: string;
    name?: string;
  };
}

interface JobApplicationsListProps {
  userId: string;
}

export default function JobApplicationsList({ userId }: JobApplicationsListProps) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await fetch(`/api/job-applications/list?user_id=${userId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch job applications");
        }
        const data = await response.json();
        setApplications(data.applications || []);
      } catch (err: any) {
        console.error("Error fetching applications:", err);
        setError(err.message || "Failed to load job applications");
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchApplications();
    }
  }, [userId]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "applied":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "interview":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "accepted":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "rejected":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-steel/20 text-steel-light border-steel/30";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="bg-steel/5 rounded-3xl border border-steel/20 p-8 backdrop-blur-sm">
        <h3 className="text-2xl font-bold mb-6">Job Applications</h3>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-steel/5 rounded-3xl border border-steel/20 p-8 backdrop-blur-sm">
        <h3 className="text-2xl font-bold mb-6">Job Applications</h3>
        <div className="text-center py-8 text-red-300">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="bg-steel/5 rounded-3xl border border-steel/20 p-8 backdrop-blur-sm">
        <h3 className="text-2xl font-bold mb-6">Job Applications</h3>
        <div className="text-center py-12 text-steel-light">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg">No job applications yet</p>
          <p className="text-sm mt-2">Start by tailoring your resume for a job!</p>
          <Link
            href="/dashboard/tailor"
            className="inline-block mt-4 px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors"
          >
            Create Your First Application →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-steel/5 rounded-3xl border border-steel/20 p-8 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold">Job Applications</h3>
        <span className="text-sm text-steel-light">{applications.length} total</span>
      </div>

      <div className="space-y-4">
        {applications.map((app) => (
          <div
            key={app.id}
            className="p-6 bg-background/50 rounded-xl border border-steel/20 hover:border-accent/40 transition-all group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                    {app.job_title}
                  </h4>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(app.status)}`}
                  >
                    {app.status || "Draft"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-steel-light mb-3">
                  {app.company_name && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {app.company_name}
                    </span>
                  )}
                  {app.job_level && (
                    <span className="capitalize">{app.job_level}</span>
                  )}
                  {app.domain && (
                    <span className="capitalize">{app.domain}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(app.created_at)}
                  </span>
                </div>

                {app.recruiter_email && (
                  <div className="flex items-center gap-2 text-sm text-steel-light">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <a
                      href={`mailto:${app.recruiter_email}`}
                      className="text-accent hover:text-accent/80 transition-colors"
                    >
                      {app.recruiter_email}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/applications/${app.id}`}
                  className="px-4 py-2 text-sm bg-steel/10 hover:bg-steel/20 text-foreground rounded-lg transition-colors border border-steel/20"
                >
                  View
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {applications.length > 5 && (
        <div className="mt-6 text-center">
          <Link
            href="/dashboard/applications"
            className="text-accent hover:text-accent/80 font-semibold transition-colors"
          >
            View All Applications →
          </Link>
        </div>
      )}
    </div>
  );
}


