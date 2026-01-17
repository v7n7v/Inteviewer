'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface SkillData {
  skill: string;
  category: string;
  level: number;
}

interface SkillGraphProps {
  skills: SkillData[];
  highlightedSkills?: string[];
}

export default function SkillGraph({ skills, highlightedSkills = [] }: SkillGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || skills.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Group skills by category
    const categories = Array.from(new Set(skills.map(s => s.category)));
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(centerX, centerY) - 60;

    // Draw connections and nodes
    skills.forEach((skill, index) => {
      const categoryIndex = categories.indexOf(skill.category);
      const angle = (categoryIndex / categories.length) * Math.PI * 2 - Math.PI / 2;
      const levelFactor = skill.level / 10;
      const x = centerX + Math.cos(angle) * radius * levelFactor;
      const y = centerY + Math.sin(angle) * radius * levelFactor;

      // Draw connection to center
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      const isHighlighted = highlightedSkills.includes(skill.skill);
      ctx.strokeStyle = isHighlighted ? '#00f5ff' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.stroke();

      // Draw node
      ctx.beginPath();
      ctx.arc(x, y, isHighlighted ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isHighlighted ? '#00f5ff' : `rgba(${
        categoryIndex === 0 ? '0, 245, 255' :
        categoryIndex === 1 ? '191, 0, 255' :
        categoryIndex === 2 ? '0, 255, 136' :
        '255, 255, 255'
      }, 0.6)`;
      ctx.fill();

      // Draw label
      ctx.fillStyle = isHighlighted ? '#00f5ff' : 'rgba(255, 255, 255, 0.7)';
      ctx.font = isHighlighted ? 'bold 12px Inter' : '11px Inter';
      ctx.textAlign = x > centerX ? 'left' : 'right';
      ctx.fillText(skill.skill, x + (x > centerX ? 12 : -12), y + 4);
    });

    // Draw category labels
    categories.forEach((category, index) => {
      const angle = (index / categories.length) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (radius + 30);
      const y = centerY + Math.sin(angle) * (radius + 30);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 13px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(category, x, y);
    });

  }, [skills, highlightedSkills]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-6 bg-black/20"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Skill Graph</h3>
        <button
          onClick={() => {
            // Export as SVG functionality could be added here
            alert('Export feature coming soon!');
          }}
          className="btn-secondary text-sm"
        >
          Export SVG
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-96 rounded-xl"
        style={{ maxHeight: '400px' }}
      />

      <div className="mt-4 flex flex-wrap gap-3">
        {Array.from(new Set(skills.map(s => s.category))).map((category, index) => (
          <div key={category} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: index === 0 ? '#00f5ff' :
                           index === 1 ? '#bf00ff' :
                           index === 2 ? '#00ff88' :
                           '#ffffff',
              }}
            />
            <span className="text-sm text-slate-400">{category}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
