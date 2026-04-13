'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

// Lazy-load the HeroSection since it's 103KB of animation goodness
const HeroSection = dynamic(() => import('@/components/HeroSection'), {
  loading: () => (
    <div className="flex items-center justify-center h-[400px]">
      <div className="scanning-loader" />
    </div>
  ),
  ssr: false,
});

// Lazy-load AnimatedShimmerBackground
const AnimatedShimmerBackground = dynamic(
  () => import('@/components/AnimatedShimmerBackground').then(m => ({ default: m.AnimatedShimmerBackground })),
  { ssr: false }
);

const animations = [
  {
    id: 'hero',
    name: 'Hero Landing Experience',
    description: 'Full cinematic landing page with scroll-driven reveals, orbital talent constellation, live AI terminal, workflow animations, and the process carousel.',
    size: '103 KB',
    tech: 'Framer Motion, requestAnimationFrame, AnimatePresence',
  },
  {
    id: 'shimmer',
    name: 'Animated Shimmer Background',
    description: 'Ambient mesh gradient background with floating orbs and subtle light effects. Used as a canvas backdrop.',
    size: '3.6 KB',
    tech: 'CSS Keyframes, Radial Gradients',
  },
];

export default function GalleryPage() {
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-8 pl-12 lg:pl-0">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#e3e3e3]">
          Product Gallery
        </h1>
        <p className="text-[13px] text-[#8e918f] mt-1">
          Archived animations and cinematic UI components. These are the original handcrafted interactions built for Talent Consulting.
        </p>
      </div>

      {/* Animation cards */}
      <div className="space-y-4">
        {animations.map((anim) => (
          <div key={anim.id} className="rounded-xl border border-[#2d2d2f] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#131314]">
              <div>
                <h3 className="text-sm font-medium text-[#e3e3e3]">{anim.name}</h3>
                <p className="text-[12px] text-[#8e918f] mt-0.5">{anim.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-[#5f6368] block">{anim.size}</span>
                  <span className="text-[10px] text-[#5f6368] block">{anim.tech}</span>
                </div>
                <button
                  onClick={() => setActiveDemo(activeDemo === anim.id ? null : anim.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-100 ${
                    activeDemo === anim.id
                      ? 'bg-[#a8c7fa] text-[#0b0b0b]'
                      : 'border border-[#444746] text-[#8e918f] hover:border-[#a8c7fa] hover:text-[#a8c7fa]'
                  }`}
                >
                  {activeDemo === anim.id ? 'Hide' : 'Preview'}
                </button>
              </div>
            </div>

            {/* Demo area */}
            {activeDemo === anim.id && (
              <div className="border-t border-[#2d2d2f] bg-[#0b0b0b]">
                {anim.id === 'hero' && (
                  <div className="relative overflow-hidden">
                    {/* Wrap in a scaled container */}
                    <div className="origin-top-left">
                      <HeroSection
                        onGetStarted={() => {}}
                        onShowLogin={() => {}}
                        onShowSignup={() => {}}
                        isAuthenticated={false}
                      />
                    </div>
                  </div>
                )}
                {anim.id === 'shimmer' && (
                  <div className="relative h-[400px] overflow-hidden rounded-b-xl">
                    <AnimatedShimmerBackground />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-[#8e918f]">Ambient Shimmer Background</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Component list */}
      <div className="mt-10 rounded-xl border border-[#2d2d2f] bg-[#131314] p-5">
        <h2 className="text-sm font-medium text-[#e3e3e3] mb-4">All Archived Components</h2>
        <div className="space-y-2">
          {[
            { name: 'WorkflowAnimation', desc: '4-step resume morph pipeline with progress bars and step-specific panels' },
            { name: 'DualAIAnimation', desc: '6-stage dual-AI enhance pipeline (Check → GPT → Gemini → Fix → Cover Letter → Done)' },
            { name: 'ProcessCarousel', desc: 'Auto-cycling horizontal showcase wrapping WorkflowAnimation and DualAIAnimation' },
            { name: 'TalentConstellation', desc: 'Orbital animation with 12 skill nodes rotating on requestAnimationFrame' },
            { name: 'LiveTerminal', desc: 'AI terminal with 3 cycling command sequences and typewriter effects' },
            { name: 'AnimatedShimmerBackground', desc: 'Ambient canvas background with floating orbs and mesh gradient' },
            { name: 'ThemeTransition', desc: 'Cinematic theme toggle with morphing transitions' },
            { name: 'PageTransition', desc: 'Route transition wrapper with fade/slide effects' },
            { name: 'Confetti', desc: 'Celebration particle effect for achievements' },
            { name: 'SlidingTips', desc: 'Auto-cycling tip carousel for dashboard' },
          ].map((comp) => (
            <div key={comp.name} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[#1f1f21] transition-colors duration-100">
              <code className="text-[12px] font-mono text-[#a8c7fa] shrink-0 mt-0.5">{comp.name}</code>
              <span className="text-[12px] text-[#8e918f]">{comp.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
