import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

interface UseGradioApiProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: any) => void;
  onError?: (error: any) => void;
  onVideoGenerated?: (videoUrl: string) => void;
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
      socketRef.current.emit('chat_with_avatar', {
        audio_data: audioBase64,
        avatar_data: avatarData,
        avatar_url: avatarUrl,
        voice_provider: 'elevenlabs',
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        conversation_history: [],
        bbox_shift: 0
      });
    }
  }, [avatarData, avatarUrl]);

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
        setIsConnected(true);
        onConnect?.();
        startMicrophone();
      });

      socket.on('connected', (data) => {
        console.log('🎉 Backend ready:', data);
      });

      socket.on('disconnect', () => {
        console.log('🔌 Disconnected from backend');
        setIsConnected(false);
        setIsSpeaking(false);
        stopMicrophone();
        onDisconnect?.();
      });

      socket.on('status', (data) => {
        console.log('📊 Status:', data);
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
        onMessage?.({ type: 'transcription', ...data });
      });

      socket.on('ai_response', (data) => {
        console.log('🤖 AI Response:', data);
        onMessage?.({ type: 'ai_response', ...data });
      });

      socket.on('chat_result', (data) => {
        console.log('✅ Chat result:', data);
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
        setIsSpeaking(false);
        setIsGenerating(false);
        onError?.(error);
        toast.error(error.message || 'Erreur du backend');
      });

      socket.on('pong', () => {
        console.log('🏓 Pong received');
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
