"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

const faqItems = [
  {
    question: "What happens to our data? Is it used to train your models?",
    answer:
      "No. Your data is never used to train any AI model — ours or anyone else's.\nEvery organization's data is isolated at the row level (RLS).\nWe use AES-256 encryption at rest and in transit.\nYou can request deletion at any time.",
  },
  {
    question: "How long before Lyse is actually useful?",
    answer:
      "30 minutes to connect your stack.\nLyse reads your Slack history, Linear backlog, and GitHub activity.\nBy the end of the first session, it has enough context to draft your first spec.\nMost teams see the first real output within the same day.",
  },
  {
    question: "What if Lyse makes a wrong decision?",
    answer:
      "Lyse never executes without your approval.\nEvery action is proposed, not taken.\nAnd every proposal is logged with its reasoning — so you can review, override, or ask why.\nIf a decision is wrong, it's not shipped.",
  },
  {
    question: "We already use Notion + Linear. Why Lyse?",
    answer:
      "Notion knows what's in Notion. Linear knows what's in Linear.\nNeither knows the connection between a Slack conversation, a spec, and a decision made 3 sprints ago.\nLyse does.\nIt doesn't replace your tools — it's the layer that makes them work together.",
  },
  {
    question: "Can I trust Lyse for real sprint planning?",
    answer:
      'You always have the final call. Lyse proposes; you approve.\nStart with one sprint. See the quality of the proposals.\nMost CTOs go from "review everything" to "approve most things" within 4 weeks.',
  },
  {
    question: "What integrations does Lyse support?",
    answer:
      "V1: Slack, Linear, GitHub, Discord.\nMore integrations are on the roadmap.\nYou can request specific ones — we prioritize by ICP demand.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="w-full"
      style={{ backgroundColor: "#fafaf9" }}
    >
      <div className="mx-auto max-w-[800px] px-5 py-20">
        {/* Section header */}
        <div className="mb-12 flex flex-col items-center text-center">
          <span
            className="mb-4 text-[13px] font-medium uppercase tracking-widest"
            style={{ color: "rgba(0, 0, 0, 0.5)" }}
          >
            FAQ
          </span>
          <h2
            className="mb-4 text-[32px] font-semibold leading-tight text-[#0a0908] sm:text-[44px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Everything you
            <br />
            need to know.
          </h2>
          <p
            className="text-[15px] leading-relaxed"
            style={{ color: "rgba(0, 0, 0, 0.5)" }}
          >
            Everything teams ask before getting started.
          </p>
        </div>

        {/* FAQ items */}
        <div className="divide-y" style={{ borderColor: "rgba(0, 0, 0, 0.06)" }}>
          {faqItems.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                style={{ borderColor: "rgba(0, 0, 0, 0.06)" }}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  <span className="pr-4 text-[15px] font-medium text-[#0a0908]">
                    {item.question}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[20px] transition-transform duration-200",
                      isOpen && "rotate-45"
                    )}
                    style={{ color: "rgba(0, 0, 0, 0.5)" }}
                  >
                    +
                  </span>
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-[500px] opacity-100 pb-5" : "max-h-0 opacity-0"
                  )}
                >
                  <p
                    className="text-[15px] leading-[24px] whitespace-pre-line"
                    style={{
                      color: "rgb(126, 126, 126)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
