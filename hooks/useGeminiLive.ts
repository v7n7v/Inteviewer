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
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
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
        throw new Error(err.error || `Token request failed (${tokenRes.status})`);
      }

      const { token } = await tokenRes.json();
      console.log('[GeminiLive] Token acquired, opening WebSocket...');

      // 2. Open WebSocket to Gemini
      const ws = new WebSocket(`${GEMINI_WS_URL}?access_token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[GeminiLive] WebSocket connected, sending setup...');
        // Config is locked into the ephemeral token — send empty setup
        ws.send(JSON.stringify({ setup: {} }));
      };

      ws.binaryType = 'arraybuffer'; // Prefer ArrayBuffer over Blob for speed

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
          console.warn('[GeminiLive] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('[GeminiLive] WebSocket error:', event);
        setState(s => ({ ...s, error: 'WebSocket connection error', isConnecting: false }));
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
    // Setup complete — now start mic
    if (msg.setupComplete) {
      console.log('[GeminiLive] Setup complete, starting mic...');
      setState(s => ({ ...s, isConnected: true, isConnecting: false }));
      startMicCapture();
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
        setState(s => ({
          ...s,
          userTranscript: s.userTranscript + sc.inputTranscription.text,
        }));
      }

      // Output transcription (what the AI said)
      if (sc.outputTranscription?.text) {
        setState(s => ({
          ...s,
          aiTranscript: s.aiTranscript + sc.outputTranscription.text,
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

      // Create AudioContext — browser may not support 16kHz natively
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Use ScriptProcessorNode (works everywhere, no blob URL issues)
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
      console.log('[GeminiLive] Mic capture started');
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

    // Reuse or create playback context at 24kHz
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }

    const playCtx = playbackCtxRef.current;
    const buffer = playCtx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = playCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(playCtx.destination);
    source.start();

    source.onended = () => {
      processPlaybackQueue();
    };
  }, []);

  const stopPlayback = useCallback(() => {
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
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
      error: null,
    });
  }, []);

  const cleanup = useCallback(() => {
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

    if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
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
