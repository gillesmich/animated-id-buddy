import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AudioRecorder, AudioPlayer, audioToBase64 } from "@/utils/audioUtils";

interface VoiceControlsProps {
  onVoiceMessage: (audioBase64: string) => Promise<void>;
  isProcessing: boolean;
  className?: string;
}

const VoiceControls = ({ onVoiceMessage, isProcessing, className = "" }: VoiceControlsProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
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

  const startRecording = async () => {
    try {
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();
      setIsRecording(true);
      
      toast({
        title: "Enregistrement...",
        description: "Parlez maintenant",
      });
    } catch (error) {
      console.error('Recording error:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'accéder au microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;

    try {
      const audioBlob = await recorderRef.current.stop();
      setIsRecording(false);
      
      const base64Audio = await audioToBase64(audioBlob);
      await onVoiceMessage(base64Audio);
      
      toast({
        title: "Message envoyé",
        description: "Traitement en cours...",
      });
    } catch (error) {
      console.error('Stop recording error:', error);
      toast({
        title: "Erreur",
        description: "Échec de l'enregistrement",
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
      <Button
        size="lg"
        variant={isRecording ? "destructive" : "default"}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={isRecording ? "animate-pulse" : ""}
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isRecording ? (
          <>
            <MicOff className="w-5 h-5 mr-2" />
            Arrêter
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 mr-2" />
            Parler
          </>
        )}
      </Button>

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

      {isSpeaking && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Avatar parle...
        </div>
      )}
    </div>
  );
};

export default VoiceControls;