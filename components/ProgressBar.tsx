"use client";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  onStepClick?: (step: number) => void;
}

export default function ProgressBar({ currentStep, totalSteps, onStepClick }: ProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full mb-8">
      {/* Progress Text */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-foreground">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-steel-light">
          {Math.round(progress)}% Complete
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-steel/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-accent/80 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step Dots */}
      {onStepClick && (
        <div className="flex justify-between mt-4">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <button
              key={step}
              onClick={() => onStepClick(step)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                step < currentStep
                  ? "bg-accent text-background cursor-pointer hover:scale-110"
                  : step === currentStep
                  ? "bg-accent text-background scale-110"
                  : "bg-steel/20 text-steel-light cursor-pointer hover:bg-steel/30"
              }`}
              title={`Go to step ${step}`}
            >
              {step < currentStep ? "✓" : step}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

