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
    <div className="flex flex-col items-center justify-center bg-[#101010] px-4 sm:px-8 lg:px-16 relative">
        {/* Sideways scroll indicator */}
        <div className="fixed bottom-8 right-10 z-50 hidden lg:flex items-center gap-3 rotate-90 origin-bottom-right text-white/30 text-xs tracking-[0.3em] uppercase select-none pointer-events-none">
            <span>&copy; {new Date().getFullYear()} STELLARSTACK</span>
        </div>
        <div className="w-full h-full border-l border-r border-white/20">
            <Header/>
            <Hero/>
            <Grid/>
            <LineSpacer/>
            <OverviewShowcase/>
            <FilesShowcase/>
            <SchedulesShowcase/>
            <LineSpacer/>
            <DesktopShowcase/>
            <LineSpacer/>
            <Features/>
            <Stats/>
            <LineSpacer/>
            <Comparison/>
            <FAQAndCTA/>
            <Footer/>
        </div>
    </div>
    );
}
export default page;