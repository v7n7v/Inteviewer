declare module '@met4citizen/talkinghead' {
  export class TalkingHead {
    constructor(container: HTMLElement, options?: Record<string, any>);
    showAvatar(config: Record<string, any>): Promise<void>;
    speakAudio(audio: ArrayBuffer, options?: Record<string, any>): Promise<void>;
    speakText(text: string, options?: Record<string, any>): Promise<void>;
    stop(): void;
    setMood(mood: string): void;
    start(): void;
  }
}
