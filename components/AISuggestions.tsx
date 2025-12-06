"use client";

import { useState } from "react";

interface AISuggestionsProps {
  suggestions: {
    keywords?: string[];
    missingSkills?: string[];
    formatTips?: string[];
    tone?: string;
  };
}

export default function AISuggestions({ suggestions }: AISuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasSuggestions =
    (suggestions.keywords && suggestions.keywords.length > 0) ||
    (suggestions.missingSkills && suggestions.missingSkills.length > 0) ||
    (suggestions.formatTips && suggestions.formatTips.length > 0) ||
    suggestions.tone;

  if (!hasSuggestions) return null;

  return (
    <div className="mt-4 bg-accent/10 border border-accent/30 rounded-xl p-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className="text-sm font-semibold text-accent">AI Suggestions</span>
        </div>
        <svg
          className={`w-4 h-4 text-accent transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3 text-sm">
          {suggestions.keywords && suggestions.keywords.length > 0 && (
            <div>
              <p className="font-semibold text-foreground mb-1">Detected Keywords:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.keywords.slice(0, 10).map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-accent/20 text-accent rounded text-xs"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {suggestions.missingSkills && suggestions.missingSkills.length > 0 && (
            <div>
              <p className="font-semibold text-foreground mb-1">Consider Highlighting:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.missingSkills.slice(0, 5).map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-steel/20 text-steel-light rounded text-xs"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {suggestions.formatTips && suggestions.formatTips.length > 0 && (
            <div>
              <p className="font-semibold text-foreground mb-1">Format Tips:</p>
              <ul className="list-disc list-inside text-steel-light space-y-1">
                {suggestions.formatTips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.tone && (
            <div>
              <p className="font-semibold text-foreground mb-1">Recommended Tone:</p>
              <p className="text-steel-light">{suggestions.tone}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

