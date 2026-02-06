import React from "react";
import {SiDiscord, SiGithub, SiMintlify} from "react-icons/si";
import Link from "next/link";
import {cn} from "@stellarUI/lib/utils";

const Header = () => {
    return (
        <div className="flex w-full relative z-20 bg-[#101010] h-16 relative text-white border-white/20 border-b items-center justify-between px-4">
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
            <div className="hidden md:flex flex-row gap-8 items-center text-sm">
                <Link href="/features" className="opacity-70 hover:opacity-100 transition-opacity">
                    Features
                </Link>
                <Link href="/roadmap" className="opacity-70 hover:opacity-100 transition-opacity">
                    Roadmap
                </Link>
                <Link href="/changelog" className="opacity-70 hover:opacity-100 transition-opacity">
                    Changelog
                </Link>
            </div>
            <div className="flex flex-row gap-5 items-center">
                <a href="https://mintlify.com" target="_blank" rel="noopener noreferrer">
                    <SiMintlify size="20" className="opacity-50 duration-300 hover:opacity-100 transiton-all cursor-pointer"/>
                </a>
                <a href="https://discord.gg/stellarstack" target="_blank" rel="noopener noreferrer">
                    <SiDiscord size="20" className="opacity-50 duration-300 hover:opacity-100 transiton-all cursor-pointer"/>
                </a>
                <a href="https://github.com/StellarStackOSS/StellarStack" target="_blank" rel="noopener noreferrer">
                    <SiGithub size="20" className="opacity-50 duration-300 hover:opacity-100 transiton-all cursor-pointer"/>
                </a>
            </div>
        </div>
    )
}
export default Header;