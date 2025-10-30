import { useState, useRef, useEffect } from "react";
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
  const { toast } = useToast();
  
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    playerRef.current = new AudioPlayer();
    return () => {
      if (recorderRef.current?.isRecording()) {
        recorderRef.current.stop();
      }
    };
  }, []);

  // Arrêter l'avatar quand l'utilisateur commence à parler
  useEffect(() => {
    onUserSpeaking?.(isRecording);
  }, [isRecording, onUserSpeaking]);

  const startRecording = async () => {
    if (isProcessing || isRecording) return;

    try {
      console.log("🎤 Démarrage de l'enregistrement - maintenir enfoncé...");
      
      const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permissions.state === 'denied') {
        throw new Error("Permission microphone refusée");
      }
      
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();
      setIsRecording(true);
      
      console.log("✅ Enregistrement démarré - maintenez le bouton");
      toast({
        title: "Enregistrement actif",
        description: "Maintenez le bouton et parlez...",
      });
      
    } catch (error) {
      console.error('❌ Recording error:', error);
      const errorMessage = error instanceof Error ? error.message : "Impossible d'accéder au microphone";
      toast({
        title: "Erreur microphone",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;

    try {
      console.log("🛑 Arrêt de l'enregistrement...");
      
      const audioBlob = await recorderRef.current.stop();
      setIsRecording(false);
      
      if (audioBlob.size === 0) {
        throw new Error("Enregistrement vide - parlez plus longtemps");
      }
      
      console.log(`📦 Audio blob: ${audioBlob.size} bytes`);
      const base64Audio = await audioToBase64(audioBlob);
      
      if (!base64Audio || base64Audio.length === 0) {
        throw new Error("Échec de conversion audio");
      }
      
      console.log(`📤 Envoi de ${base64Audio.length} caractères`);
      await onVoiceMessage(base64Audio);
      
      toast({
        title: "Message envoyé",
        description: "Traitement en cours...",
      });
    } catch (error) {
      console.error('Stop recording error:', error);
      setIsRecording(false);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec de l'enregistrement",
        variant: "destructive",
      });
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
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Bouton Push-to-Talk - maintenir enfoncé */}
      <Button
        size="lg"
        variant={isRecording ? "destructive" : "default"}
        onMouseDown={(e) => {
          e.preventDefault();
          startRecording();
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          stopRecording();
        }}
        onMouseLeave={() => {
          if (isRecording) stopRecording();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          startRecording();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          stopRecording();
        }}
        disabled={isProcessing}
        className={isRecording ? "animate-pulse ring-2 ring-destructive" : ""}
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isRecording ? (
          <>
            <MicOff className="w-5 h-5 mr-2" />
            Enregistrement...
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 mr-2" />
            Maintenir pour parler
          </>
        )}
      </Button>

      {/* Bouton audio on/off */}
      <Button
        size="lg"
        variant="outline"
        onClick={toggleAudio}
        disabled={isProcessing}
        className="glass"
      >
        {audioEnabled ? (
          <Volume2 className="w-5 h-5" />
        ) : (
          <VolumeX className="w-5 h-5" />
        )}
      </Button>

      {/* Indicateur d'état */}
      {isAvatarSpeaking && !isRecording && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Avatar parle...
        </div>
      )}
      
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          Vous parlez...
        </div>
      )}
    </div>
  );
};

export default VoiceControls;