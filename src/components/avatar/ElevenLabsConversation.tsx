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
          <h3 className="text-2xl font-bold text-gradient flex items-center justify-center gap-2">
            <Phone className="w-6 h-6" />
            Local Backend
          </h3>
          <p className="text-muted-foreground">
            Conversation vocale en temps réel avec ElevenLabs via backend local
          </p>
        </div>

        {/* État de connexion */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">État de connexion</h4>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              <span className="text-sm">{isConnected ? "Connecté" : "Déconnecté"}</span>
            </div>
            <Button
              onClick={() => toast.info("Connexion vérifiée")}
              size="sm"
              variant="outline"
            >
              Vérifier la connexion
            </Button>
          </div>
        </div>

        {/* Mode Temps Réel */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Mode Temps Réel ElevenLabs
          </h4>
          <div className="text-sm text-muted-foreground mb-2">
            {isConnected ? "Connected" : "Disconnected"}
          </div>
          {!isConnected ? (
            <Button
              onClick={startConversation}
              size="sm"
              className="gradient-primary text-primary-foreground gap-2"
            >
              <Mic className="w-4 h-4" />
              Connecter
            </Button>
          ) : (
            <Button
              onClick={endConversation}
              size="sm"
              variant="destructive"
              className="gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              Déconnecter
            </Button>
          )}
        </div>

        {/* Avatar Display - Zone agrandie */}
        <div className={`relative rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 transition-all duration-300 ${
          conversation.isSpeaking ? 'speaking-glow' : ''
        }`} style={{ minHeight: '400px' }}>
          <img
            src={getAvatarImage()}
            alt="Avatar"
            className={`w-full h-full object-cover transition-transform duration-100 ${
              conversation.isSpeaking ? 'animate-lipsync' : ''
            }`}
          />
          
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

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2 p-4 rounded-lg bg-muted/30">
          <p className="font-medium">📝 Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Configurez votre ElevenLabs Agent ID dans les paramètres</li>
            <li>Cliquez sur "Connecter" pour établir la connexion</li>
            <li>Autorisez l'accès au microphone</li>
            <li>Parlez naturellement avec l'avatar</li>
          </ol>
        </div>
      </div>
    </Card>
  );
};

export default ElevenLabsConversation;
