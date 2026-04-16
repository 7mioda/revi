import { cn } from "@/lib/utils";

const trustCards = [
  {
    title: "Propose-first model",
    description:
      "Every action requires explicit approval before execution. No surprises, no silent changes.",
  },
  {
    title: "Full audit trail",
    description: (
      <>
        Every decision Lyse makes is logged with context and reasoning.{" "}
        <code className="font-mono text-[#0a0908]/70">@lyse explain</code> — works
        on any action, anytime.
      </>
    ),
  },
  {
    title: "Granular permissions",
    description:
      'Set what Lyse can and can\'t do, per action type. From "always ask" to "auto-approve drafts".',
  },
];

export function TrustSection() {
  return (
    <section className="w-full" style={{ backgroundColor: "#fafaf9" }}>
      <div className="mx-auto max-w-[1200px] px-5 py-20">
        {/* Section header */}
        <div className="mb-12 flex flex-col items-center text-center">
          <span
            className="mb-4 text-[13px] font-medium uppercase tracking-widest"
            style={{ color: "rgba(0, 0, 0, 0.5)" }}
          >
            Trust
          </span>
          <h2
            className="mb-4 text-[32px] font-semibold leading-tight text-[#0a0908] sm:text-[44px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Lyse proposes.
            <br />
            You approve. Always.
          </h2>
          <p
            className="max-w-[560px] text-[15px] leading-relaxed"
            style={{ color: "rgba(0, 0, 0, 0.5)" }}
          >
            No autonomous action without your sign-off.
            <br />
            Every decision is logged, explained, and reversible.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {trustCards.map((card, i) => (
            <div
              key={i}
              className={cn("rounded-lg p-6")}
              style={{
                backgroundColor: "rgb(245, 245, 244)",
                border: "1px solid rgba(0, 0, 0, 0.06)",
              }}
            >
              <h3 className="mb-3 text-[17px] font-medium text-[#0a0908]">
                {card.title}
              </h3>
              <p
                className="text-[14px] leading-[24px]"
                style={{ color: "rgba(0, 0, 0, 0.5)" }}
              >
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
