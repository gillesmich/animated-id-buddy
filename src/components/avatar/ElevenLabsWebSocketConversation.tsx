import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useElevenLabsWebSocket } from "@/hooks/useElevenLabsWebSocket";
import "./elevenlabs-animation.css";

interface ElevenLabsWebSocketConversationProps {
  config: {
    selectedAvatar: string;
    customAvatarImage?: string;
    elevenlabsAgentId?: string;
  };
}

const ElevenLabsWebSocketConversation = ({ config }: ElevenLabsWebSocketConversationProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

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

  const { isConnected, isSpeaking, connect, disconnect } = useElevenLabsWebSocket({
    avatarData: config.customAvatarImage,
    avatarUrl: !config.customAvatarImage ? getAvatarImage() : undefined,
    onConnect: () => {
      console.log("✅ Connected to ElevenLabs");
      toast.success("Connecté à ElevenLabs");
    },
    onDisconnect: () => {
      console.log("🔌 Disconnected from ElevenLabs");
      setSignedUrl(null);
      toast.info("Déconnecté");
    },
    onMessage: (message) => {
      console.log("📨 Message:", message);
    },
    onError: (error) => {
      console.error("❌ Error:", error);
      toast.error("Erreur de connexion");
    },
    onAudioData: (audioData) => {
      console.log("🎵 Audio data received, length:", audioData.length);
    }
  });

  const getSignedUrl = async () => {
    try {
      console.log("🔑 Getting signed URL for agent:", config.elevenlabsAgentId);
      
      if (!config.elevenlabsAgentId) {
        toast.error("Veuillez configurer votre ElevenLabs Agent ID");
        throw new Error("Agent ID manquant");
      }

      const { data, error } = await supabase.functions.invoke('elevenlabs-agent', {
        body: { 
          action: 'get_signed_url',
          agentId: config.elevenlabsAgentId
        }
      });

      console.log("📡 Response:", { data, error });

      if (error) {
        console.error("❌ Error:", error);
        throw error;
      }
      
      if (!data || !data.signed_url) {
        console.error("❌ Invalid response:", data);
        throw new Error("URL signée invalide");
      }

      console.log("✅ Signed URL received");
      setSignedUrl(data.signed_url);
      return data.signed_url;
    } catch (error) {
      console.error("❌ Error getting signed URL:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Erreur: ${errorMessage}`);
      throw error;
    }
  };

  const connectWebSocket = async () => {
    try {
      console.log("🔌 Connecting to WebSocket...");
      toast.info("Connexion au WebSocket...");
      await connect();
    } catch (error) {
      console.error("❌ Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Erreur: ${errorMessage}`);
    }
  };

  const endConversation = async () => {
    try {
      disconnect();
    } catch (error) {
      console.error("❌ Error ending conversation:", error);
    }
  };

  return (
    <Card className="glass border-2 border-primary/30 p-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-gradient">
            ElevenLabs Backend Local
          </h3>
          <p className="text-muted-foreground">
            Connexion directe à votre serveur Socket.IO local
          </p>
        </div>

        {/* Avatar Display */}
        <div className={`relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 transition-all duration-300 ${
          isSpeaking ? 'speaking-glow' : ''
        }`}>
          <img
            src={getAvatarImage()}
            alt="Avatar"
            className={`w-full h-full object-cover transition-transform duration-100 ${
              isSpeaking ? 'animate-lipsync' : ''
            }`}
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
          {isSpeaking && (
            <div className="absolute bottom-4 left-4">
              <div className="px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                Parle...
              </div>
            </div>
          )}

          {/* WebSocket Mode Badge */}
          <div className="absolute bottom-4 right-4">
            <div className="px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Backend Local
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 justify-center">
          {!isConnected ? (
            <Button
              onClick={connectWebSocket}
              size="lg"
              className="gradient-primary text-primary-foreground gap-2"
            >
              <Phone className="w-5 h-5" />
              Connexion WebSocket
            </Button>
          ) : (
            <Button
              onClick={endConversation}
              size="lg"
              variant="destructive"
              className="gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              Déconnecter
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>🎤 Votre voix → Backend Local (port 8000)</p>
          <p>🤖 ElevenLabs → MuseTalk → Vidéo générée</p>
        </div>
      </div>
    </Card>
  );
};

export default ElevenLabsWebSocketConversation;