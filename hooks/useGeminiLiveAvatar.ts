/**
 * useGeminiLiveAvatar — Extended Gemini Live hook for avatar integration
 * 
 * Inherits all behavior from useGeminiLive but instead of playing audio
 * through AudioContext directly, it forwards raw PCM audio chunks to 
 * TalkingHead's speakAudio() for lip-synced playback.
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';

interface AvatarLiveConfig {
  persona?: string;
  jobDescription?: string;
  interviewStyle?: string;
  avatarMode?: boolean;
}

interface AvatarLiveState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  userTranscript: string;
  aiTranscript: string;
  fullTranscript: Array<{ role: 'user' | 'ai'; text: string }>;
  error: string | null;
  questionCount: number;
  elapsedSeconds: number;
}

type AudioChunkCallback = (base64Pcm: string) => void;
type TurnCompleteCallback = () => void;

const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

export function useGeminiLiveAvatar() {
  const [state, setState] = useState<AvatarLiveState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    isConnecting: false,
    userTranscript: '',
    aiTranscript: '',
    fullTranscript: [],
    error: null,
    questionCount: 0,
    elapsedSeconds: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Callbacks for avatar integration
  const onAudioChunkRef = useRef<AudioChunkCallback | null>(null);
  const onTurnCompleteRef = useRef<TurnCompleteCallback | null>(null);

  // Register callback: called with raw base64 PCM audio for each chunk
  const setOnAudioChunk = useCallback((cb: AudioChunkCallback | null) => {
    onAudioChunkRef.current = cb;
  }, []);

  // Register callback: called when the AI finishes speaking a turn
  const setOnTurnComplete = useCallback((cb: TurnCompleteCallback | null) => {
    onTurnCompleteRef.current = cb;
  }, []);

  useEffect(() => {
    return () => { cleanup(); };
  }, []);

  const connect = useCallback(async (config: AvatarLiveConfig) => {
    setState(s => ({ ...s, isConnecting: true, error: null }));

    try {
      const tokenRes = await authFetch('/api/voice/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, avatarMode: true }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || `Token request failed (${tokenRes.status})`);
      }

      const { token } = await tokenRes.json();
      const ws = new WebSocket(`${GEMINI_WS_URL}?access_token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ setup: {} }));
      };

      ws.binaryType = 'arraybuffer';

      ws.onmessage = async (event) => {
        try {
          let text: string;
          if (typeof event.data === 'string') {
            text = event.data;
          } else if (event.data instanceof Blob) {
            text = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            text = new TextDecoder().decode(event.data);
          } else {
            return;
          }
          if (!text || text.length === 0) return;
          const msg = JSON.parse(text);
          handleServerMessage(msg);
        } catch (e) {
          console.warn('[AvatarLive] Failed to parse message:', e);
        }
      };

      ws.onerror = () => {
        setState(s => ({ ...s, error: 'WebSocket connection error', isConnecting: false }));
      };

      ws.onclose = () => {
        cleanup();
        setState(s => ({
          ...s,
          isConnected: false,
          isListening: false,
          isSpeaking: false,
          isConnecting: false,
        }));
      };

    } catch (error: any) {
      setState(s => ({
        ...s,
        isConnecting: false,
        error: error.message || 'Failed to connect',
      }));
    }
  }, []);

  const handleServerMessage = useCallback((msg: any) => {
    if (msg.setupComplete) {
      setState(s => ({ ...s, isConnected: true, isConnecting: false }));
      startMicCapture();
      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setState(s => ({ ...s, elapsedSeconds: s.elapsedSeconds + 1 }));
      }, 1000);
      return;
    }

    if (msg.serverContent) {
      const sc = msg.serverContent;

      // Forward audio chunks to TalkingHead instead of playing them
      if (sc.modelTurn?.parts) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData?.data) {
            setState(s => ({ ...s, isSpeaking: true }));
            // Forward to avatar for lip-synced playback
            onAudioChunkRef.current?.(part.inlineData.data);
          }
        }
      }

      if (sc.turnComplete) {
        setState(s => ({ ...s, isSpeaking: false }));
        onTurnCompleteRef.current?.();
      }

      // Transcriptions — also track in full transcript
      if (sc.inputTranscription?.text) {
        const text = sc.inputTranscription.text;
        setState(s => ({
          ...s,
          userTranscript: s.userTranscript + text,
          fullTranscript: [...s.fullTranscript, { role: 'user', text }],
        }));
      }

      if (sc.outputTranscription?.text) {
        const text = sc.outputTranscription.text;
        setState(s => ({
          ...s,
          aiTranscript: s.aiTranscript + text,
          fullTranscript: [...s.fullTranscript, { role: 'ai', text }],
          // Rough question counter: increment when AI output contains '?'
          questionCount: text.includes('?') ? s.questionCount + 1 : s.questionCount,
        }));
      }

      if (sc.interrupted) {
        setState(s => ({ ...s, isSpeaking: false }));
      }
    }
  }, []);

  const startMicCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const bufferSize = 4096;
      const scriptNode = ctx.createScriptProcessor(bufferSize, 1, 1);
      scriptNodeRef.current = scriptNode;

      scriptNode.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = float32ToInt16(input);
        const base64 = arrayBufferToBase64(pcm16.buffer as ArrayBuffer);

        wsRef.current.send(JSON.stringify({
          realtimeInput: {
            audio: {
              data: base64,
              mimeType: 'audio/pcm;rate=16000',
            },
          },
        }));
      };

      source.connect(scriptNode);
      scriptNode.connect(ctx.destination);

      setState(s => ({ ...s, isListening: true }));
    } catch {
      setState(s => ({ ...s, error: 'Microphone access denied' }));
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    // Return the full transcript for grading
    const transcript = state.fullTranscript;
    setState({
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      isConnecting: false,
      userTranscript: '',
      aiTranscript: '',
      fullTranscript: [],
      error: null,
      questionCount: 0,
      elapsedSeconds: 0,
    });
    return transcript;
  }, [state.fullTranscript]);

  const getTranscript = useCallback(() => {
    return state.fullTranscript;
  }, [state.fullTranscript]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        },
      }));
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    sendText,
    getTranscript,
    setOnAudioChunk,
    setOnTurnComplete,
  };
}

// ── Helpers ──

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
