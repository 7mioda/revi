import { cn } from "@/lib/utils";

export function CTASection() {
  return (
    <section className="w-full" style={{ backgroundColor: "#fafaf9" }}>
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-5 py-24 text-center md:py-32">
        {/* Heading */}
        <h2
          className="max-w-3xl text-[32px] font-semibold leading-tight text-[#0a0908] sm:text-[44px]"
          style={{ letterSpacing: "-0.02em" }}
        >
          Your PM just quit. Lyse is operational in 24 hours.
        </h2>

        {/* Subtitles */}
        <p
          className="text-[15px]"
          style={{ color: "rgba(0, 0, 0, 0.5)" }}
        >
          Join teams who stopped doing PM work manually.
        </p>
        <p
          className="-mt-2 text-[15px]"
          style={{ color: "rgba(0, 0, 0, 0.5)" }}
        >
          Free forever — connect your stack in 30 minutes.
        </p>

        {/* CTA Buttons */}
        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="http://localhost:3001"
            className={cn(
              "inline-flex items-center justify-center",
              "rounded-lg bg-[#0a0908] px-6 py-3",
              "text-[14px] font-medium text-white",
              "transition-opacity duration-150 hover:opacity-90"
            )}
          >
            Join the waitlist
          </a>
          <a
            href="https://calendar.app.google/cv5zXnNMVGfpC6Mq7"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center justify-center",
              "rounded-lg bg-transparent px-6 py-3",
              "text-[14px] font-medium text-[#0a0908]",
              "transition-colors duration-150 hover:bg-black/5"
            )}
            style={{ border: "1px solid rgba(0, 0, 0, 0.12)" }}
          >
            Book a demo
          </a>
        </div>
      </div>
    </section>
  );
}
