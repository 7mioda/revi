import Image from "next/image";

export function Navbar() {
  return (
    <header className="fixed top-0 z-50 w-full">
      <nav className="mx-auto flex max-w-[1200px] items-center px-5 py-3">
        <a href="http://localhost:3001" className="flex items-center">
          <Image
            src="/logo-revi.svg"
            alt="Revi"
            width={32}
            height={32}
            className="h-8 w-8"
          />
        </a>
      </nav>
    </header>
  );
}
