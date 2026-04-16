"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import Image from "next/image";

const navLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
  { label: "News", href: "#news" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className="fixed top-0 z-50 w-full"
      style={{
        background: "rgba(250, 250, 249, 0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3">
        {/* Logo */}
        <a href="http://localhost:3001" className="flex items-center">
          <Image
            src="/logo-revi.svg"
            alt="Revi"
            width={32}
            height={32}
            className="h-8 w-8"
          />
        </a>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[14px] text-[#0a0908] transition-opacity duration-150 hover:opacity-70"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <a
          href="http://localhost:3001"
          className="hidden text-[13px] font-medium text-[#0a0908] transition-opacity duration-150 hover:opacity-70 md:inline-flex"
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            backgroundColor: "rgba(0, 0, 0, 0.06)",
          }}
        >
          Join the waitlist
        </a>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                "block h-px w-5 bg-[#0a0908] transition-transform duration-200",
                mobileOpen && "translate-y-[3px] rotate-45"
              )}
            />
            <span
              className={cn(
                "block h-px w-5 bg-[#0a0908] transition-opacity duration-200",
                mobileOpen && "opacity-0"
              )}
            />
            <span
              className={cn(
                "block h-px w-5 bg-[#0a0908] transition-transform duration-200",
                mobileOpen && "-translate-y-[3px] -rotate-45"
              )}
            />
          </div>
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="flex flex-col items-center gap-6 px-5 pb-8 pt-4 md:hidden"
          style={{
            background: "rgba(250, 250, 249, 0.95)",
            borderTop: "1px solid rgba(0, 0, 0, 0.04)",
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[16px] text-[#0a0908] transition-opacity hover:opacity-70"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href="http://localhost:3001"
            className="rounded-full px-4 py-2 text-[14px] text-[#0a0908]"
            style={{ border: "1px solid rgba(0, 0, 0, 0.12)" }}
            onClick={() => setMobileOpen(false)}
          >
            Join the waitlist
          </a>
        </div>
      )}
    </header>
  );
}
