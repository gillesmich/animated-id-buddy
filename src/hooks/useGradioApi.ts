import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

interface UseGradioApiProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: any) => void;
  onError?: (error: any) => void;
  onVideoGenerated?: (videoUrl: string) => void;
  onWebSocketEvent?: (direction: 'sent' | 'received', data: any) => void;
  avatarData?: string;
  avatarUrl?: string;
}

const BACKEND_URL = 'http://51.255.153.127:8000';

export const useGradioApi = ({
  onConnect,
  onDisconnect,
  onMessage,
  onError,
  onVideoGenerated,
  onWebSocketEvent,
  avatarData,
  avatarUrl
}: UseGradioApiProps = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startMicrophone = async () => {
    try {
      console.log('🎤 Starting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socketRef.current?.connected) {
          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            sendAudioToBackend(base64Audio);
          };
          reader.readAsDataURL(event.data);
        }
      };
      
      // Record in chunks
      mediaRecorder.start(1000); // 1 second chunks
      
      console.log('✅ Microphone started');
    } catch (error) {
      console.error('❌ Error starting microphone:', error);
      toast.error('Erreur d\'accès au microphone');
      throw error;
    }
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      console.log('🎤 Microphone stopped');
    }
  };

  const sendAudioToBackend = useCallback((audioBase64: string) => {
    if (socketRef.current?.connected && (avatarData || avatarUrl)) {
      const payload = {
        audio_data: audioBase64,
        avatar_data: avatarData,
        avatar_url: avatarUrl,
        voice_provider: 'elevenlabs',
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        conversation_history: [],
        bbox_shift: 0
      };
      onWebSocketEvent?.('sent', { event: 'chat_with_avatar', data: payload });
      socketRef.current.emit('chat_with_avatar', payload);
    }
  }, [avatarData, avatarUrl, onWebSocketEvent]);

  const recordAndSend = useCallback(() => {
    // Not needed with continuous streaming
    console.log('Audio is streaming continuously...');
  }, []);

  const connect = useCallback(async () => {
    try {
      console.log('🔌 Connecting to backend...');
      
      // Se connecter au backend Socket.IO
      const socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ Connected to backend');
        onWebSocketEvent?.('received', { event: 'connect', data: { connected: true } });
        setIsConnected(true);
        onConnect?.();
        startMicrophone();
      });

      socket.on('connected', (data) => {
        console.log('🎉 Backend ready:', data);
        onWebSocketEvent?.('received', { event: 'connected', data });
      });

      socket.on('disconnect', () => {
        console.log('🔌 Disconnected from backend');
        onWebSocketEvent?.('received', { event: 'disconnect', data: { connected: false } });
        setIsConnected(false);
        setIsSpeaking(false);
        stopMicrophone();
        onDisconnect?.();
      });

      socket.on('status', (data) => {
        console.log('📊 Status:', data);
        onWebSocketEvent?.('received', { event: 'status', data });
        onMessage?.(data);
        if (data.stage === 'tts' || data.stage === 'avatar_generation') {
          setIsSpeaking(true);
          setIsGenerating(true);
        }
        if (data.stage === 'complete') {
          setIsSpeaking(false);
          setIsGenerating(false);
        }
      });

      socket.on('transcription', (data) => {
        console.log('📝 Transcription:', data);
        onWebSocketEvent?.('received', { event: 'transcription', data });
        onMessage?.({ type: 'transcription', ...data });
      });

      socket.on('ai_response', (data) => {
        console.log('🤖 AI Response:', data);
        onWebSocketEvent?.('received', { event: 'ai_response', data });
        onMessage?.({ type: 'ai_response', ...data });
      });

      socket.on('chat_result', (data) => {
        console.log('✅ Chat result:', data);
        onWebSocketEvent?.('received', { event: 'chat_result', data });
        setIsSpeaking(false);
        setIsGenerating(false);
        onMessage?.({ type: 'result', ...data });
        
        // Construire l'URL complète pour la vidéo
        if (data.download_url) {
          const videoUrl = `${BACKEND_URL}${data.download_url}`;
          onVideoGenerated?.(videoUrl);
        }
      });

      socket.on('error', (error) => {
        console.error('❌ Backend error:', error);
        onWebSocketEvent?.('received', { event: 'error', data: error });
        setIsSpeaking(false);
        setIsGenerating(false);
        onError?.(error);
        toast.error(error.message || 'Erreur du backend');
      });

      socket.on('pong', () => {
        console.log('🏓 Pong received');
        onWebSocketEvent?.('received', { event: 'pong', data: {} });
      });

    } catch (error) {
      console.error('❌ Connection error:', error);
      onError?.(error);
      toast.error('Erreur de connexion');
    }
  }, [onConnect, onDisconnect, onMessage, onError, onVideoGenerated, avatarData, avatarUrl]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting...');
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    stopMicrophone();
    setIsConnected(false);
    setIsSpeaking(false);
    setIsGenerating(false);
    onDisconnect?.();
  }, [onDisconnect]);

  return {
    isConnected,
    isSpeaking,
    isGenerating,
    connect,
    disconnect,
    recordAndSend
  };
};
