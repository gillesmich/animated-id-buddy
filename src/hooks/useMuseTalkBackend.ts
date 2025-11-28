import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

interface UseMuseTalkBackendProps {
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

export const useMuseTalkBackend = ({
  onConnect,
  onDisconnect,
  onMessage,
  onError,
  onVideoGenerated,
  onWebSocketEvent,
  avatarData,
  avatarUrl
}: UseMuseTalkBackendProps = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startMicrophone = async () => {
    try {
      console.log('[MUSETALK] Démarrage du microphone...');
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
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            sendAudioToBackend(base64Audio);
          };
          reader.readAsDataURL(event.data);
        }
      };
      
      mediaRecorder.start(1000);
      console.log('[MUSETALK] Microphone actif');
    } catch (error) {
      console.error('[MUSETALK] Erreur microphone:', error);
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
      console.log('[MUSETALK] Microphone arrêté');
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

  const recordAndSend = useCallback(async () => {
    if (!socketRef.current?.connected) {
      toast.error('Non connecté au backend');
      return;
    }

    if (!isSpeaking) {
      console.log('[MUSETALK] Démarrage enregistrement');
      setIsSpeaking(true);
      await startMicrophone();
    } else {
      console.log('[MUSETALK] Arrêt enregistrement');
      setIsSpeaking(false);
      stopMicrophone();
    }
  }, [isSpeaking]);

  const connect = useCallback(async () => {
    try {
      console.log('[MUSETALK] Connexion au backend...');
      
      const socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[MUSETALK] Connecté');
        onWebSocketEvent?.('received', { event: 'connect', data: { connected: true } });
        setIsConnected(true);
        onConnect?.();
        toast.success('Connecté au Backend MuseTalk');
      });

      socket.on('connected', (data) => {
        console.log('[MUSETALK] Backend prêt:', data);
        onWebSocketEvent?.('received', { event: 'connected', data });
      });

      socket.on('disconnect', () => {
        console.log('[MUSETALK] Déconnecté');
        onWebSocketEvent?.('received', { event: 'disconnect', data: { connected: false } });
        setIsConnected(false);
        setIsSpeaking(false);
        stopMicrophone();
        onDisconnect?.();
      });

      socket.on('status', (data) => {
        console.log('[MUSETALK] Status:', data);
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
        console.log('[MUSETALK] Transcription:', data);
        onWebSocketEvent?.('received', { event: 'transcription', data });
        onMessage?.({ type: 'transcription', ...data });
      });

      socket.on('ai_response', (data) => {
        console.log('[MUSETALK] Réponse IA:', data);
        onWebSocketEvent?.('received', { event: 'ai_response', data });
        onMessage?.({ type: 'ai_response', ...data });
      });

      socket.on('chat_result', (data) => {
        console.log('[MUSETALK] Résultat:', data);
        onWebSocketEvent?.('received', { event: 'chat_result', data });
        setIsSpeaking(false);
        setIsGenerating(false);
        onMessage?.({ type: 'result', ...data });
        
        if (data.download_url) {
          const videoUrl = `${BACKEND_URL}${data.download_url}`;
          onVideoGenerated?.(videoUrl);
        }
      });

      socket.on('error', (error) => {
        console.error('[MUSETALK] Erreur:', error);
        onWebSocketEvent?.('received', { event: 'error', data: error });
        setIsSpeaking(false);
        setIsGenerating(false);
        onError?.(error);
        toast.error(error.message || 'Erreur du backend');
      });

      socket.on('pong', () => {
        console.log('[MUSETALK] Pong reçu');
        onWebSocketEvent?.('received', { event: 'pong', data: {} });
      });

    } catch (error) {
      console.error('[MUSETALK] Erreur de connexion:', error);
      onError?.(error);
      toast.error('Erreur de connexion');
    }
  }, [onConnect, onDisconnect, onMessage, onError, onVideoGenerated, avatarData, avatarUrl]);

  const disconnect = useCallback(() => {
    console.log('[MUSETALK] Déconnexion...');
    
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
