import { cn } from "@/lib/utils";

export function FeaturesSection() {
  return (
    <section
      id="features"
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
            Features
          </span>
          <h2
            className="mb-4 text-[32px] font-semibold leading-tight text-white sm:text-[44px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Everything a PM does. Nothing a PM costs.
          </h2>
          <p
            className="max-w-lg text-[15px] leading-relaxed"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            Lyse handles the process work. Your team keeps the decisions
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Card 1: Spec writing — full width */}
          <div
            className="col-span-1 overflow-hidden rounded-xl md:col-span-2"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <div className="p-6">
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Before card */}
                <div className="rounded-lg p-4" style={{ backgroundColor: "rgb(13, 13, 13)" }}>
                  <BeforeTag />
                  <div className="mt-3">
                    <div className="mb-2 flex items-center gap-2">
                      <PriorityTag label="Hight" color="red" />
                      <span
                        className="text-[12px]"
                        style={{ color: "rgba(255, 255, 255, 0.32)" }}
                      >
                        26 February 2026
                      </span>
                    </div>
                    <h4 className="mb-1 text-[14px] font-medium text-white">
                      User auth flow
                    </h4>
                    <p
                      className="text-[13px] leading-relaxed"
                      style={{ color: "rgba(255, 255, 255, 0.5)" }}
                    >
                      Fix the login thing Thomas mentioned in standup. Ask him
                      for details before starting.
                    </p>
                  </div>
                </div>

                {/* After card */}
                <div className="rounded-lg p-4" style={{ backgroundColor: "rgb(13, 13, 13)" }}>
                  <AfterTag />
                  <div className="mt-3">
                    <div className="mb-2 flex items-center gap-2">
                      <PriorityTag label="High" color="orange" />
                      <span
                        className="text-[12px]"
                        style={{ color: "rgba(255, 255, 255, 0.32)" }}
                      >
                        26 February 2026
                      </span>
                    </div>
                    <h4 className="mb-1 text-[14px] font-medium text-white">
                      User auth flow
                    </h4>
                    <p
                      className="text-[13px] leading-relaxed"
                      style={{ color: "rgba(255, 255, 255, 0.5)" }}
                    >
                      Implement OAuth2 PKCE flow for web client. Add session
                      refresh with 7-day rolling window. Handle edge case:
                      concurrent sessions across devices.
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="mb-2 text-[20px] font-medium text-white">
                Spec writing
              </h3>
              <p
                className="max-w-2xl text-[14px] leading-[22px]"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Lyse drafts specs from a Slack thread, a Notion doc, or a
                Linear issue. With context from your past decisions built in.
                Engineers get clarity. You get time back.
              </p>
            </div>
          </div>

          {/* Card 2: Backlog prioritization */}
          <div
            className="overflow-hidden rounded-xl"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <div className="p-6">
              {/* Backlog items */}
              <div className="mb-6 space-y-2">
                <BacklogItem
                  title="CSV export"
                  tag="high request volume"
                  color="orange"
                />
                <BacklogItem
                  title="Onboarding flow"
                  tag="Q2 milestone"
                  color="green"
                />
                <BacklogItem
                  title="Fix auth timeout"
                  tag="3 users blocked"
                  color="red"
                />
              </div>

              <h3 className="mb-2 text-[20px] font-medium text-white">
                Backlog prioritization
              </h3>
              <p
                className="text-[14px] leading-[22px]"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Lyse reads your backlog and your product context. Proposes a
                prioritized sprint with reasoning. You approve, adjust, or
                override — always.
              </p>
            </div>
          </div>

          {/* Card 3: Decision memory */}
          <div
            className="overflow-hidden rounded-xl"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <div className="p-6">
              {/* Decision log */}
              <div className="mb-6 rounded-lg p-4" style={{ backgroundColor: "rgb(13, 13, 13)" }}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[14px] font-medium text-white">
                    Decision log
                  </span>
                  <span
                    className="text-[12px]"
                    style={{ color: "rgba(255, 255, 255, 0.32)" }}
                  >
                    247 PM decisions documented
                  </span>
                </div>
                <div className="space-y-2">
                  <LogEntry text="Spec #FR-142 approved · Apr 3, 14:22" />
                  <LogEntry text="Sprint 14 reprioritized · Apr 1, 09:47" />
                  <LogEntry text="Auth prioritized over payments · Mar 28, 17:03" />
                </div>
              </div>

              <h3 className="mb-2 text-[20px] font-medium text-white">
                Decision memory
              </h3>
              <p
                className="text-[14px] leading-[22px]"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Every decision Lyse makes is timestamped, explained, and linked
                to an outcome. 500 PM decisions in 6 months. Your institutional
                memory — no longer in someone&apos;s head.
              </p>
            </div>
          </div>

          {/* Card 4: Cross-tool synthesis — full width */}
          <div
            className="col-span-1 overflow-hidden rounded-xl md:col-span-2"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <div className="p-6">
              {/* Connected tools visualization */}
              <div className="mb-6 flex items-center justify-center gap-8 py-4">
                <ToolBadge name="Slack" />
                <ConnectorLine />
                <ToolBadge name="Linear" />
                <ConnectorLine />
                <ToolBadge name="GitHub" />
              </div>

              <h3 className="mb-2 text-[20px] font-medium text-white">
                Cross-tool synthesis
              </h3>
              <p
                className="max-w-2xl text-[14px] leading-[22px]"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Linear knows Linear. Slack knows Slack. Lyse knows how they
                connect. &ldquo;Why did we build this?&rdquo; — Lyse answers,
                with sources.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Sub-components */

function BeforeTag() {
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        color: "rgba(255, 255, 255, 0.5)",
      }}
    >
      Before
    </span>
  );
}

function AfterTag() {
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: "rgba(0, 153, 255, 0.1)",
        color: "rgb(0, 153, 255)",
      }}
    >
      After
    </span>
  );
}

function PriorityTag({
  label,
  color,
}: {
  label: string;
  color: "red" | "orange" | "green";
}) {
  const colorMap = {
    red: { bg: "rgba(241, 68, 67, 0.04)", text: "rgb(241, 68, 67)" },
    orange: { bg: "rgba(255, 106, 0, 0.04)", text: "rgb(255, 106, 0)" },
    green: { bg: "rgba(0, 202, 82, 0.04)", text: "rgb(0, 202, 82)" },
  };
  const c = colorMap[color];
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {label}
    </span>
  );
}

function BacklogItem({
  title,
  tag,
  color,
}: {
  title: string;
  tag: string;
  color: "red" | "orange" | "green";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg px-4 py-3"
      )}
      style={{
        backgroundColor: "rgb(13, 13, 13)",
        border: "1px solid rgba(255, 255, 255, 0.04)",
      }}
    >
      <span className="text-[14px] text-white">{title}</span>
      <PriorityTag label={tag} color={color} />
    </div>
  );
}

function LogEntry({ text }: { text: string }) {
  return (
    <div
      className="rounded px-3 py-2 font-mono text-[12px]"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        color: "rgba(255, 255, 255, 0.5)",
      }}
    >
      {text}
    </div>
  );
}

function ToolBadge({ name }: { name: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-4 py-2"
      style={{
        backgroundColor: "rgb(13, 13, 13)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      <span className="text-[13px] font-medium text-white">{name}</span>
    </div>
  );
}

function ConnectorLine() {
  return (
    <div
      className="h-px w-8"
      style={{ backgroundColor: "rgba(255, 255, 255, 0.12)" }}
    />
  );
}
