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
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt'];
    if (!validExtensions.includes(ext)) {
      showToast('Please upload PDF, Word, or TXT file', '❌');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/api/gauntlet/parse-resume', { method: 'POST', body: formData });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Parse failed' }));
        throw new Error(err.error || 'Failed to extract text from file');
      }
      
      const { text, fileName } = await res.json();

      if (!text || text.trim().length < 20) {
        throw new Error('Could not extract meaningful text from this file. Try pasting your text instead.');
      }

      onUploadSuccess(text, fileName);
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast(error.message || 'Failed to process file', '❌');
    } finally {
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
          accept=".pdf,.txt,.docx,.doc" 
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
              <div className="bg-[#0A0A0A] px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 font-medium flex items-center gap-2 shadow-xl">
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
        accept=".pdf,.docx,.doc,.txt" 
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
            : 'border-white/[0.08] bg-[#0A0A0A] hover:border-white/[0.15]'
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
            className="relative z-10"
          >
            <span className="text-6xl block mb-4 animate-pulse">🧠</span>
            <p className="text-xl text-white font-medium">Processing File...</p>
            <p className="text-sm text-silver mt-2">Extracting and structuring text</p>
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
            <p className="text-silver">or click to browse (PDF, Word, TXT, max 5MB)</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
