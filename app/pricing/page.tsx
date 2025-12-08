"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import StripeCheckoutButton from "@/components/StripeCheckoutButton";

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
      setLoading(false);
    };

    checkSession();
  }, [router]);

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
          <Link href="/" className="flex items-center gap-2">
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
            Dashboard
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h2>
          <p className="text-xl text-steel-light">
            Get unlimited CV generations and premium features
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-md mx-auto">
          <div className="p-8 bg-gradient-to-br from-accent/10 via-accent/5 to-accent/10 rounded-3xl border-2 border-accent/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/5 pointer-events-none"></div>
            
            <div className="relative z-10">
              {/* Badge */}
              <div className="inline-block mb-4 px-4 py-2 bg-gradient-to-r from-accent via-accent/90 to-accent text-background rounded-full text-sm font-bold border-2 border-accent/60 shadow-lg">
                ✨ Early Adopter Pack
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="text-5xl font-bold text-foreground mb-2">
                  €20
                </div>
                <div className="text-steel-light">One-time payment</div>
              </div>

              {/* Features */}
              <div className="mb-8 space-y-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <div className="font-semibold text-foreground">Unlimited CV Generations</div>
                    <div className="text-sm text-steel-light">Generate as many tailored CVs as you need</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <div className="font-semibold text-foreground">Premium Access</div>
                    <div className="text-sm text-steel-light">All premium features unlocked</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <div className="font-semibold text-foreground">Early Adopter Benefits</div>
                    <div className="text-sm text-steel-light">Special pricing for early supporters</div>
                  </div>
                </div>
              </div>

              {/* Checkout Button */}
              <StripeCheckoutButton
                userId={user?.id || ""}
                buttonText="Get Early Adopter Pack - €20"
                className="w-full"
              />

              <p className="mt-4 text-sm text-steel-light text-center">
                Secure payment powered by Stripe
              </p>
            </div>
          </div>
        </div>

        {/* Success/Cancel Messages */}
        {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("success") && (
          <div className="max-w-md mx-auto mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-500 text-center">
            Payment successful! Your account has been upgraded.
          </div>
        )}

        {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("canceled") && (
          <div className="max-w-md mx-auto mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-500 text-center">
            Payment canceled. You can try again anytime.
          </div>
        )}
      </main>
    </div>
  );
}

