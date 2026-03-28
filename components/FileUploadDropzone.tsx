'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { showToast } from '@/components/Toast';
import { authFetch } from '@/lib/auth-fetch';

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
      showToast(`File is too large! Maximum is ${MAX_SIZE_MB}MB.`, '❌');
      return;
    }

    // 2. Check extensions
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const validExtensions = ['.docx', '.doc', '.txt'];
    if (!validExtensions.includes(ext)) {
      showToast('Please upload a Word or TXT file', '❌');
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
      showToast(error.message || 'Failed to process file', '❌');
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
          className={`w-full p-4 rounded-xl bg-[#111] border focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 text-white placeholder-silver/50 resize-none transition-all ${
            dragActive ? 'border-cyan-500/80 bg-cyan-500/5' : 'border-white/10'
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
          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition-all border border-white/10 flex items-center gap-1.5 z-10"
        >
          {isUploading ? '⏳ Parsing...' : '📎 Upload File'}
        </button>

        {/* Drag Overlay for visual feedback */}
        <AnimatePresence>
          {dragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 rounded-xl bg-cyan-500/10 backdrop-blur-[2px] border-2 border-cyan-500/50 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-[var(--theme-bg-card)] px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 font-medium flex items-center gap-2 shadow-xl">
                <span>📄</span> Drop to extract text
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
        className={`p-16 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all relative overflow-hidden ${
          dragActive 
            ? 'border-cyan-500/50 bg-cyan-500/[0.05]' 
            : 'border-white/[0.08] bg-[var(--theme-bg-card)] hover:border-white/[0.15]'
        }`}
      >
        {/* Subtle glow effect when dragging */}
        <AnimatePresence>
          {dragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none"
            />
          )}
        </AnimatePresence>

        {isUploading ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-sm mx-auto"
          >
            <span className="text-6xl block mb-4 animate-pulse">🧠</span>
            <p className="text-xl text-white font-medium mb-1">
              {processingStage === 'parsing' ? 'Parsing with AI...' : processingStage === 'extracting' ? 'Extracting Text...' : 'Uploading File...'}
            </p>
            <p className="text-sm text-silver mb-5">
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
                      isDone ? 'bg-cyan-400 scale-100' : isActive ? 'bg-cyan-400 animate-pulse scale-125' : 'bg-white/10 scale-100'
                    }`} />
                    {i < 2 && <div className={`w-6 h-px transition-colors duration-500 ${isDone ? 'bg-cyan-400/50' : 'bg-white/10'}`} />}
                  </div>
                );
              })}
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                initial={{ width: '0%' }}
                animate={{
                  width: processingStage === 'parsing' ? '90%' : processingStage === 'extracting' ? '50%' : '20%'
                }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-wider font-medium">Step {processingStage === 'parsing' ? '3' : processingStage === 'extracting' ? '2' : '1'} of 3</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-10"
          >
            <span className={`text-6xl block mb-4 transition-transform ${dragActive ? 'scale-110' : ''}`}>📄</span>
            <p className="text-xl text-white mb-2 font-medium">
              {dragActive ? 'Drop it here!' : 'Drop your file here'}
            </p>
            <p className="text-silver">or click to browse (Word, TXT, max 5MB)</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
