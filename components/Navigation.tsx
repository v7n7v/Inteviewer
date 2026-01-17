'use client';

import { useStore } from '@/lib/store';
import type { TabType } from '@/types';

export default function Navigation() {
  const { currentTab, setCurrentTab } = useStore();

  const tabs: { id: TabType; label: string; icon: string; description: string }[] = [
    { id: 'detective', label: 'Detective', icon: '🔍', description: 'CV Intelligence' },
    { id: 'copilot', label: 'Co-Pilot', icon: '🎙️', description: 'Live Interview' },
    { id: 'calibration', label: 'Calibration', icon: '⚖️', description: 'Hybrid Grading' },
    { id: 'analytics', label: 'Analytics', icon: '📊', description: 'Insights Hub' },
  ];

  return (
    <nav className="fixed top-[72px] left-0 right-0 z-40 glass-card border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`
                relative px-6 py-3 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300
                ${currentTab === tab.id 
                  ? 'glass-card bg-cyber-cyan/10 border-cyber-cyan/30 text-white' 
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{tab.icon}</span>
                <div className="text-left">
                  <div className="font-semibold">{tab.label}</div>
                  <div className="text-xs opacity-70">{tab.description}</div>
                </div>
              </div>
              
              {currentTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
