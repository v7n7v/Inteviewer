import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioRecorderState {
    isRecording: boolean;
    recordingTime: number;
    mediaBlobUrl: string | null;
}

export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Analyser for visualization
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Setup MediaRecorder
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const recordedBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(recordedBlob);
                setMediaBlobUrl(url);
                chunksRef.current = [];
            };

            // Setup AudioContext for visualization
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current.connect(analyserRef.current);

            const bufferLength = analyserRef.current.frequencyBinCount;
            dataArrayRef.current = new Uint8Array(bufferLength);

            mediaRecorderRef.current.start();
            setIsRecording(true);

            // Timer
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    }, []);

    const stopRecording = useCallback(async (): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.onstop = () => {
                    const recordedBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    const url = URL.createObjectURL(recordedBlob);
                    setMediaBlobUrl(url);
                    chunksRef.current = [];

                    // Stop all tracks
                    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

                    resolve(recordedBlob);
                };

                mediaRecorderRef.current.stop();
                setIsRecording(false);

                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }

                // Cleanup AudioContext
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
            } else {
                resolve(null);
            }
        });
    }, [isRecording]);

    const getVisualizerData = useCallback(() => {
        if (analyserRef.current && dataArrayRef.current) {
            analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
            return Array.from(dataArrayRef.current);
        }
        return new Array(128).fill(0);
    }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, [isRecording]);

    return {
        isRecording,
        recordingTime,
        mediaBlobUrl,
        startRecording,
        stopRecording,
        getVisualizerData
    };
}
