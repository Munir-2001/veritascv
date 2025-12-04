"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

interface User {
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // Check for OAuth callback hash in URL (Supabase handles this automatically)
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        router.push("/login");
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkSession();

    // Listen for auth changes (including OAuth callbacks)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";

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
            <div className="flex items-center gap-3">
              {user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt={userName}
                  className="w-10 h-10 rounded-full border-2 border-accent/40"
                />
              ) : (
                <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                  <span className="text-background font-bold text-sm">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-foreground">{userName}</p>
                <p className="text-xs text-steel-light">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-steel-light hover:text-accent transition-colors text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Welcome back, <span className="bg-gradient-to-r from-accent to-accent/70 bg-clip-text text-transparent">{userName}</span>
          </h2>
          <p className="text-xl text-steel-light">
            Optimize your resume and land your <span className="font-bold text-accent">dream job</span>
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-steel/10 rounded-3xl border border-steel/20 backdrop-blur-sm hover:border-accent/40 transition-all duration-300 hover:scale-105">
            <div className="text-3xl font-bold text-accent mb-2">0</div>
            <div className="text-steel-light">Resumes Created</div>
          </div>
          <div className="p-6 bg-steel/10 rounded-3xl border border-steel/20 backdrop-blur-sm hover:border-accent/40 transition-all duration-300 hover:scale-105">
            <div className="text-3xl font-bold text-accent mb-2">0</div>
            <div className="text-steel-light">CV Audits</div>
          </div>
          <div className="p-6 bg-steel/10 rounded-3xl border border-steel/20 backdrop-blur-sm hover:border-accent/40 transition-all duration-300 hover:scale-105">
            <div className="text-3xl font-bold text-accent mb-2">0</div>
            <div className="text-steel-light">Cover Letters</div>
          </div>
        </div>

        {/* Main Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Resume Tailoring */}
          <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm cursor-pointer">
            <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="font-bold text-2xl mb-3">AI Resume Tailoring</h3>
            <p className="text-steel-light mb-4">
              Tailor your resume to match any job description in <span className="font-bold text-accent">seconds</span>
            </p>
            <button className="text-accent font-semibold hover:text-accent/80 transition-colors">
              Get Started →
            </button>
          </div>

          {/* CV Audit */}
          <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm cursor-pointer">
            <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-bold text-2xl mb-3">CV Audit & Scoring</h3>
            <p className="text-steel-light mb-4">
              Get detailed feedback and an <span className="font-bold text-accent">ATS score</span> for your resume
            </p>
            <button className="text-accent font-semibold hover:text-accent/80 transition-colors">
              Audit Now →
            </button>
          </div>

          {/* Cover Letter */}
          <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm cursor-pointer">
            <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-2xl mb-3">Cover Letter Generator</h3>
            <p className="text-steel-light mb-4">
              Generate personalized cover letters <span className="font-bold text-accent">instantly</span>
            </p>
            <button className="text-accent font-semibold hover:text-accent/80 transition-colors">
              Generate →
            </button>
          </div>

          {/* ATS Optimization */}
          <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm cursor-pointer">
            <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-2xl mb-3">ATS Optimization</h3>
            <p className="text-steel-light mb-4">
              Optimize your resume for <span className="font-bold text-accent">applicant tracking systems</span>
            </p>
            <button className="text-accent font-semibold hover:text-accent/80 transition-colors">
              Optimize →
            </button>
          </div>

          {/* Smart Bullet Points */}
          <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm cursor-pointer">
            <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <h3 className="font-bold text-2xl mb-3">Smart Bullet Points</h3>
            <p className="text-steel-light mb-4">
              Transform your bullet points with <span className="font-bold text-accent">AI-powered</span> suggestions
            </p>
            <button className="text-accent font-semibold hover:text-accent/80 transition-colors">
              Enhance →
            </button>
          </div>

          {/* Resume Templates */}
          <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm cursor-pointer">
            <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h3 className="font-bold text-2xl mb-3">Resume Templates</h3>
            <p className="text-steel-light mb-4">
              Choose from professional <span className="font-bold text-accent">ATS-friendly</span> templates
            </p>
            <button className="text-accent font-semibold hover:text-accent/80 transition-colors">
              Browse →
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-steel/5 rounded-3xl border border-steel/20 p-8 backdrop-blur-sm">
          <h3 className="text-2xl font-bold mb-6">Recent Activity</h3>
          <div className="text-center py-12 text-steel-light">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg">No activity yet</p>
            <p className="text-sm mt-2">Start by creating your first optimized resume!</p>
          </div>
        </div>
      </main>
    </div>
  );
}

