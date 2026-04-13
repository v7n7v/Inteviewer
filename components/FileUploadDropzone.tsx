'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { showToast } from '@/components/Toast';
import { authFetch } from '@/lib/auth-fetch';

const BENEFITS = [
  { icon: 'auto_awesome', text: 'AI morphs resume to match any job', color: '#f59e0b' },
  { icon: 'trending_up', text: 'Boosts ATS score in seconds', color: '#10b981' },
  { icon: 'psychology', text: 'Dual-AI rewrites every bullet point', color: '#06b6d4' },
  { icon: 'download', text: 'Download as Word or PDF instantly', color: '#a855f7' },
];

function BenefitTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % BENEFITS.length), 2500);
    return () => clearInterval(t);
  }, []);
  const b = BENEFITS[idx];
  return (
    <div className="h-7 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-1.5 text-[12px] font-medium"
          style={{ color: b.color }}
        >
          <span className="material-symbols-rounded text-[14px]">{b.icon}</span>
          {b.text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


interface FileUploadDropzoneProps {
  onUploadSuccess: (text: string, fileName: string) => void;
  isUploading: boolean;
  setIsUploading: (state: boolean) => void;
  variant?: 'large' | 'compact';
  processingStage?: 'uploading' | 'extracting' | 'parsing' | null;
  // Props for compact variant (textarea)
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string; // Additional classes for the container
}

export default function FileUploadDropzone({
  onUploadSuccess,
  isUploading,
  setIsUploading,
  variant = 'large',
  processingStage = null,
  value = '',
  onChange = () => {},
  placeholder = 'Paste your text or drop a file...',
  rows = 4,
  className = '',
}: FileUploadDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // 1. Check file size (5MB limit)
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`File is too large! Maximum is ${MAX_SIZE_MB}MB.`, 'cancel');
      return;
    }

    // 2. Check extensions
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const validExtensions = ['.docx', '.doc', '.txt'];
    if (!validExtensions.includes(ext)) {
      showToast('Please upload a Word or TXT file', 'cancel');
      return;
    }

    setIsUploading(true);
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // remove data:mime/type;base64,
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const payload = {
        fileName: file.name,
        fileData
      };

      const res = await authFetch('/api/gauntlet/parse-resume', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });
      
      const { text, fileName } = await res.json();

      if (!text || text.trim().length < 20) {
        throw new Error('Could not extract meaningful text from this file. Try pasting your text instead.');
      }

      onUploadSuccess(text, fileName);
      // Don't setIsUploading(false) here — parent keeps loading state
      // through AI parsing. Parent will reset when fully done.
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast(error.message || 'Failed to process file', 'cancel');
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  if (variant === 'compact') {
    return (
      <div 
        className={`relative ${className}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`w-full p-4 rounded-xl bg-[var(--bg-input)] border focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-dim)] text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none transition-all ${
            dragActive ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border-subtle)]'
          }`}
        />
        <input 
          ref={fileInputRef} 
          type="file" 
          accept=".txt,.docx,.doc" 
          onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} 
          className="hidden" 
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-all border border-[var(--border-subtle)] flex items-center gap-1.5 z-10"
        >
          {isUploading ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-[var(--accent)]"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Parsing...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              Upload File
            </>
          )}
        </button>

        {/* Drag Overlay for visual feedback */}
        <AnimatePresence>
          {dragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 rounded-xl bg-[var(--accent-dim)] backdrop-blur-[2px] border-2 border-[var(--accent)] flex items-center justify-center pointer-events-none"
            >
              <div className="bg-[var(--bg-surface)] px-4 py-2 rounded-lg border border-[var(--accent-hover)] text-[var(--accent)] font-medium flex items-center gap-2 shadow-xl">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3-3 3 3"/></svg>
                Drop to extract text
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Large Variant (Like Liquid Resume)
  return (
    <div className={className}>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
        className="hidden" 
        accept=".docx,.doc,.txt" 
      />
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`py-14 px-8 md:py-16 md:px-16 text-center cursor-pointer transition-all relative overflow-hidden rounded-2xl ${
          dragActive 
            ? 'bg-cyan-500/[0.06]' 
            : 'hover:bg-[var(--bg-hover)]'
        }`}
      >
        {/* Subtle glow effect when dragging */}
        <AnimatePresence>
          {dragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(to top, var(--accent-dim), transparent)' }}
            />
          )}
        </AnimatePresence>

        {isUploading ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-sm mx-auto"
          >
            {/* AI Sparkle Icon from Google */}
            <span className="material-symbols-rounded block text-[48px] mx-auto mb-4 text-[var(--accent)] animate-pulse">
              auto_awesome
            </span>
            <p className="text-xl text-[var(--text-primary)] font-medium mb-1">
              {processingStage === 'parsing' ? 'Parsing with AI...' : processingStage === 'extracting' ? 'Extracting Text...' : 'Uploading File...'}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              {processingStage === 'parsing' ? 'Structuring your resume data' : processingStage === 'extracting' ? 'Reading document contents' : 'Preparing your file'}
            </p>
            {/* Stage indicators */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {['uploading', 'extracting', 'parsing'].map((stage, i) => {
                const stages = ['uploading', 'extracting', 'parsing'];
                const currentIdx = stages.indexOf(processingStage || 'uploading');
                const isDone = i < currentIdx;
                const isActive = i === currentIdx;
                return (
                  <div key={stage} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                      isDone ? 'bg-[var(--accent)] scale-100' : isActive ? 'bg-[var(--accent)] animate-pulse scale-125' : 'bg-[var(--border-subtle)] scale-100'
                    }`} />
                    {i < 2 && <div className={`w-6 h-px transition-colors duration-500 ${isDone ? 'bg-[var(--accent-hover)]' : 'bg-[var(--border-subtle)]'}`} />}
                  </div>
                );
              })}
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: 'var(--accent)' }}
                initial={{ width: '0%' }}
                animate={{
                  width: processingStage === 'parsing' ? '90%' : processingStage === 'extracting' ? '50%' : '20%'
                }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] mt-2 uppercase tracking-wider font-medium">Step {processingStage === 'parsing' ? '3' : processingStage === 'extracting' ? '2' : '1'} of 3</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-10 flex flex-col items-center"
          >
            {/* ── Animated icon with rising particles ── */}
            <div className="relative w-28 h-28 mx-auto mb-5 flex items-center justify-center">

              {/* Breathing ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '1.5px solid rgba(6,182,212,0.25)' }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.15, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Rising sparkle particles — staggered, drift up and fade */}
              {[
                { left: '15%', delay: 0, size: 3 },
                { left: '75%', delay: 1.2, size: 2 },
                { left: '45%', delay: 2.4, size: 4 },
                { left: '85%', delay: 0.8, size: 2.5 },
                { left: '25%', delay: 2, size: 3 },
              ].map((p, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: p.size,
                    height: p.size,
                    left: p.left,
                    bottom: '30%',
                    background: 'rgba(6,182,212,0.6)',
                    boxShadow: '0 0 4px rgba(6,182,212,0.4)',
                  }}
                  animate={{
                    y: [0, -40, -60],
                    opacity: [0, 0.8, 0],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    delay: p.delay,
                    ease: 'easeOut',
                  }}
                />
              ))}

              {/* Center icon with scan line */}
              <motion.div
                className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(59,130,246,0.08) 100%)',
                  border: '1px solid rgba(6,182,212,0.25)',
                  boxShadow: '0 0 20px rgba(6,182,212,0.1)',
                }}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="material-symbols-rounded text-[28px]" style={{ color: '#06b6d4' }}>description</span>

                {/* Scan line — sweeps down periodically */}
                <motion.div
                  className="absolute left-0 right-0 h-[2px] pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.5) 50%, transparent 100%)' }}
                  animate={{ top: ['-10%', '110%'] }}
                  transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
                />
              </motion.div>
            </div>

            {/* ── Copy ── */}
            {dragActive ? (
              <motion.p
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-[17px] font-bold text-cyan-500"
              >
                Release to analyze
              </motion.p>
            ) : (
              <>
                <p className="text-[17px] font-semibold text-[var(--text-primary)] mb-1">
                  Drop your resume here
                </p>
                <p className="text-[13px] text-[var(--text-secondary)] mb-5">
                  or <span className="text-cyan-500 font-medium">click to browse</span> · Word, TXT · Max 5MB
                </p>

                {/* Gentle bouncing CTA */}
                <motion.div
                  animate={{ y: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="mb-4"
                >
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(59,130,246,0.06) 100%)',
                      border: '1px solid rgba(6,182,212,0.2)',
                      color: '#06b6d4',
                    }}
                  >
                    <span className="material-symbols-rounded text-[14px]">upload</span>
                    Start here
                  </div>
                </motion.div>

                {/* Benefit ticker */}
                <BenefitTicker />
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
