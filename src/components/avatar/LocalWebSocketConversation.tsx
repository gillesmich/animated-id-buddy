import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic } from "lucide-react";
import { toast } from "sonner";
import { useGradioApi } from "@/hooks/useGradioApi";
import "./elevenlabs-animation.css";

interface LocalWebSocketConversationProps {
  config: {
    selectedAvatar: string;
    customAvatarImage?: string;
    elevenlabsAgentId?: string;
  };
}

const LocalWebSocketConversation = ({ config }: LocalWebSocketConversationProps) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0);

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

  const { isConnected, isSpeaking, isGenerating, connect, disconnect, recordAndSend } = useGradioApi({
    avatarData: config.customAvatarImage,
    avatarUrl: !config.customAvatarImage ? getAvatarImage() : undefined,
    onConnect: () => {
      console.log("✅ Connected to Gradio API");
      toast.success("Connecté à l'API Gradio");
    },
    onDisconnect: () => {
      console.log("🔌 Disconnected from Gradio API");
      setVideoUrl(null);
      toast.info("Déconnecté");
    },
    onMessage: (message) => {
      console.log("📨 Message:", message);
      if (message.type === 'video') {
        toast.success("Vidéo reçue!");
      }
    },
    onError: (error) => {
      console.error("❌ Error:", error);
      toast.error("Erreur de connexion");
    },
    onVideoGenerated: (videoUrl) => {
      console.log("🎥 Video URL received:", videoUrl);
      setVideoUrl(videoUrl);
      toast.success("Vidéo générée!");
    }
  });

  const connectToApi = async () => {
    try {
      console.log("🔌 Connecting to Gradio API...");
      toast.info("Connexion à l'API Gradio...");
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
            Backend Local (Gradio)
          </h3>
          <p className="text-muted-foreground">
            Connexion à l'API Gradio sur port 7861
          </p>
        </div>

        {/* Avatar Display */}
        <div className="relative space-y-2">
          {/* Connection Button - Small, above avatar */}
          <div className="flex justify-center gap-2">
            {!isConnected ? (
              <Button
                onClick={connectToApi}
                size="sm"
                className="gradient-primary text-primary-foreground gap-2"
              >
                <Phone className="w-4 h-4" />
                Connexion API
              </Button>
            ) : (
              <>
                <Button
                  onClick={recordAndSend}
                  size="sm"
                  className="gradient-primary text-primary-foreground gap-2"
                  disabled={isGenerating}
                >
                  <Mic className="w-4 h-4" />
                  {isGenerating ? "Génération..." : "Envoyer Audio"}
                </Button>
                <Button
                  onClick={endConversation}
                  size="sm"
                  variant="destructive"
                  className="gap-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  Déconnecter
                </Button>
              </>
            )}
          </div>

          <div className={`relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 transition-all duration-300 ${
            isSpeaking ? 'speaking-glow' : ''
          }`}>
            {/* Display video if available, otherwise show image */}
            {videoUrl ? (
              <video
                src={videoUrl}
                autoPlay
                loop
                className="w-full h-full object-cover"
                onVolumeChange={(e) => {
                  const video = e.currentTarget;
                  setAudioVolume(video.volume * 100);
                }}
              />
            ) : (
              <img
                src={getAvatarImage()}
                alt="Avatar"
                className={`w-full h-full object-cover transition-transform duration-100 ${
                  isSpeaking ? 'animate-lipsync' : ''
                }`}
              />
            )}
            
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

            {/* Volume Gauge */}
            {videoUrl && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="backdrop-blur-sm bg-black/30 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white">🔊</span>
                    <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-100"
                        style={{ width: `${audioVolume}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2 p-4 rounded-lg bg-muted/30">
          <p className="font-medium">📝 Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Assurez-vous que votre backend local tourne sur http://localhost:8000</li>
            <li>Cliquez sur "Connexion WebSocket" pour établir la connexion</li>
            <li>Parlez dans votre microphone pour interagir avec l'avatar</li>
            <li>La vidéo MuseTalk sera générée et affichée automatiquement</li>
          </ol>
        </div>
      </div>
    </Card>
  );
};

export default LocalWebSocketConversation;
