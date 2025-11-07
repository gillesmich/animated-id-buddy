import { useState, useRef } from "react";
import { useConversation } from "@11labs/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const videoRef = useRef<HTMLVideoElement>(null);

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
      console.log("📨 Message:", message);
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
      
      // Obtenir l'URL signée
      const url = await getSignedUrl();
      
      // Démarrer la conversation avec l'URL signée
      await conversation.startSession({
        signedUrl: url,
      });
      
    } catch (error) {
      console.error("❌ Error starting conversation:", error);
      toast.error("Erreur lors du démarrage");
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
      setSignedUrl(null);
    } catch (error) {
      console.error("❌ Error ending conversation:", error);
    }
  };

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

        {/* Avatar Display */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20">
          <img
            src={getAvatarImage()}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
          
          {/* Status Indicator */}
          <div className="absolute top-4 right-4">
            <div className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
              isConnected 
                ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                : "bg-muted/50 text-muted-foreground border border-border/30"
            }`}>
              {isConnected ? "🟢 Connecté" : "⚫ Déconnecté"}
            </div>
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
          <p>🤖 L'avatar vous répondra en temps réel avec ElevenLabs</p>
        </div>
      </div>
    </Card>
  );
};

export default ElevenLabsConversation;
