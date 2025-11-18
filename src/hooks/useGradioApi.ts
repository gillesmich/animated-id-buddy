import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseGradioApiProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: any) => void;
  onError?: (error: any) => void;
  onVideoGenerated?: (videoUrl: string) => void;
  avatarData?: string;
  avatarUrl?: string;
}

const GRADIO_API_URL = 'http://51.255.153.127:7861';

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
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await sendAudioToGradio(audioBlob);
          audioChunksRef.current = [];
        }
      };
      
      // Enregistrer par segments de 3 secondes
      mediaRecorder.start();
      
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

  const sendAudioToGradio = async (audioBlob: Blob) => {
    if (!isConnected || isGenerating) return;
    
    try {
      setIsGenerating(true);
      setIsSpeaking(true);
      console.log('📤 Sending audio to Gradio API...');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      
      if (avatarData) {
        formData.append('avatar_data', avatarData);
      } else if (avatarUrl) {
        formData.append('avatar_url', avatarUrl);
      }

      const response = await fetch(`${GRADIO_API_URL}/api/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📥 Response from Gradio:', result);

      if (result.data && result.data.length > 0) {
        const videoUrl = result.data[0];
        console.log('🎥 Video URL:', videoUrl);
        onVideoGenerated?.(videoUrl);
        onMessage?.({ type: 'video', url: videoUrl });
      }

      setIsSpeaking(false);
      setIsGenerating(false);
    } catch (error) {
      console.error('❌ Error sending to Gradio:', error);
      onError?.(error);
      toast.error('Erreur lors de l\'envoi à l\'API');
      setIsSpeaking(false);
      setIsGenerating(false);
    }
  };

  const recordAndSend = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('⏸️ Stopping recording and sending...');
      mediaRecorderRef.current.stop();
      
      // Redémarrer l'enregistrement après un court délai
      setTimeout(() => {
        if (mediaRecorderRef.current && isConnected) {
          audioChunksRef.current = [];
          mediaRecorderRef.current.start();
        }
      }, 500);
    }
  }, [isConnected]);

  const connect = useCallback(async () => {
    try {
      console.log('🔌 Connecting to Gradio API...');
      
      // Test de connexion
      const response = await fetch(`${GRADIO_API_URL}/api/predict`, {
        method: 'HEAD',
      }).catch(() => null);

      setIsConnected(true);
      onConnect?.();
      toast.success('Connecté à l\'API Gradio');
      
      await startMicrophone();
      
      // Envoyer automatiquement toutes les 3 secondes
      const interval = setInterval(() => {
        recordAndSend();
      }, 3000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error('❌ Connection error:', error);
      onError?.(error);
      throw error;
    }
  }, [onConnect, onError, recordAndSend]);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting from Gradio API...');
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
