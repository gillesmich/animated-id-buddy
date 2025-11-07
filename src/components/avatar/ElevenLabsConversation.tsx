import { useState, useRef, useEffect } from "react";
import { useConversation } from "@11labs/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DIDWebRTCManager } from "@/utils/didWebRTC";
import "./avatar-transitions.css";

interface ElevenLabsConversationProps {
  config: {
    selectedAvatar: string;
    customAvatarImage?: string;
    elevenlabsAgentId?: string;
  };
}

const ElevenLabsConversation = ({ config }: ElevenLabsConversationProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [didStatus, setDidStatus] = useState<string>("Déconnecté");
  const videoRef = useRef<HTMLVideoElement>(null);
  const didManagerRef = useRef<DIDWebRTCManager | null>(null);
  const currentTranscriptRef = useRef<string>("");

  const conversation = useConversation({
    onConnect: () => {
      console.log("✅ ElevenLabs conversation connected");
      setIsConnected(true);
      toast.success("Connecté à ElevenLabs");
    },
    onDisconnect: () => {
      console.log("🔌 ElevenLabs conversation disconnected");
      setIsConnected(false);
      toast.info("Déconnecté");
    },
    onMessage: (message) => {
      console.log("📨 Message ElevenLabs:", message);
      
      // Détecter les messages de l'agent
      if (message.source === 'ai' && message.message) {
        const text = message.message;
        console.log("🗣️ Message agent:", text);
        currentTranscriptRef.current += text + " ";
        
        // Envoyer à D-ID pour animation
        if (didManagerRef.current?.isActive()) {
          didManagerRef.current.sendText(text).catch(err => {
            console.error("Erreur envoi à D-ID:", err);
          });
        }
      }
    },
    onError: (error) => {
      console.error("❌ ElevenLabs error:", error);
      toast.error("Erreur de connexion");
    },
  });

  const getSignedUrl = async () => {
    try {
      if (!config.elevenlabsAgentId) {
        toast.error("Veuillez configurer votre ElevenLabs Agent ID dans la section API Keys");
        throw new Error("Agent ID manquant");
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-agent', {
        body: { 
          action: 'get_signed_url',
          agentId: config.elevenlabsAgentId
        }
      });

      if (error) throw error;
      
      setSignedUrl(data.signed_url);
      return data.signed_url;
    } catch (error) {
      console.error("❌ Error getting signed URL:", error);
      toast.error("Erreur lors de la récupération de l'URL signée");
      throw error;
    }
  };

  const startConversation = async () => {
    try {
      toast.info("Initialisation...");
      
      // Demander l'accès au microphone
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialiser D-ID WebRTC pour l'avatar vidéo
      if (videoRef.current) {
        didManagerRef.current = new DIDWebRTCManager(videoRef.current, setDidStatus);
        const avatarUrl = getAvatarImage();
        
        toast.info("Chargement de l'avatar vidéo...");
        await didManagerRef.current.createSession(avatarUrl);
        console.log("✅ Avatar D-ID initialisé");
      }
      
      // Obtenir l'URL signée ElevenLabs
      const url = await getSignedUrl();
      
      // Démarrer la conversation avec l'URL signée
      await conversation.startSession({
        signedUrl: url,
      });
      
      toast.success("Prêt à parler!");
      
    } catch (error) {
      console.error("❌ Error starting conversation:", error);
      toast.error("Erreur lors du démarrage");
      
      // Nettoyer en cas d'erreur
      if (didManagerRef.current) {
        didManagerRef.current.cleanup();
        didManagerRef.current = null;
      }
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
      setSignedUrl(null);
      
      // Nettoyer D-ID
      if (didManagerRef.current) {
        didManagerRef.current.cleanup();
        didManagerRef.current = null;
      }
      
      currentTranscriptRef.current = "";
    } catch (error) {
      console.error("❌ Error ending conversation:", error);
    }
  };

  // Nettoyer au démontage du composant
  useEffect(() => {
    return () => {
      if (didManagerRef.current) {
        didManagerRef.current.cleanup();
      }
    };
  }, []);

  const getAvatarImage = () => {
    if (config.customAvatarImage) {
      return config.customAvatarImage;
    }
    
    const avatarMap: Record<string, string> = {
      amy: "/src/assets/avatar-amy.jpg",
      john: "/src/assets/avatar-john.jpg",
      marcus: "/src/assets/avatar-marcus.jpg",
      sophia: "/src/assets/avatar-sophia.jpg",
    };
    
    return avatarMap[config.selectedAvatar] || avatarMap.amy;
  };

  return (
    <Card className="glass border-2 border-primary/30 p-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-gradient">
            ElevenLabs Conversational AI
          </h3>
          <p className="text-muted-foreground">
            Avatar interactif avec voix ultra-réaliste
          </p>
        </div>

        {/* Avatar Display - Vidéo D-ID avec lip sync */}
        <div className={`relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 transition-all duration-300 ${
          conversation.isSpeaking ? 'avatar-speaking scale-105' : 'scale-100'
        }`}>
          {/* Vidéo D-ID */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Fallback image si pas encore connecté */}
          {!isConnected && (
            <img
              src={getAvatarImage()}
              alt="Avatar"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          
          {/* Status Indicators */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
              isConnected 
                ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                : "bg-muted/50 text-muted-foreground border border-border/30"
            }`}>
              {isConnected ? "🟢 Voix connectée" : "⚫ Déconnecté"}
            </div>
            {isConnected && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                didStatus === "Connecté" || didStatus === "En cours"
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" 
                  : "bg-muted/50 text-muted-foreground border border-border/30"
              }`}>
                {didStatus === "Connecté" || didStatus === "En cours" ? "🎥 Vidéo active" : "⚫ Vidéo inactive"}
              </div>
            )}
          </div>

          {/* Speaking Indicator */}
          {conversation.isSpeaking && (
            <div className="absolute bottom-4 left-4">
              <div className="px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                Parle...
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4 justify-center">
          {!isConnected ? (
            <Button
              onClick={startConversation}
              size="lg"
              className="gradient-primary text-primary-foreground gap-2"
            >
              <Phone className="w-5 h-5" />
              Démarrer la conversation
            </Button>
          ) : (
            <Button
              onClick={endConversation}
              size="lg"
              variant="destructive"
              className="gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              Terminer
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>💡 Cliquez sur "Démarrer" et parlez naturellement</p>
          <p>🎤 Votre microphone sera activé automatiquement</p>
          <p>🎭 Avatar vidéo D-ID + Voix ElevenLabs en temps réel</p>
          <p>👄 Lip sync automatique et ultra-réaliste</p>
        </div>
      </div>
    </Card>
  );
};

export default ElevenLabsConversation;
