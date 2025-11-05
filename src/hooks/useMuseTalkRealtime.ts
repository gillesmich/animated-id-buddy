import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface MuseTalkRealtimeConfig {
  source_url: string;
  audio_url: string;
  bbox_shift?: number;
}

interface UseMuseTalkRealtimeReturn {
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (config: MuseTalkRealtimeConfig) => void;
  isConnected: boolean;
  currentVideo: string | null;
  error: string | null;
  status: string;
}

export const useMuseTalkRealtime = (): UseMuseTalkRealtimeReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const connect = useCallback(async () => {
    try {
      setStatus('Connecting...');
      const wsUrl = `wss://lmxcucdyvowoshqoblhk.supabase.co/functions/v1/musetalk-realtime`;
      
      console.log('🔌 Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setStatus('Connected');
        setError(null);
        toast({
          title: "Connecté",
          description: "Mode temps réel activé",
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📥 Received message:', message);

          switch (message.type) {
            case 'connected':
              setStatus('Ready');
              break;
            
            case 'status':
              setStatus(message.message);
              break;

            case 'result':
              console.log('✅ Video result:', message.data);
              const videoUrl = message.data?.video?.url;
              if (videoUrl) {
                setCurrentVideo(videoUrl);
                setStatus('Video ready');
                toast({
                  title: "Vidéo générée",
                  description: "La vidéo est prête",
                });
              }
              break;

            case 'error':
              console.error('❌ Error from server:', message.error);
              setError(message.error);
              setStatus('Error');
              toast({
                title: "Erreur",
                description: message.error,
                variant: "destructive",
              });
              break;

            case 'disconnected':
              setStatus('Disconnected');
              break;
          }
        } catch (err) {
          console.error('❌ Error parsing message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ WebSocket error:', event);
        setError('WebSocket connection error');
        setStatus('Error');
        toast({
          title: "Erreur de connexion",
          description: "Impossible de se connecter au serveur",
          variant: "destructive",
        });
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        setStatus('Disconnected');
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('❌ Connection error:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus('Error');
    }
  }, [toast]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ action: 'disconnect' }));
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
      setStatus('Disconnected');
      setCurrentVideo(null);
      toast({
        title: "Déconnecté",
        description: "Mode temps réel désactivé",
      });
    }
  }, [toast]);

  const sendMessage = useCallback((config: MuseTalkRealtimeConfig) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('WebSocket not connected');
      toast({
        title: "Erreur",
        description: "WebSocket non connecté",
        variant: "destructive",
      });
      return;
    }

    console.log('📤 Sending message:', config);
    setStatus('Generating video...');
    setCurrentVideo(null);
    
    wsRef.current.send(JSON.stringify({
      action: 'start_realtime',
      data: config
    }));
  }, [toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    currentVideo,
    error,
    status
  };
};
