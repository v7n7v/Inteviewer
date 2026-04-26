/**
 * useGeminiLive — React hook for Gemini Live API WebSocket sessions
 * 
 * Handles: ephemeral token fetching, WebSocket lifecycle, mic capture (PCM 16kHz),
 * audio playback (PCM 24kHz via AudioContext), transcription events, interruption.
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';

interface GeminiLiveConfig {
  persona?: string;
  jobDescription?: string;
  interviewStyle?: string;
}

interface GeminiLiveState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  userTranscript: string;
  aiTranscript: string;
  fullConversation: Array<{ role: 'user' | 'ai'; text: string }>;
  error: string | null;
}

const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

export function useGeminiLive() {
  const [state, setState] = useState<GeminiLiveState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    isConnecting: false,
    userTranscript: '',
    aiTranscript: '',
    fullConversation: [],
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = useCallback(async (config: GeminiLiveConfig) => {
    setState(s => ({ ...s, isConnecting: true, error: null }));

    try {
      // 1. Get ephemeral token from our backend
      const tokenRes = await authFetch('/api/voice/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(err.error || 'Failed to get live session token');
      }

      const { token } = await tokenRes.json();

      // 2. Open WebSocket to Gemini
      const ws = new WebSocket(`${GEMINI_WS_URL}?access_token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[GeminiLive] WebSocket connected');
        setState(s => ({ ...s, isConnected: true, isConnecting: false }));
        // Setup message is already locked into the ephemeral token constraints
        // Just send an empty setup to start the session
        ws.send(JSON.stringify({ setup: {} }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      };

      ws.onerror = (error) => {
        console.error('[GeminiLive] WebSocket error:', error);
        setState(s => ({ ...s, error: 'Connection error', isConnecting: false }));
      };

      ws.onclose = (event) => {
        console.log('[GeminiLive] WebSocket closed:', event.code, event.reason);
        cleanup();
        setState(s => ({
          ...s,
          isConnected: false,
          isListening: false,
          isSpeaking: false,
          isConnecting: false,
        }));
      };

      // 3. Start mic capture
      await startMicCapture();

    } catch (error: any) {
      console.error('[GeminiLive] Connect error:', error);
      setState(s => ({
        ...s,
        isConnecting: false,
        error: error.message || 'Failed to connect',
      }));
    }
  }, []);

  const handleServerMessage = useCallback((msg: any) => {
    // Setup complete
    if (msg.setupComplete) {
      console.log('[GeminiLive] Setup complete');
      return;
    }

    // Server content (audio, transcriptions)
    if (msg.serverContent) {
      const sc = msg.serverContent;

      // Audio data from model
      if (sc.modelTurn?.parts) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData?.data) {
            setState(s => ({ ...s, isSpeaking: true }));
            playAudioChunk(part.inlineData.data);
          }
        }
      }

      // Turn complete
      if (sc.turnComplete) {
        setState(s => ({ ...s, isSpeaking: false }));
      }

      // Input transcription (what the user said)
      if (sc.inputTranscription?.text) {
        const text = sc.inputTranscription.text;
        setState(s => ({
          ...s,
          userTranscript: s.userTranscript + text,
        }));
      }

      // Output transcription (what the AI said)
      if (sc.outputTranscription?.text) {
        const text = sc.outputTranscription.text;
        setState(s => ({
          ...s,
          aiTranscript: s.aiTranscript + text,
        }));
      }

      // Interrupted (user spoke over AI)
      if (sc.interrupted) {
        stopPlayback();
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

      // Create AudioContext at 16kHz for mic capture
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      // Load the PCM capture worklet
      await ctx.audioWorklet.addModule(createPCMWorkletURL());

      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const worklet = new AudioWorkletNode(ctx, 'pcm-capture-processor');
      workletNodeRef.current = worklet;

      worklet.port.onmessage = (e) => {
        if (e.data.type === 'audio' && wsRef.current?.readyState === WebSocket.OPEN) {
          // Convert Float32 to Int16 PCM, then base64
          const pcm16 = float32ToInt16(e.data.buffer);
          const base64 = arrayBufferToBase64(pcm16.buffer as ArrayBuffer);

          wsRef.current.send(JSON.stringify({
            realtimeInput: {
              audio: {
                data: base64,
                mimeType: 'audio/pcm;rate=16000',
              },
            },
          }));
        }
      };

      source.connect(worklet);
      worklet.connect(ctx.destination); // Required for worklet to process

      setState(s => ({ ...s, isListening: true }));
    } catch (error) {
      console.error('[GeminiLive] Mic capture error:', error);
      setState(s => ({ ...s, error: 'Microphone access denied' }));
    }
  }, []);

  const playAudioChunk = useCallback((base64Data: string) => {
    // Decode base64 to Int16 PCM at 24kHz
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Convert Int16 to Float32
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    // Queue for playback
    playbackQueueRef.current.push(float32);
    if (!isPlayingRef.current) {
      processPlaybackQueue();
    }
  }, []);

  const processPlaybackQueue = useCallback(() => {
    if (playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const samples = playbackQueueRef.current.shift()!;

    // Use a separate AudioContext at 24kHz for playback
    const playCtx = new AudioContext({ sampleRate: 24000 });
    const buffer = playCtx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = playCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(playCtx.destination);

    const now = playCtx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;

    source.onended = () => {
      playCtx.close();
      processPlaybackQueue();
    };
  }, []);

  const stopPlayback = useCallback(() => {
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setState({
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      isConnecting: false,
      userTranscript: '',
      aiTranscript: '',
      fullConversation: [],
      error: null,
    });
  }, []);

  const cleanup = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop mic
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    stopPlayback();
  }, [stopPlayback]);

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

function createPCMWorkletURL(): string {
  const code = `
    class PCMCaptureProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this._buffer = [];
        this._bufferSize = 4096; // ~256ms at 16kHz
      }
      process(inputs) {
        const input = inputs[0];
        if (input && input[0]) {
          this._buffer.push(...input[0]);
          if (this._buffer.length >= this._bufferSize) {
            const chunk = new Float32Array(this._buffer.splice(0, this._bufferSize));
            this.port.postMessage({ type: 'audio', buffer: chunk });
          }
        }
        return true;
      }
    }
    registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
  `;
  const blob = new Blob([code], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}
