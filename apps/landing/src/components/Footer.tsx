import Image from "next/image";

const footerLinks = [
  {
    group: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
    ],
  },
  {
    group: "Company",
    links: [{ label: "Blog", href: "#news" }],
  },
  {
    group: "Contact",
    links: [
      { label: "Twitter / X", href: "https://x.com/getlyse" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="w-full" style={{ backgroundColor: "#0a0908" }}>
      <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}>
        <div className="mx-auto max-w-[1200px] px-5 py-10 md:py-12">
          {/* Main row */}
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2">
              <Image
                src="/images/lyse-icon.svg"
                alt="Lyse"
                width={24}
                height={24}
                className="h-6 w-6"
              />
              <span className="text-[14px] font-semibold text-white">
                Lyse
              </span>
            </a>

            {/* Link groups */}
            <div className="flex flex-wrap gap-10 md:gap-16">
              {footerLinks.map((group) => (
                <div key={group.group} className="flex flex-col gap-3">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(255, 255, 255, 0.3)" }}
                  >
                    {group.group}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-[14px] transition-colors duration-150 hover:text-white"
                          style={{ color: "rgba(255, 255, 255, 0.5)" }}
                          {...(link.href.startsWith("http")
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div
            className="mt-10 flex flex-col gap-4 pt-8 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
          >
            <p
              className="text-[13px]"
              style={{ color: "rgba(255, 255, 255, 0.35)" }}
            >
              &copy; {new Date().getFullYear()} Lyse. All rights reserved.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-4">
              <a
                href="https://x.com/getlyse"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="transition-colors duration-150 hover:text-white"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
