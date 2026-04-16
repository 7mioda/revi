"use client";

import { cn } from "@/lib/utils";
import { AsciiBackground } from "./AsciiBackground";

export function HeroSection() {
  return (
    <section
      className="relative flex w-full flex-col items-center pt-[65px]"
      style={{ background: "#fafaf9" }}
    >
      {/* ASCII background — full width, behind everything */}
      <AsciiBackground className="absolute inset-0 z-0" />

      {/* Inner content block */}
      <div
        className={cn(
          "relative z-10 flex w-full max-w-[1200px] flex-col items-center justify-center",
          "min-h-[90vh] overflow-hidden rounded-xl",
          "gap-8 px-4 py-[100px]",
          "sm:px-[120px] sm:py-[100px] sm:pb-[130px]"
        )}
      >
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          {/* Main heading */}
          <h1
            className="max-w-4xl text-[40px] font-normal leading-[1.05] text-[#0a0908] sm:text-[56px] lg:text-[72px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Every engineer <em className="font-serif italic" style={{ fontWeight: 100 }}>has a philosophy.</em>
            <br />
            Make sure it&apos;s never lost.
          </h1>

          {/* Subtitle */}
          <p
            className="max-w-xl text-[15px] leading-relaxed sm:text-[16px]"
            style={{ color: "rgba(0, 0, 0, 0.5)" }}
          >
            Revi watches how you review. Then reviews like you.
            <br />
            Even when you&apos;re not there.
          </p>

          {/* CTA */}
          <a
            href="#waitlist"
            className="bg-[#0a0908] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ padding: "8px 16px", borderRadius: "8px" }}
          >
            Join the waitlist
          </a>
        </div>
      </div>
    </section>
  );
}
