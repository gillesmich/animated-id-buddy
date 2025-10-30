// Voice Activity Detection
export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrame: number | null = null;
  
  private volumeThreshold: number = 0.02;
  private silenceDuration: number = 1500;
  private minSpeechDuration: number = 500;
  
  private isSpeaking: boolean = false;
  private speechStartTime: number = 0;
  private lastSpeechTime: number = 0;
  
  private onSpeechStart?: () => void;
  private onSpeechEnd?: () => void;
  private onVolumeChange?: (volume: number) => void;

  constructor(options?: {
    volumeThreshold?: number;
    silenceDuration?: number;
    minSpeechDuration?: number;
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
    onVolumeChange?: (volume: number) => void;
  }) {
    if (options) {
      this.volumeThreshold = options.volumeThreshold ?? this.volumeThreshold;
      this.silenceDuration = options.silenceDuration ?? this.silenceDuration;
      this.minSpeechDuration = options.minSpeechDuration ?? this.minSpeechDuration;
      this.onSpeechStart = options.onSpeechStart;
      this.onSpeechEnd = options.onSpeechEnd;
      this.onVolumeChange = options.onVolumeChange;
    }
  }

  async start(stream: MediaStream): Promise<void> {
    this.stream = stream;
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    source.connect(this.analyser);
    
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength) as Uint8Array;
    
    this.detectVoice();
  }

  private detectVoice(): void {
    if (!this.analyser || !this.dataArray) return;

    const checkVolume = () => {
      if (!this.analyser || !this.dataArray) return;

      this.analyser.getByteTimeDomainData(this.dataArray as any);
      
      // Calculer le volume RMS
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const normalized = (this.dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / this.dataArray.length);
      
      this.onVolumeChange?.(rms);
      
      const now = Date.now();
      
      if (rms > this.volumeThreshold) {
        // Détection de parole
        if (!this.isSpeaking) {
          this.speechStartTime = now;
          this.isSpeaking = true;
          console.log('🎤 Parole détectée');
          this.onSpeechStart?.();
        }
        this.lastSpeechTime = now;
      } else {
        // Silence détecté
        if (this.isSpeaking) {
          const speechDuration = now - this.speechStartTime;
          const silenceDuration = now - this.lastSpeechTime;
          
          if (speechDuration >= this.minSpeechDuration && silenceDuration >= this.silenceDuration) {
            this.isSpeaking = false;
            console.log('🔇 Fin de parole détectée');
            this.onSpeechEnd?.();
          }
        }
      }
      
      this.animationFrame = requestAnimationFrame(checkVolume);
    };
    
    checkVolume();
  }

  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
    this.isSpeaking = false;
  }
}

// Audio recording utilities
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private vad: VoiceActivityDetector | null = null;

  async start(options?: {
    enableVAD?: boolean;
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
    onVolumeChange?: (volume: number) => void;
  }): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      // Démarrer VAD si demandé
      if (options?.enableVAD) {
        this.vad = new VoiceActivityDetector({
          onSpeechStart: options.onSpeechStart,
          onSpeechEnd: options.onSpeechEnd,
          onVolumeChange: options.onVolumeChange,
        });
        await this.vad.start(this.stream);
      }
      
      this.mediaRecorder.start(100);
    } catch (error) {
      console.error('Error starting audio recording:', error);
      throw new Error('Microphone access denied');
    }
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      if (this.mediaRecorder.state === 'inactive') {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.cleanup();
        resolve(audioBlob);
        return;
      }

      this.mediaRecorder.onstop = () => {
        setTimeout(() => {
          if (this.audioChunks.length === 0) {
            console.warn('⚠️ No audio chunks collected');
            reject(new Error('No audio data recorded'));
            return;
          }
          
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          console.log(`✅ Audio blob created: ${audioBlob.size} bytes`);
          this.cleanup();
          resolve(audioBlob);
        }, 100);
      };

      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.requestData();
      }
      
      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  private cleanup(): void {
    if (this.vad) {
      this.vad.stop();
      this.vad = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

// Audio playback utilities
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async play(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) return;

    try {
      // Stop any currently playing audio
      this.stop();

      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);
      this.currentSource.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentSource = null;
    }
  }

  async playBase64(base64Audio: string): Promise<void> {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    await this.play(bytes.buffer);
  }
}

// Convert audio blob to base64
export async function audioToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Debounce function for optimizing API calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}