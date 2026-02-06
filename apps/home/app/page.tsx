import Header from "@/app/components/Header/Header";
import Hero from "@/app/components/Hero/Hero";
import Grid from "@/app/components/Grid/Grid";
import Features from "@/app/components/Features/Features";
import Stats from "@/app/components/Stats/Stats";
import Comparison from "@/app/components/Comparison/Comparison";
import Community from "@/app/components/Community/Community";
import FAQAndCTA from "@/app/components/FAQAndCTA/FAQAndCTA";
import LineSpacer from "@/app/components/LineSpacer/LineSpacer";
import Footer from "@/app/components/Footer/Footer";

const page = () => {
  return (
    <div className="flex flex-col items-center justify-center bg-[#101010] px-4 sm:px-8 lg:px-16">
        <div className="w-full h-full border-l border-r border-white/20">
            <Header/>
            <Hero/>
            <Grid/>
            <Features/>
            <Stats/>
            <Comparison/>
            <Community/>
            <FAQAndCTA/>
            <LineSpacer/>
            <Footer/>
        </div>
    </div>
    );
}
export default page;