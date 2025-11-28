import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

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

const PROXY_URL = 'wss://lmxcucdyvowoshqoblhk.supabase.co/functions/v1/musetalk-proxy';

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
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startMicrophone = async () => {
    try {
      console.log('[MUSETALK] Démarrage du microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      mediaStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log(`[MUSETALK] Audio chunk reçu: ${event.data.size} bytes`);
          
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Audio = reader.result as string;
              const base64Data = base64Audio.split(',')[1] || base64Audio;
              console.log(`[MUSETALK] Envoi audio: ${base64Data.substring(0, 50)}...`);
              sendAudioToBackend(base64Data);
            };
            reader.readAsDataURL(event.data);
          } else {
            console.warn('[MUSETALK] WebSocket non ouvert, audio ignoré');
          }
        }
      };
      
      // Enregistrer par chunks de 3 secondes pour Whisper
      mediaRecorder.start(3000);
      console.log('[MUSETALK] Microphone actif (chunks de 3s)');
    } catch (error) {
      console.error('[MUSETALK] Erreur microphone:', error);
      toast.error('Erreur d\'accès au microphone');
      throw error;
    }
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('[MUSETALK] Arrêt du MediaRecorder');
      // Forcer l'envoi des données finales
      mediaRecorderRef.current.requestData();
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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[MUSETALK] WebSocket non connecté');
      return;
    }
    
    if (!avatarData && !avatarUrl) {
      console.error('[MUSETALK] Aucune donnée avatar disponible');
      toast.error('Veuillez uploader un avatar d\'abord');
      return;
    }
    
    console.log('[MUSETALK] Envoi audio au backend...');
    const payload = {
      audio_data: audioBase64,
      avatar_data: avatarData,
      avatar_url: avatarUrl,
      voice_provider: 'elevenlabs',
      voice_id: 'EXAVITQu4vr4xnSDxMaL',
      conversation_history: [],
      bbox_shift: 0
    };
    const message = { event: 'chat_with_avatar', data: payload };
    console.log('[MUSETALK] Payload:', { ...payload, audio_data: `${audioBase64.substring(0, 50)}...` });
    onWebSocketEvent?.('sent', message);
    wsRef.current.send(JSON.stringify(message));
    console.log('[MUSETALK] Message envoyé au backend');
  }, [avatarData, avatarUrl, onWebSocketEvent]);

  const recordAndSend = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
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
      console.log('[MUSETALK] Connexion au proxy WebSocket...');
      
      const ws = new WebSocket(PROXY_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[MUSETALK] Connecté au proxy');
        onWebSocketEvent?.('received', { event: 'connect', data: { connected: true } });
        setIsConnected(true);
        onConnect?.();
        toast.success('Connecté au Backend MuseTalk via proxy');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { event: eventName, data } = message;
          
          console.log('[MUSETALK] Message reçu:', eventName);
          onWebSocketEvent?.('received', message);

          switch (eventName) {
            case 'backend_connected':
            case 'connected':
              console.log('[MUSETALK] Backend prêt:', data);
              break;

            case 'status':
              console.log('[MUSETALK] Status:', data);
              onMessage?.(data);
              if (data.stage === 'tts' || data.stage === 'avatar_generation') {
                setIsSpeaking(true);
                setIsGenerating(true);
              }
              if (data.stage === 'complete') {
                setIsSpeaking(false);
                setIsGenerating(false);
              }
              break;

            case 'transcription':
              console.log('[MUSETALK] Transcription:', data);
              onMessage?.({ type: 'transcription', ...data });
              break;

            case 'ai_response':
              console.log('[MUSETALK] Réponse IA:', data);
              onMessage?.({ type: 'ai_response', ...data });
              break;

            case 'chat_result':
              console.log('[MUSETALK] Résultat:', data);
              setIsSpeaking(false);
              setIsGenerating(false);
              onMessage?.({ type: 'result', ...data });
              
              if (data.download_url) {
                onVideoGenerated?.(data.download_url);
              }
              break;

            case 'error':
              console.error('[MUSETALK] Erreur:', data);
              setIsSpeaking(false);
              setIsGenerating(false);
              onError?.(data);
              toast.error(data.message || 'Erreur du backend');
              break;

            case 'pong':
              console.log('[MUSETALK] Pong reçu');
              break;

            case 'backend_disconnected':
              console.log('[MUSETALK] Backend déconnecté:', data);
              toast.error('Backend déconnecté');
              break;
          }
        } catch (error) {
          console.error('[MUSETALK] Erreur parsing message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[MUSETALK] Déconnecté');
        onWebSocketEvent?.('received', { event: 'disconnect', data: { connected: false } });
        setIsConnected(false);
        setIsSpeaking(false);
        stopMicrophone();
        onDisconnect?.();
      };

      ws.onerror = (error) => {
        console.error('[MUSETALK] Erreur WebSocket:', error);
        onError?.(error);
        toast.error('Erreur de connexion WebSocket');
      };

    } catch (error) {
      console.error('[MUSETALK] Erreur de connexion:', error);
      onError?.(error);
      toast.error('Erreur de connexion');
    }
  }, [onConnect, onDisconnect, onMessage, onError, onVideoGenerated]);

  const disconnect = useCallback(() => {
    console.log('[MUSETALK] Déconnexion...');
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
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
