import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseElevenLabsWebSocketProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: any) => void;
  onError?: (error: any) => void;
  onAudioData?: (audioData: string) => void;
}

export const useElevenLabsWebSocket = ({
  onConnect,
  onDisconnect,
  onMessage,
  onError,
  onAudioData
}: UseElevenLabsWebSocketProps = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const playAudioChunk = useCallback(async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to AudioBuffer
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioContextRef.current.createBuffer(
        1,
        float32Array.length,
        24000
      );
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        isPlayingRef.current = false;
        processAudioQueue();
      };

      source.start(0);
      isPlayingRef.current = true;
      setIsSpeaking(true);

    } catch (error) {
      console.error('❌ Error playing audio chunk:', error);
      isPlayingRef.current = false;
      setIsSpeaking(false);
      processAudioQueue();
    }
  }, []);

  const processAudioQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      if (audioQueueRef.current.length === 0) {
        setIsSpeaking(false);
      }
      return;
    }

    const nextChunk = audioQueueRef.current.shift();
    if (nextChunk) {
      playAudioChunk(nextChunk);
    }
  }, [playAudioChunk]);

  const startMicrophone = async () => {
    try {
      console.log('🎤 Starting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaStreamRef.current = stream;
      
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert Float32 to Int16
          const int16Array = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Convert to base64
          const uint8Array = new Uint8Array(int16Array.buffer);
          let binary = '';
          const chunkSize = 0x8000;
          
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          
          const base64Audio = btoa(binary);

          // Send audio to WebSocket
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            data: base64Audio
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log('✅ Microphone started');
    } catch (error) {
      console.error('❌ Error starting microphone:', error);
      toast.error('Erreur d\'accès au microphone');
      throw error;
    }
  };

  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      console.log('🎤 Microphone stopped');
    }
  };

  const connect = useCallback(async (signedUrl: string) => {
    try {
      console.log('🔌 Connecting to ElevenLabs WebSocket...');
      
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Create WebSocket connection
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        onConnect?.();
        startMicrophone();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Message received:', message.type);
          
          onMessage?.(message);

          // Handle audio data
          if (message.type === 'audio' && message.data) {
            audioQueueRef.current.push(message.data);
            onAudioData?.(message.data);
            processAudioQueue();
          }

          // Handle text messages
          if (message.type === 'text') {
            console.log('💬 Text:', message.data);
          }

        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        onError?.(error);
        toast.error('Erreur de connexion WebSocket');
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        setIsSpeaking(false);
        stopMicrophone();
        onDisconnect?.();
        
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };

    } catch (error) {
      console.error('❌ Error connecting:', error);
      onError?.(error);
      throw error;
    }
  }, [onConnect, onDisconnect, onMessage, onError, onAudioData, processAudioQueue]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting...');
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    stopMicrophone();
    
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return {
    isConnected,
    isSpeaking,
    connect,
    disconnect
  };
};