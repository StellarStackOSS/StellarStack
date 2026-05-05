import { CallToAction } from "@/sections/CallToAction"
import { Faq } from "@/sections/Faq"
import { Features } from "@/sections/Features"
import { Hero } from "@/sections/Hero"
import { HowItWorks } from "@/sections/HowItWorks"
import { SiteFooter } from "@/sections/SiteFooter"
import { SiteNav } from "@/components/SiteNav"

export const App = () => {
  return (
    <div className="dark min-h-screen bg-black text-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <Hero />
        <HowItWorks />
        <Features />
        <Faq />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  )
}
