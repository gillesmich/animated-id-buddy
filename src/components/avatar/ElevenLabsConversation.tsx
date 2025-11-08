import { useState, useRef } from "react";
import { useConversation } from "@11labs/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import "./elevenlabs-animation.css";

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
      console.error("❌ Error details:", typeof error === 'string' ? error : JSON.stringify(error, null, 2));
      const errorMessage = typeof error === 'string' ? error : "Erreur de connexion inconnue";
      toast.error(`Erreur ElevenLabs: ${errorMessage}`);
    },
  });

  const getSignedUrl = async () => {
    try {
      console.log("🔑 Getting signed URL for agent:", config.elevenlabsAgentId);
      
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

      console.log("📡 Edge function response:", { data, error });

      if (error) {
        console.error("❌ Edge function error:", error);
        throw error;
      }
      
      if (!data || !data.signed_url) {
        console.error("❌ Invalid response from edge function:", data);
        throw new Error("URL signée invalide");
      }

      console.log("✅ Signed URL received successfully");
      setSignedUrl(data.signed_url);
      return data.signed_url;
    } catch (error) {
      console.error("❌ Error getting signed URL:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Erreur: ${errorMessage}`);
      throw error;
    }
  };

  const startConversation = async () => {
    try {
      console.log("🎙️ Starting ElevenLabs conversation...");
      toast.info("Initialisation...");
      
      // Vérifier la configuration
      if (!config.elevenlabsAgentId) {
        toast.error("Agent ID manquant. Veuillez le configurer dans les paramètres.");
        return;
      }

      console.log("🎤 Requesting microphone access...");
      
      // Demander l'accès au microphone
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("✅ Microphone access granted");
      } catch (micError) {
        console.error("❌ Microphone access denied:", micError);
        toast.error("Accès au microphone refusé");
        return;
      }
      
      // Obtenir l'URL signée
      console.log("🔗 Getting signed URL...");
      const url = await getSignedUrl();
      console.log("✅ Signed URL obtained:", url ? "Yes" : "No");
      
      if (!url) {
        throw new Error("URL signée non valide");
      }
      
      // Démarrer la conversation avec l'URL signée
      console.log("🚀 Starting session with ElevenLabs...");
      console.log("📍 Using signed URL:", url);
      
      // Ajouter un timeout pour détecter les connexions qui prennent trop de temps
      const sessionPromise = conversation.startSession({
        signedUrl: url,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout: La connexion a pris trop de temps")), 10000)
      );
      
      await Promise.race([sessionPromise, timeoutPromise]);
      
      console.log("✅ Session started successfully");
      
    } catch (error) {
      console.error("❌ Error starting conversation:", error);
      console.error("❌ Error type:", typeof error);
      console.error("❌ Error keys:", error ? Object.keys(error) : "null");
      
      let errorMessage = "Erreur inconnue";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      }
      
      toast.error(`Erreur: ${errorMessage}`);
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
        <div className={`relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 transition-all duration-300 ${
          conversation.isSpeaking ? 'speaking-glow' : ''
        }`}>
          <img
            src={getAvatarImage()}
            alt="Avatar"
            className={`w-full h-full object-cover transition-transform duration-100 ${
              conversation.isSpeaking ? 'animate-lipsync' : ''
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
