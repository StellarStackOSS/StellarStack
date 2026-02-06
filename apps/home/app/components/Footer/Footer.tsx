"use client";

import Link from "next/link";
import { cn } from "@stellarUI/lib/utils";
import { BsDiscord, BsGithub, BsTwitterX } from "react-icons/bs";
import LightBoard from "@stellarUI/components/LightBoard/LightBoard";

interface FooterProps {}

const footerLinks = {
  product: [
    { name: "Features", href: "/" },
    { name: "Changelog", href: "/" },
    { name: "Roadmap", href: "/" },
  ],
  resources: [
    { name: "Documentation", href: "https://docs.stellarstack.app" },
    { name: "API Reference", href: "https://api-docs.stellarstack.app" },
    { name: "Demo", href: "https://demo.stellarstack.app" },
    { name: "Community", href: "https://discord.stellarstack.app" },
  ],
  company: [
    { name: "About", href: "/" },
    { name: "Careers", href: "/" },
    { name: "Contact", href: "mailto:hello@stellarstack.app" },
  ],
};

export const Footer = ({}: FooterProps) => {
  return (
    <footer className={cn("relative overflow-hidden border-t", "border-white/20 bg-[#101010]")}>
      <LightBoard gap={2} text="STELLARSTACK" font="default" updateInterval={300000} rows={7} />
      {/* Main Footer Content */}
      <div className="mx-auto w-full px-16 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link
              href="/apps/home/public"
              className={cn(
                "mb-4 block flex flex-row items-center gap-2 text-lg font-light tracking-[0.2em]",
                "text-white"
              )}
            >
              <img src="/logo.png" className="-ml-2 w-10 p-0" />
              STELLARSTACK
            </Link>
            <p className={cn("mb-6 text-sm", "text-white/60")}>
              Open-source game server management for the modern era.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/StellarStackOSS/StellarStack"
                target="_blank"
                rel="noopener noreferrer"
                className={cn("transition-colors", "text-white/60 hover:text-white")}
              >
                <BsGithub className="h-5 w-5" />
              </a>
              <a
                href="https://discord.stellarstack.app"
                target="_blank"
                rel="noopener noreferrer"
                className={cn("transition-colors", "text-white/60 hover:text-white")}
              >
                <BsDiscord className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com/stellarstack"
                target="_blank"
                rel="noopener noreferrer"
                className={cn("transition-colors", "text-white/60 hover:text-white")}
              >
                <BsTwitterX className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4
              className={cn("mb-4 text-xs font-medium tracking-wider uppercase", "text-white/80")}
            >
              Product
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn("text-sm transition-colors", "text-white/60 hover:text-white")}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4
              className={cn("mb-4 text-xs font-medium tracking-wider uppercase", "text-white/80")}
            >
              Resources
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className={cn("text-sm transition-colors", "text-white/60 hover:text-white")}
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4
              className={cn("mb-4 text-xs font-medium tracking-wider uppercase", "text-white/80")}
            >
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className={cn("text-sm transition-colors", "text-white/60 hover:text-white")}
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className={cn(
            "mt-16 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row",
            "border-white/20"
          )}
        >
          <p className={cn("text-xs", "text-white/40")}>
            &copy; {new Date().getFullYear()} StellarStack. Open source under MIT License.
          </p>
          <div className="flex items-center gap-6">
            {["Privacy", "Terms", "License"].map((item) => (
              <a
                key={item}
                href="#"
                className={cn("text-xs transition-colors", "text-white/40 hover:text-white/60")}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
