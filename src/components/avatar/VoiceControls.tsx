import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [vadEnabled, setVadEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const { toast } = useToast();
  
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const vadRecordingRef = useRef<boolean>(false);

  useEffect(() => {
    playerRef.current = new AudioPlayer();
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
      console.log("🎤 Démarrage de l'écoute VAD...");
      
      const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permissions.state === 'denied') {
        throw new Error('Microphone access denied');
      }

      recorderRef.current = new AudioRecorder();
      
      await recorderRef.current.start({
        enableVAD: true,
        onSpeechStart: () => {
          console.log("🎤 Début de parole détecté - Démarrage enregistrement");
          vadRecordingRef.current = true;
          setIsRecording(true);
        },
        onSpeechEnd: async () => {
          console.log("🔇 Fin de parole - Arrêt enregistrement");
          if (vadRecordingRef.current && recorderRef.current) {
            vadRecordingRef.current = false;
            setIsRecording(false);
            
            try {
              const audioBlob = await recorderRef.current.stop();
              const base64Audio = await audioToBase64(audioBlob);
              console.log("📤 Envoi de l'audio au parent");
              await onVoiceMessage(base64Audio);
              
              // Redémarrer l'écoute
              setTimeout(() => startVADListening(), 500);
            } catch (error) {
              console.error("❌ Erreur lors du traitement audio:", error);
              setTimeout(() => startVADListening(), 500);
            }
          }
        },
        onVolumeChange: (vol) => {
          setVolume(vol);
        }
      });
      
      setIsListening(true);
      
      toast({
        title: "Mode VAD activé",
        description: "Parlez naturellement, l'enregistrement se fera automatiquement",
      });
      
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
    
    toast({
      title: "Mode VAD désactivé",
      description: "L'écoute automatique est arrêtée",
    });
  };

  const toggleVAD = async () => {
    console.log("🔘 Bouton VAD cliqué - vadEnabled:", vadEnabled, "isListening:", isListening);
    
    if (vadEnabled) {
      console.log("⏹️ Arrêt du VAD");
      stopVADListening();
      setVadEnabled(false);
    } else {
      console.log("▶️ Démarrage du VAD");
      setVadEnabled(true);
      await startVADListening();
    }
  };


  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    if (!audioEnabled) {
      playerRef.current?.stop();
    }
    
    toast({
      title: audioEnabled ? "Audio désactivé" : "Audio activé",
      description: audioEnabled ? "Les réponses vocales sont désactivées" : "Les réponses vocales sont activées",
    });
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        {/* Toggle VAD Mode */}
        <Button
          size="lg"
          variant={vadEnabled ? "default" : "outline"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("👆 Click détecté sur bouton VAD");
            toggleVAD();
          }}
          className={isListening ? "ring-2 ring-primary" : ""}
          style={{ cursor: 'pointer', touchAction: 'manipulation' }}
        >
          {vadEnabled ? (
            <>
              <Mic className="w-5 h-5 mr-2" />
              VAD On
            </>
          ) : (
            <>
              <MicOff className="w-5 h-5 mr-2" />
              VAD Off
            </>
          )}
        </Button>

        {/* Toggle audio */}
        <Button
          size="lg"
          variant={audioEnabled ? "default" : "outline"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("👆 Click détecté sur bouton Audio");
            toggleAudio();
          }}
          style={{ cursor: 'pointer', touchAction: 'manipulation' }}
        >
          {audioEnabled ? (
            <>
              <Volume2 className="w-5 h-5 mr-2" />
              Audio
            </>
          ) : (
            <>
              <VolumeX className="w-5 h-5 mr-2" />
              Muet
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