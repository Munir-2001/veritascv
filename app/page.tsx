"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import WaitlistForm from '@/components/WaitlistForm';
import { supabase } from '@/lib/supabase/client';
import StructuredData from '@/components/StructuredData';

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function Home() {
  const router = useRouter();
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
    <>
      <StructuredData type="WebApplication" />
      <StructuredData type="Organization" />
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
                    className="px-8 py-4 bg-accent text-background text-lg font-semibold rounded-2xl hover:bg-accent/90 transition-all duration-300 shadow-xl shadow-accent/30 hover:shadow-2xl hover:shadow-accent/40 hover:-translate-y-1 hover:scale-105"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="px-8 py-4 bg-accent text-background text-lg font-semibold rounded-2xl hover:bg-accent/90 transition-all duration-300 shadow-xl shadow-accent/30 hover:shadow-2xl hover:shadow-accent/40 hover:-translate-y-1 hover:scale-105"
                  >
                    Login / Sign Up
                  </Link>
                )}
              </>
            )}
            <button
              onClick={() => scrollToId('waitlist')}
              className="px-6 py-3 text-steel-light hover:text-accent transition-colors font-medium hidden md:block"
            >
              Get Early Access
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 py-20 lg:py-32 section-pattern">
        <div className="animated-line top-1/4 left-0 w-full" style={{ animationDelay: '0s' }}></div>
        <div className="animated-line top-2/4 left-0 w-full" style={{ animationDelay: '1.5s' }}></div>
        <div className="animated-line-vertical top-0 left-1/4 h-full" style={{ animationDelay: '0.5s' }}></div>
        <div className="animated-line-vertical top-0 right-1/4 h-full" style={{ animationDelay: '1s' }}></div>
        <div className="text-center relative z-10">
          <div className="inline-block mb-6 px-4 py-2 bg-accent/10 text-accent rounded-full text-sm font-medium border border-accent/20 hover:bg-accent/20 hover:border-accent/40 transition-all duration-300">
            🚀 AI-Powered Resume Optimization
          </div>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 tracking-tight">
            Build Resumes That{" "}
            <span className="bg-gradient-to-r from-accent via-accent/80 to-accent/60 bg-clip-text text-transparent animate-pulse">
              Get Interviews
            </span>
          </h2>
          <p className="mt-6 text-xl md:text-2xl text-steel-light max-w-3xl mx-auto leading-relaxed">
            Transform your resume in <span className="font-bold text-accent">seconds</span>. <span className="font-bold">AI-powered</span> tailoring, <span className="font-bold">cover letter generation</span>, and <span className="font-bold">expert feedback</span> to help you land your <span className="font-bold">dream job</span>.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            {/* Header button */}
            <button
              onClick={() => scrollToId('waitlist')}
              className="px-8 py-4 bg-accent text-background rounded-lg hover:bg-accent/90 transition-all duration-200 font-medium shadow-lg shadow-accent/30"
            >
              Join Waitlist
            </button>

            <a
              href="#features"
              className="px-8 py-4 bg-background text-steel-light text-lg font-semibold rounded-2xl border-2 border-steel/30 hover:border-accent/50 hover:bg-steel/5 transition-all duration-300 hover:-translate-y-1"
            >
              Learn More
            </a>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="p-6 bg-steel/10 rounded-3xl border border-steel/20 backdrop-blur-sm hover:border-accent/40 transition-all duration-300 hover:scale-105">
              <div className="text-4xl font-bold text-accent">10x</div>
              <div className="text-steel-light mt-2">More Interviews</div>
            </div>
            <div className="p-6 bg-steel/10 rounded-3xl border border-steel/20 backdrop-blur-sm hover:border-accent/40 transition-all duration-300 hover:scale-105">
              <div className="text-4xl font-bold text-accent">30s</div>
              <div className="text-steel-light mt-2">Resume Tailoring</div>
            </div>
            <div className="p-6 bg-steel/10 rounded-3xl border border-steel/20 backdrop-blur-sm hover:border-accent/40 transition-all duration-300 hover:scale-105">
              <div className="text-4xl font-bold text-accent">95%</div>
              <div className="text-steel-light mt-2">ATS Optimization</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative bg-gradient-to-b from-section-alt to-section-alt-2 border-t border-steel/20 section-pattern">
        <div className="futuristic-grid"></div>
        <div className="animated-line top-1/3 left-0 w-full" style={{ animationDelay: '0s' }}></div>
        <div className="max-w-7xl mx-auto px-6 py-24 relative z-10">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Everything You Need to Succeed</h3>
            <p className="text-xl text-steel-light max-w-2xl mx-auto leading-relaxed">
              Powerful <span className="font-bold text-accent">AI tools</span> designed for <span className="font-bold">job seekers</span> who want an <span className="font-bold">unfair advantage</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm">
              <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="font-bold text-2xl mb-3">AI Resume Tailoring</h4>
            </div>

            <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm">
              <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h4 className="font-bold text-2xl mb-3">Cover Letter Generation</h4>
            </div>

            <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm">
              <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="font-bold text-2xl mb-3">CV Audit & Scoring</h4>
            </div>

            <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm">
              <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h4 className="font-bold text-2xl mb-3">ATS Optimization</h4>
            </div>

            <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm">
              <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h4 className="font-bold text-2xl mb-3">Smart Bullet Points</h4>
            </div>

            <div className="group p-8 bg-steel/5 rounded-3xl shadow-sm border border-steel/20 hover:shadow-xl hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm">
              <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="font-bold text-2xl mb-3">Instant Results</h4>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative bg-gradient-to-b from-background to-section-alt border-t border-steel/20">
        <div className="max-w-7xl mx-auto px-6 py-24 relative z-10">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">How It Works</h3>
            <p className="text-xl text-steel-light max-w-2xl mx-auto leading-relaxed">
              Three <span className="font-bold text-accent">simple steps</span> to your <span className="font-bold">perfect resume</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="text-center group">
              <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center text-background text-3xl font-bold mx-auto mb-6 shadow-lg shadow-accent/30 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-accent/50 transition-all duration-300 relative">
                <div className="absolute inset-0 rounded-full border-2 border-accent/50 animate-ping opacity-0 group-hover:opacity-100"></div>
                1
              </div>
              <h4 className="text-2xl font-bold mb-4">Upload Your Resume</h4>
              <p className="text-steel-light leading-relaxed">
                Simply <span className="font-bold">paste</span> your current resume or <span className="font-bold">upload</span> a file. Our system supports <span className="font-bold text-accent">all common formats</span>.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center text-background text-3xl font-bold mx-auto mb-6 shadow-lg shadow-accent/30 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-accent/50 transition-all duration-300 relative">
                <div className="absolute inset-0 rounded-full border-2 border-accent/50 animate-ping opacity-0 group-hover:opacity-100"></div>
                2
              </div>
              <h4 className="text-2xl font-bold mb-4">Add Job Description</h4>
              <p className="text-steel-light leading-relaxed">
                <span className="font-bold">Paste</span> the job posting you're applying for. Our <span className="font-bold text-accent">AI analyzes</span> <span className="font-bold">requirements</span> and <span className="font-bold">keywords</span>.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center text-background text-3xl font-bold mx-auto mb-6 shadow-lg shadow-accent/30 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-accent/50 transition-all duration-300 relative">
                <div className="absolute inset-0 rounded-full border-2 border-accent/50 animate-ping opacity-0 group-hover:opacity-100"></div>
                3
              </div>
              <h4 className="text-2xl font-bold mb-4">Get Your Optimized Resume</h4>
              <p className="text-steel-light leading-relaxed">
                Receive a <span className="font-bold text-accent">perfectly tailored</span> resume, <span className="font-bold">cover letter</span>, and <span className="font-bold">detailed feedback</span> in <span className="font-bold">seconds</span>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist CTA */}
      <section id="waitlist" className="relative bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-background overflow-hidden">
        <div className="futuristic-grid opacity-10"></div>
        <div className="exclusive-shimmer absolute inset-0"></div>
        <div className="animated-line top-1/4 left-0 w-full" style={{ animationDelay: '0s' }}></div>
        <div className="animated-line top-3/4 left-0 w-full" style={{ animationDelay: '2s' }}></div>
        <div className="scan-line"></div>
        <div className="max-w-4xl mx-auto px-6 py-24 flex justify-center items-center relative z-10">
          <div className="w-full max-w-xl rounded-3xl shadow-2xl p-10 text-center border-2 border-accent/50 exclusive-card exclusive-pulse relative overflow-hidden">
            {/* Inner glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10 pointer-events-none"></div>
            
            {/* Sparkle effects */}
            <div className="sparkle"></div>
            <div className="sparkle"></div>
            <div className="sparkle"></div>
            <div className="sparkle"></div>
            <div className="sparkle"></div>
            <div className="sparkle"></div>
            
            {/* Content wrapper with relative positioning */}
            <div className="relative z-10">
              <div className="exclusive-badge inline-block mb-4 px-4 py-2 bg-gradient-to-r from-accent via-accent/90 to-accent text-background rounded-full text-sm font-bold border-2 border-accent/60 shadow-lg">
                ✨ Limited Early Access
              </div>
              <h3 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-background animate-pulse" style={{ animationDuration: '3s' }}>
                Sign up to avail free access
              </h3>
              <p className="text-xl text-background/90 mb-10 max-w-2xl mx-auto leading-relaxed">
                Join the waitlist and get <span className="font-bold text-accent">free access</span> before the public launch. Plus, get <span className="font-bold text-accent">exclusive</span> <span className="font-bold text-accent">free CV generations</span>.
              </p>

              <WaitlistForm />

              <p className="mt-6 text-background/80 text-sm">
                🔒 We respect your privacy. No spam, unsubscribe anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background text-steel border-t border-steel/20">
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
                <span className="font-bold text-accent">AI-powered</span> <span className="font-bold">resume optimization</span> to help you land your <span className="font-bold">dream job</span>.
              </p>
            </div>
            <div>
              <h5 className="text-foreground font-semibold mb-4">Product</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-accent transition text-steel-light">Features</a></li>
                <li><a href="#waitlist" className="hover:text-accent transition text-steel-light">Pricing</a></li>
                <li><a href="#" className="hover:text-accent transition text-steel-light">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-foreground font-semibold mb-4">Company</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-accent transition text-steel-light">About</a></li>
                <li><a href="#" className="hover:text-accent transition text-steel-light">Blog</a></li>
                <li><a href="#" className="hover:text-accent transition text-steel-light">Careers</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-foreground font-semibold mb-4">Support</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-accent transition text-steel-light">Help Center</a></li>
                <li><a href="#" className="hover:text-accent transition text-steel-light">Contact</a></li>
                <li><Link href="/privacy" className="hover:text-accent transition text-steel-light">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-steel/20 pt-8 text-center text-sm text-steel">
            © {new Date().getFullYear()} VeritasCV. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
