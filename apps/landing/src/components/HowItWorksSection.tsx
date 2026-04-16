import { cn } from "@/lib/utils";

const integrations = [
  "Slack",
  "Linear",
  "GitHub",
  "Jira",
  "Asana",
  "GitLab",
  "Discord",
  "Notion",
];

const steps = [
  {
    number: "01",
    title: "Plug in your stack",
    description:
      "Lyse reads your team's history and builds a picture of how your company actually works.",
  },
  {
    number: "02",
    title: "Lyse learns your process",
    description:
      "Lyse builds a knowledge base of how your team works, what matters to your product, and what's been tried before.",
  },
  {
    number: "03",
    title: "Specs. Backlog. Decisions.",
    description:
      "Lyse proposes the next action. A spec drafted. A ticket prioritized. A decision documented.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="w-full"
      style={{ backgroundColor: "#0a0908" }}
    >
      <div className="mx-auto max-w-[1200px] px-5 py-20">
        {/* Section header */}
        <div className="mb-12 flex flex-col items-center text-center">
          <span
            className="mb-4 text-[13px] font-medium uppercase tracking-widest"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            How it works
          </span>
          <h2
            className="mb-4 text-[32px] font-semibold leading-tight text-white sm:text-[44px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Lyse works where your
            <br />
            team already works.
          </h2>
          <p
            className="max-w-lg text-[15px] leading-relaxed"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            Connect your stack in 5 minutes. Lyse learns your process, then
            handles it.
          </p>
        </div>

        {/* Integration logos strip */}
        <div
          className="mx-auto mb-16 flex max-w-2xl flex-wrap items-center justify-center gap-4 rounded-lg px-6 py-4"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
          }}
        >
          {integrations.map((name) => (
            <span
              key={name}
              className="text-[12px] font-medium"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {name}
            </span>
          ))}
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className={cn("rounded-xl p-6")}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
              }}
            >
              <span
                className="mb-3 inline-block font-mono text-[12px]"
                style={{ color: "rgba(255, 255, 255, 0.32)" }}
              >
                {step.number}
              </span>
              <h3 className="mb-2 text-[17px] font-medium text-white">
                {step.title}
              </h3>
              <p
                className="text-[14px] leading-[22px]"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
