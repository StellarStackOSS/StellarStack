import React from "react";
import { SiDiscord, SiGitlab, SiMintlify } from "react-icons/si";
import Link from "next/link";
import { cn } from "@stellarUI/lib/Utils";

const Header = () => {
  return (
    <div className="relative z-20 flex h-16 w-full items-center justify-between border-b border-white/20 bg-[#101010] px-4 text-white">
      <Link
        href="/"
        className={cn(
          "flex flex-row items-center gap-2 text-lg font-light tracking-[0.2em]",
          "text-white"
        )}
      >
        <img src="/logo.png" className="-ml-2 w-10 p-0" />
        STELLARSTACK
      </Link>
      <div className="hidden flex-row items-center gap-8 text-sm md:flex">
        <Link href="/features" className="opacity-70 transition-opacity hover:opacity-100">
          Features
        </Link>
        <Link href="/roadmap" className="opacity-70 transition-opacity hover:opacity-100">
          Roadmap
        </Link>
        <Link href="/changelog" className="opacity-70 transition-opacity hover:opacity-100">
          Changelog
        </Link>
      </div>
      <div className="flex flex-row items-center gap-5">
        <a href="https://mintlify.com" target="_blank" rel="noopener noreferrer">
          <SiMintlify
            size="20"
            className="transiton-all cursor-pointer opacity-50 duration-300 hover:opacity-100"
          />
        </a>
        <a href="https://discord.gg/stellarstack" target="_blank" rel="noopener noreferrer">
          <SiDiscord
            size="20"
            className="transiton-all cursor-pointer opacity-50 duration-300 hover:opacity-100"
          />
        </a>
        <a
          href="https://gitlab.com/StellarStackOSS/stellarstack"
          target="_blank"
          rel="noopener noreferrer"
        >
          <SiGitlab
            size="20"
            className="transiton-all cursor-pointer opacity-50 duration-300 hover:opacity-100"
          />
        </a>
      </div>
    </div>
  );
};
export default Header;
