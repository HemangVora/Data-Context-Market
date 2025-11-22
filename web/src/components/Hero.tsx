"use client";

import { motion } from "framer-motion";
import { ArrowRight, Database, Bot, Coins, Sparkles } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Spotlight } from "@/components/ui/spotlight-new";

export function Hero() {
  return (
    // CHANGED: Deep black bg with very subtle radial gradient at bottom
    <section className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#020202] overflow-hidden pt-20">
      {/* Spotlight Effect - Silver/White Tone */}
      <Spotlight />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <div className="p-4 max-w-7xl mx-auto relative z-10 w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          {/* Pill Badge: Thinner, Classier */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl text-neutral-300 text-xs font-medium mb-8 hover:bg-white/[0.05] transition-colors cursor-pointer">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
            <span>Live on Sepolia Testnet</span>
          </div>

          {/* Headline: Tighter Tracking, Silver Gradient */}
          <h1 className="text-5xl md:text-8xl font-bold tracking-tighter text-center bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-neutral-500 mb-6">
            Decentralized Data for <br />
            <span className="text-indigo-200/50">AI Agents & Humans</span>
          </h1>

          <p className="mt-4 font-light text-lg text-neutral-400 max-w-xl text-center mx-auto mb-12 leading-relaxed">
            Monetize your datasets securely via smart contracts. Enable AI
            agents to autonomously purchase and access data through our
            MCP-compatible protocol.
          </p>

          {/* Buttons: Minimalist Glass Style */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="group relative w-full sm:w-auto px-8 py-3.5 rounded-full bg-white text-black font-semibold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2">
              Explore Marketplace
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-transparent border border-white/10 text-neutral-300 font-medium hover:bg-white/5 transition-all backdrop-blur-sm">
              Read Documentation
            </button>
          </div>
        </motion.div>

        {/* Feature Cards: Darker, cleaner borders */}
        <div className="grid md:grid-cols-3 gap-6 mt-32 text-left">
          {[
            {
              icon: Database,
              title: "Tokenized Data",
              desc: "Securely host and tokenize high-quality datasets.",
            },
            {
              icon: Bot,
              title: "AI Native Protocol",
              desc: "Agents autonomously negotiate and purchase data.",
            },
            {
              icon: Coins,
              title: "Instant Settlement",
              desc: "Smart contracts ensure instant payment on access.",
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="relative h-full group"
            >
              <div className="relative h-full rounded-3xl border border-white/5 bg-white/[0.02] p-1">
                {/* Glowing Effect Component goes here */}
                <GlowingEffect
                  spread={40}
                  glow={true}
                  disabled={false}
                  proximity={64}
                  inactiveZone={0.01}
                  borderWidth={1}
                />

                <div className="relative h-full rounded-[20px] bg-[#0a0a0a] p-8 overflow-hidden transition-colors group-hover:bg-[#0f0f0f]">
                  <div className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center mb-6 text-white">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-neutral-500 text-sm leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
