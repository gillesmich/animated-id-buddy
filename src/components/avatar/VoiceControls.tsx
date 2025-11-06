import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AudioRecorder, AudioPlayer, audioToBase64 } from "@/utils/audioUtils";

interface VoiceControlsProps {
  onVoiceMessage: (audioBase64: string) => Promise<void>;
  isProcessing: boolean;
  className?: string;
  onUserSpeaking?: (speaking: boolean) => void;
  isAvatarSpeaking?: boolean;
}

const VoiceControls = ({ 
  onVoiceMessage, 
  isProcessing, 
  className = "",
  onUserSpeaking,
  isAvatarSpeaking = false
}: VoiceControlsProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [vadEnabled, setVadEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const { toast } = useToast();
  
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const vadRecordingRef = useRef<boolean>(false);

  useEffect(() => {
    playerRef.current = new AudioPlayer();
    
    // Démarrer le VAD automatiquement
    startVADListening();
    
    return () => {
      if (vadEnabled) {
        stopVADListening();
      }
      if (recorderRef.current?.isRecording()) {
        recorderRef.current.stop();
      }
    };
  }, []);

  // Arrêter l'avatar quand l'utilisateur commence à parler
  useEffect(() => {
    onUserSpeaking?.(isRecording);
  }, [isRecording, onUserSpeaking]);

  const startVADListening = async () => {
    if (isListening) return;

    try {
      const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permissions.state === 'denied') {
        throw new Error('Microphone access denied');
      }

      recorderRef.current = new AudioRecorder();
      
      await recorderRef.current.start({
        enableVAD: true,
        onSpeechStart: () => {
          // Ignorer si l'avatar parle ou si déjà en cours d'enregistrement
          if (isAvatarSpeaking || vadRecordingRef.current) return;
          
          vadRecordingRef.current = true;
          setIsRecording(true);
          onUserSpeaking?.(true);
        },
        onSpeechEnd: async () => {
          if (!vadRecordingRef.current || !recorderRef.current) return;
          
          vadRecordingRef.current = false;
          setIsRecording(false);
          onUserSpeaking?.(false);
          
          try {
            const audioBlob = await recorderRef.current.stop();
            
            // Filtrage: ignorer les audios trop courts (< 1 seconde)
            if (audioBlob.size < 16000) {
              setTimeout(() => startVADListening(), 500);
              return;
            }
            
            const base64Audio = await audioToBase64(audioBlob);
            await onVoiceMessage(base64Audio);
            
            // Redémarrer l'écoute
            setTimeout(() => startVADListening(), 500);
          } catch (error) {
            console.error("❌ Erreur audio:", error);
            setTimeout(() => startVADListening(), 500);
          }
        },
        onVolumeChange: (vol) => {
          setVolume(vol);
        }
      });
      
      setIsListening(true);
      
    } catch (error) {
      console.error("❌ Erreur VAD:", error);
      toast({
        title: "Erreur microphone",
        description: "Impossible d'accéder au microphone",
        variant: "destructive",
      });
    }
  };

  const stopVADListening = () => {
    if (recorderRef.current) {
      recorderRef.current.stop().catch(() => {});
      recorderRef.current = null;
    }
    vadRecordingRef.current = false;
    setIsListening(false);
    setIsRecording(false);
    setVolume(0);
  };

  const toggleVAD = async () => {
    if (vadEnabled) {
      stopVADListening();
      setVadEnabled(false);
    } else {
      setVadEnabled(true);
      await startVADListening();
    }
  };


  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    if (!audioEnabled) {
      playerRef.current?.stop();
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        {/* Toggle VAD Mode */}
        <Button
          onClick={toggleVAD}
          variant={vadEnabled ? "default" : "outline"}
          className={`gap-2 ${isListening ? "ring-2 ring-primary" : ""}`}
        >
          {vadEnabled ? (
            <>
              <Mic className="w-5 h-5" />
              <span>VAD On</span>
            </>
          ) : (
            <>
              <MicOff className="w-5 h-5" />
              <span>VAD Off</span>
            </>
          )}
        </Button>

        {/* Toggle audio */}
        <Button
          onClick={toggleAudio}
          variant={audioEnabled ? "default" : "outline"}
          className="gap-2"
        >
          {audioEnabled ? (
            <>
              <Volume2 className="w-5 h-5" />
              <span>Audio</span>
            </>
          ) : (
            <>
              <VolumeX className="w-5 h-5" />
              <span>Muet</span>
            </>
          )}
        </Button>

        {/* Indicateurs de statut */}
        <div className="flex items-center gap-2 ml-auto">
          {isAvatarSpeaking && (
            <Badge variant="secondary" className="animate-pulse">
              <Volume2 className="w-3 h-3 mr-1" />
              Avatar
            </Badge>
          )}
          {isRecording && (
            <Badge variant="destructive" className="animate-pulse">
              <Mic className="w-3 h-3 mr-1" />
              Enregistrement
            </Badge>
          )}
        </div>
      </div>

      {/* Indicateur visuel de volume en temps réel */}
      {vadEnabled && (
        <div className="flex items-center gap-3 px-4 py-2 bg-secondary/20 rounded-lg">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${Math.min(volume * 200, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground min-w-[60px]">
            {isListening ? 'En écoute' : 'Inactif'}
          </span>
        </div>
      )}
    </div>
  );
};

export default VoiceControls;