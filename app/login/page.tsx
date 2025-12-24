"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

type AuthMode = "login" | "signup";

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
      }
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.push("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      // Supabase handles the entire OAuth flow automatically
      // It will redirect to Google, handle the callback, and redirect back
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Supabase will redirect back to this URL after OAuth completes
          redirectTo: typeof window !== "undefined" 
            ? `${window.location.origin}/dashboard` 
            : undefined,
        },
      });
      if (error) throw error;
      // Note: User will be redirected away, so loading state will reset on redirect
    } catch (error) {
      console.error("Error with Google auth:", error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Subtle background effect */}
      <div className="futuristic-grid opacity-5"></div>
      
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
        </nav>
      </header>

      {/* Login Card */}
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 rounded-2xl shadow-xl p-10 text-center border border-accent/30 relative">
            <div className="relative z-10">
              <div className="inline-block mb-4 px-4 py-2 bg-accent/10 text-accent rounded-full text-sm font-semibold border border-accent/30">
                {mode === "login" ? "🔐 Secure Login" : "✨ Create Account"}
              </div>
              
              {/* Toggle Buttons */}
              <div className="flex gap-2 mb-6 bg-steel/10 p-1 rounded-xl border border-steel/20">
                <button
                  onClick={() => setMode("login")}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-300 ${
                    mode === "login"
                      ? "bg-accent text-background shadow-lg"
                      : "text-steel-light hover:text-accent"
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-300 ${
                    mode === "signup"
                      ? "bg-accent text-background shadow-lg"
                      : "text-steel-light hover:text-accent"
                  }`}
                >
                  Sign Up
                </button>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-foreground">
                {mode === "login" ? "Welcome Back" : "Get Started"}
              </h2>
              <p className="text-steel-light mb-8 text-lg">
                {mode === "login" 
                  ? <>Sign in to access your <span className="font-bold text-accent">resume optimization</span> tools</>
                  : <>Create your account and start optimizing your <span className="font-bold text-accent">resume</span> today</>
                }
              </p>

              <button
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full py-4 bg-background text-accent font-bold rounded-xl shadow-md hover:bg-accent/10 transition-colors duration-200 flex items-center justify-center gap-3 border border-accent hover:border-accent/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    <span>{mode === "login" ? "Signing in..." : "Signing up..."}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <p className="mt-6 text-steel-light text-sm">
                By continuing, you agree to our{" "}
                <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>
                {mode === "signup" && " and consent to the processing of your personal data"}
              </p>

              <div className="mt-8 pt-6 border-t border-steel/20">
                <p className="text-steel-light text-sm">
                  {mode === "login" ? (
                    <>
                      Don't have an account?{" "}
                      <button 
                        onClick={() => setMode("signup")}
                        className="text-accent hover:text-accent/80 font-semibold transition-colors"
                      >
                        Sign up here
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button 
                        onClick={() => setMode("login")}
                        className="text-accent hover:text-accent/80 font-semibold transition-colors"
                      >
                        Login here
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

