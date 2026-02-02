import { useState, useRef, useCallback } from 'react';

type OnEndedCallback = () => void;

export function useAudioPlayer() {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const onEndedCallbackRef = useRef<OnEndedCallback | null>(null);

    const initAudioContext = () => {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    const playAudio = useCallback(async (audioBlob: Blob, onEnded?: OnEndedCallback): Promise<void> => {
        return new Promise(async (resolve, reject) => {
            initAudioContext();
            if (!audioContextRef.current) {
                reject(new Error('AudioContext not available'));
                return;
            }

            // Store callback
            onEndedCallbackRef.current = onEnded || null;

            try {
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

                // Create and configure source
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                sourceRef.current = source;

                setIsPlaying(true);

                source.onended = () => {
                    setIsPlaying(false);
                    sourceRef.current = null;
                    if (onEndedCallbackRef.current) {
                        onEndedCallbackRef.current();
                    }
                    resolve();
                };

                source.start(0);

            } catch (error) {
                console.error('Error playing audio:', error);
                setIsPlaying(false);
                reject(error);
            }
        });
    }, []);

    const stopAudio = useCallback(() => {
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            sourceRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    return {
        isPlaying,
        playAudio,
        stopAudio,
    };
}
