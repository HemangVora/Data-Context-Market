import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Marketplace } from "@/components/Marketplace";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      <Navbar />
      <Hero />
      <Marketplace />
      <Footer />
    </main>
  );
}
