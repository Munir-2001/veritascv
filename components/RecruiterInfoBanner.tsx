"use client";

export default function RecruiterInfoBanner() {
  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/30 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="w-6 h-6 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-foreground mb-1">Track Your Applications</h3>
          <p className="text-sm text-steel-light leading-relaxed">
            💡 <strong>Pro Tip:</strong> Adding the recruiter's email helps you keep track of your
            applications and follow up effectively. We'll store this securely for your records so you
            can easily manage all your job applications in one place.
          </p>
        </div>
      </div>
    </div>
  );
}

