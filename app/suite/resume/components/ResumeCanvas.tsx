'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Resume } from '@/lib/ai/resume-morpher';

interface ResumeCanvasProps {
  resume: Resume;
  mode: 'technical' | 'leadership';
  matchScore?: number;
  highlightedSkills?: string[];
  onResumeChange: (resume: Resume) => void;
}

export default function ResumeCanvas({
  resume,
  mode,
  matchScore,
  highlightedSkills = [],
  onResumeChange,
}: ResumeCanvasProps) {
  
  const updateField = (path: string[], value: any) => {
    const newResume = { ...resume };
    let current: any = newResume;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    
    onResumeChange(newResume);
  };

  return (
    <motion.div
      layout
      className="relative"
      style={{
        perspective: '1000px',
      }}
    >
      {/* Match Score Badge */}
      <AnimatePresence>
        {matchScore !== undefined && matchScore > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="absolute -top-4 -right-4 z-10"
          >
            <div
              className="px-6 py-3 rounded-2xl border-2 font-bold text-lg shadow-lg"
              style={{
                background: matchScore >= 80 ? 'linear-gradient(135deg, #00ff88, #00f5ff)' :
                           matchScore >= 60 ? 'linear-gradient(135deg, #00f5ff, #bf00ff)' :
                           'linear-gradient(135deg, #bf00ff, #ff0055)',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                color: '#000',
              }}
            >
              {matchScore}% Match
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ghost Paper Resume */}
      <motion.div
        layout
        className="glass-card p-8 md:p-12 bg-white/5 border-white/20"
        style={{
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: '0 8px 32px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Personal Info */}
        <div className="mb-8 pb-6 border-b border-white/10">
          <input
            type="text"
            value={resume.personal.name}
            onChange={(e) => updateField(['personal', 'name'], e.target.value)}
            className="text-4xl font-bold text-white bg-transparent border-none outline-none w-full mb-2"
            placeholder="Your Name"
          />
          <input
            type="text"
            value={resume.personal.title}
            onChange={(e) => updateField(['personal', 'title'], e.target.value)}
            className="text-xl text-cyan-400 bg-transparent border-none outline-none w-full mb-4"
            placeholder="Your Title"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-300">
            <input
              type="email"
              value={resume.personal.email}
              onChange={(e) => updateField(['personal', 'email'], e.target.value)}
              className="bg-transparent border-none outline-none"
              placeholder="email@example.com"
            />
            <input
              type="tel"
              value={resume.personal.phone}
              onChange={(e) => updateField(['personal', 'phone'], e.target.value)}
              className="bg-transparent border-none outline-none"
              placeholder="+1 (555) 000-0000"
            />
            <input
              type="text"
              value={resume.personal.location}
              onChange={(e) => updateField(['personal', 'location'], e.target.value)}
              className="bg-transparent border-none outline-none"
              placeholder="City, State"
            />
          </div>
        </div>

        {/* Professional Summary */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`summary-${mode}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="mb-8"
          >
            <h2 className="text-lg font-bold text-white mb-3">
              {mode === 'technical' ? '🔧 Technical Summary' : '🎯 Leadership Profile'}
            </h2>
            <textarea
              value={resume.personal.summary}
              onChange={(e) => updateField(['personal', 'summary'], e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-slate-200 outline-none focus:border-cyan-400/50 transition-colors resize-none"
              rows={4}
              placeholder={mode === 'technical' 
                ? "Highlight your technical expertise, key achievements, and specializations..."
                : "Emphasize leadership experience, team management, and strategic impact..."
              }
            />
          </motion.div>
        </AnimatePresence>

        {/* Skills */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-3">💡 Skills</h2>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  highlightedSkills.includes(skill)
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                    : 'bg-white/5 text-slate-300 border border-white/10'
                }`}
              >
                {skill}
                <button
                  onClick={() => {
                    const newSkills = resume.skills.filter((_, i) => i !== index);
                    updateField(['skills'], newSkills);
                  }}
                  className="ml-2 text-xs opacity-50 hover:opacity-100"
                >
                  ✕
                </button>
              </motion.span>
            ))}
            <button
              onClick={() => {
                const newSkill = prompt('Enter skill name:');
                if (newSkill) {
                  updateField(['skills'], [...resume.skills, newSkill]);
                }
              }}
              className="px-4 py-2 rounded-lg text-sm border-2 border-dashed border-white/20 text-slate-400 hover:border-cyan-400/50 hover:text-cyan-400 transition-colors"
            >
              + Add Skill
            </button>
          </div>
        </div>

        {/* Experience */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`experience-${mode}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8"
          >
            <h2 className="text-lg font-bold text-white mb-4">
              {mode === 'technical' ? '⚙️ Technical Experience' : '👥 Leadership Experience'}
            </h2>
            {resume.experience.map((exp, index) => (
              <div key={index} className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <input
                  type="text"
                  value={exp.title}
                  onChange={(e) => {
                    const newExperience = [...resume.experience];
                    newExperience[index].title = e.target.value;
                    updateField(['experience'], newExperience);
                  }}
                  className="text-lg font-semibold text-white bg-transparent border-none outline-none w-full mb-2"
                  placeholder="Job Title / Project Name"
                />
                <ul className="space-y-2 ml-4">
                  {exp.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="text-slate-300 text-sm list-disc">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const newExperience = [...resume.experience];
                          newExperience[index].items[itemIndex] = e.target.value;
                          updateField(['experience'], newExperience);
                        }}
                        className="bg-transparent border-none outline-none w-full"
                        placeholder="Achievement or responsibility..."
                      />
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    const newExperience = [...resume.experience];
                    newExperience[index].items.push('');
                    updateField(['experience'], newExperience);
                  }}
                  className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  + Add bullet point
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                updateField(['experience'], [...resume.experience, { title: '', items: [''] }]);
              }}
              className="btn-secondary w-full"
            >
              + Add Experience
            </button>
          </motion.div>
        </AnimatePresence>

        {/* Education */}
        <div>
          <h2 className="text-lg font-bold text-white mb-3">🎓 Education</h2>
          {resume.education.map((edu, index) => (
            <div key={index} className="mb-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <input
                type="text"
                value={edu.title}
                onChange={(e) => {
                  const newEducation = [...resume.education];
                  newEducation[index].title = e.target.value;
                  updateField(['education'], newEducation);
                }}
                className="text-white bg-transparent border-none outline-none w-full font-semibold"
                placeholder="Degree / Certification"
              />
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
