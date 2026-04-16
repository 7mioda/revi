import { cn } from "@/lib/utils";

const pills = [
  "Devs blocked",
  "No spec owner",
  "Lost in threads",
  "No clarity",
  "No priorities",
  "Backlog not ready",
  "Sprint tomorrow",
  "No process",
  "No owner",
  "In someone's head",
  "Context lost",
  "Why did we build this?",
  "Not documented",
];

export function ProblemSection() {
  return (
    <section className="w-full" style={{ backgroundColor: "#fafaf9" }}>
      <div
        className={cn(
          "mx-auto flex flex-col items-center text-center",
          "px-5 py-20",
          "max-w-[1200px]"
        )}
      >
        {/* Section label */}
        <p
          className="mb-4 text-[13px] font-medium uppercase tracking-widest"
          style={{ color: "rgba(0, 0, 0, 0.5)" }}
        >
          Problem
        </p>

        {/* Heading */}
        <h2
          className={cn(
            "mb-4 font-semibold leading-tight text-[#0a0908]",
            "text-[32px] sm:text-[44px]"
          )}
          style={{ letterSpacing: "-0.02em" }}
        >
          You ship the product.
          <br />
          And the process.
        </h2>

        {/* Subtext */}
        <p
          className="mb-12 max-w-md text-[15px] leading-relaxed"
          style={{ color: "rgba(0, 0, 0, 0.5)" }}
        >
          This is PM work falling on engineering.
          <br />
          Every week. Every sprint.
        </p>

        {/* Pain point pills with fade mask */}
        <div className="relative w-full max-w-2xl overflow-hidden">
          {/* Top fade */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8"
            style={{
              background: "linear-gradient(to bottom, #fafaf9, transparent)",
            }}
          />
          {/* Bottom fade */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8"
            style={{
              background: "linear-gradient(to top, #fafaf9, transparent)",
            }}
          />

          <div className="flex flex-wrap justify-center gap-2 py-6">
            {pills.map((label) => (
              <span
                key={label}
                className="select-none whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] leading-none"
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.04)",
                  border: "1px solid rgba(0, 0, 0, 0.08)",
                  color: "rgba(0, 0, 0, 0.5)",
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
