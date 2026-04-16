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
        background: "rgba(10, 9, 8, 0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3">
        {/* Logo */}
        <a href="/" className="flex items-center">
          <Image
            src="/images/lyse-wordmark.svg"
            alt="Lyse"
            width={60}
            height={18}
            className="h-[18px] w-auto"
          />
        </a>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[14px] text-white transition-opacity duration-150 hover:opacity-70"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <a
          href="#waitlist"
          className="hidden text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-70 md:inline-flex"
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
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
                "block h-px w-5 bg-white transition-transform duration-200",
                mobileOpen && "translate-y-[3px] rotate-45"
              )}
            />
            <span
              className={cn(
                "block h-px w-5 bg-white transition-opacity duration-200",
                mobileOpen && "opacity-0"
              )}
            />
            <span
              className={cn(
                "block h-px w-5 bg-white transition-transform duration-200",
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
            background: "rgba(10, 9, 8, 0.95)",
            borderTop: "1px solid rgba(255, 255, 255, 0.04)",
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[16px] text-white transition-opacity hover:opacity-70"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#waitlist"
            className="rounded-full px-4 py-2 text-[14px] text-white"
            style={{ border: "1px solid rgba(255, 255, 255, 0.12)" }}
            onClick={() => setMobileOpen(false)}
          >
            Join the waitlist
          </a>
        </div>
      )}
    </header>
  );
}
