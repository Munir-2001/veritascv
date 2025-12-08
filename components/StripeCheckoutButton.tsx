"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";

interface StripeCheckoutButtonProps {
  userId: string;
  priceId?: string; // Optional - will use EARLY_ADOPTER if not provided
  buttonText?: string;
  className?: string;
}

// Initialize Stripe
// Automatically uses test key in development, live key in production
const isDevelopment = process.env.NODE_ENV === "development";
const publishableKey = isDevelopment
  ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
  : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

const stripePromise = loadStripe(publishableKey);

export default function StripeCheckoutButton({
  userId,
  priceId,
  buttonText = "Get Early Adopter Pack",
  className = "",
}: StripeCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    if (!userId) {
      alert("Please log in to continue");
      return;
    }

    setLoading(true);

    try {
      // Create checkout session
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          priceId, // Will use EARLY_ADOPTER from env if not provided
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe failed to load");
      }

      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      alert(`Error: ${error.message || "Failed to start checkout"}`);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading || !userId}
      className={`px-6 py-3 bg-accent text-background rounded-xl font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? "Loading..." : buttonText}
    </button>
  );
}

