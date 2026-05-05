import { Hero } from "@/sections/Hero"
import { Features } from "@/sections/Features"
import { Showcase } from "@/sections/Showcase"
import { Architecture } from "@/sections/Architecture"
import { TechStack } from "@/sections/TechStack"
import { CallToAction } from "@/sections/CallToAction"
import { SiteFooter } from "@/sections/SiteFooter"
import { SiteNav } from "@/components/SiteNav"

export const App = () => {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 py-16">
        <Hero />
        <Features />
        <Showcase />
        <Architecture />
        <TechStack />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  )
}
