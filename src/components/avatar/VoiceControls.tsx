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
  
  const pushToTalkRecorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const pushToTalkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    playerRef.current = new AudioPlayer();
    return () => {
      if (pushToTalkRecorderRef.current?.isRecording()) {
        pushToTalkRecorderRef.current.stop();
      }
      if (pushToTalkTimeoutRef.current) {
        clearTimeout(pushToTalkTimeoutRef.current);
      }
    };
  }, []);

  // Arrêter l'avatar quand l'utilisateur commence à parler
  useEffect(() => {
    onUserSpeaking?.(isRecording);
  }, [isRecording, onUserSpeaking]);

  // Push-to-talk: Maintenir le bouton pour enregistrer
  const handlePushToTalkStart = async () => {
    if (isProcessing) return;

    try {
      console.log("🎤 Push-to-talk: Début enregistrement");
      
      const permissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permissions.state === 'denied') {
        throw new Error("Permission microphone refusée");
      }
      
      pushToTalkRecorderRef.current = new AudioRecorder();
      await pushToTalkRecorderRef.current.start();
      setIsRecording(true);
      
      toast({
        title: "Enregistrement",
        description: "Maintenez le bouton et parlez...",
      });
      
    } catch (error) {
      console.error('❌ Push-to-talk error:', error);
      toast({
        title: "Erreur microphone",
        description: error instanceof Error ? error.message : "Impossible d'accéder au microphone",
        variant: "destructive",
      });
    }
  };

  const handlePushToTalkEnd = async () => {
    if (!isRecording) return;

    console.log("🎤 Push-to-talk: Fin enregistrement");
    
    // Petit délai pour éviter les enregistrements trop courts
    pushToTalkTimeoutRef.current = setTimeout(async () => {
      if (pushToTalkRecorderRef.current?.isRecording()) {
        await stopPushToTalkRecording();
      }
    }, 100);
  };

  const stopPushToTalkRecording = async () => {
    if (!pushToTalkRecorderRef.current) return;

    try {
      console.log("🛑 Arrêt push-to-talk...");
      
      const audioBlob = await pushToTalkRecorderRef.current.stop();
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
      {/* Bouton Push-to-Talk (maintenir) */}
      <Button
        size="lg"
        variant={isRecording ? "destructive" : "default"}
        onMouseDown={handlePushToTalkStart}
        onMouseUp={handlePushToTalkEnd}
        onMouseLeave={handlePushToTalkEnd}
        onTouchStart={handlePushToTalkStart}
        onTouchEnd={handlePushToTalkEnd}
        disabled={isProcessing}
        className={isRecording ? "animate-pulse ring-2 ring-destructive" : ""}
      >
        {isRecording ? (
          <>
            <MicOff className="w-5 h-5 mr-2" />
            Enregistrement...
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 mr-2" />
            Parlez et maintenez enfoncé
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