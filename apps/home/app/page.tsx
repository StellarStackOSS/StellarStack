import Header from "@/app/components/Header/Header";
import Hero from "@/app/components/Hero/Hero";
import Grid from "@/app/components/Grid/Grid";
import OverviewShowcase from "@/app/components/Showcases/OverviewShowcase";
import FilesShowcase from "@/app/components/Showcases/FilesShowcase";
import SchedulesShowcase from "@/app/components/Showcases/SchedulesShowcase";
import DesktopShowcase from "@/app/components/Showcases/DesktopShowcase";
import Features from "@/app/components/Features/Features";
import Stats from "@/app/components/Stats/Stats";
import Comparison from "@/app/components/Comparison/Comparison";

import FAQAndCTA from "@/app/components/FAQAndCTA/FAQAndCTA";
import LineSpacer from "@/app/components/LineSpacer/LineSpacer";
import Footer from "@/app/components/Footer/Footer";

const page = () => {
  return (
    <div className="relative flex flex-col items-center justify-center bg-[#101010] px-4 sm:px-8 lg:px-16">
      {/* Sideways scroll indicator */}
      <div className="pointer-events-none fixed right-10 bottom-8 z-50 hidden origin-bottom-right rotate-90 items-center gap-3 text-xs tracking-[0.3em] text-white/30 uppercase select-none lg:flex">
        <span>&copy; {new Date().getFullYear()} STELLARSTACK</span>
      </div>
      <div className="h-full w-full border-r border-l border-white/20">
        <Header />
        <Hero />
        <Grid />
        <LineSpacer />
        <OverviewShowcase />
        <FilesShowcase />
        <SchedulesShowcase />
        <LineSpacer />
        <DesktopShowcase />
        <LineSpacer />
        <Features />
        <Stats />
        <LineSpacer />
        <Comparison />
        <FAQAndCTA />
        <Footer />
      </div>
    </div>
  );
};
export default page;
