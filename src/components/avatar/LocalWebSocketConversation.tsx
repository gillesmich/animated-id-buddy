import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Mic, Video, Volume2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMuseTalkBackend } from "@/hooks/useMuseTalkBackend";
import { WebSocketDebugPanel } from "@/components/debug/WebSocketDebugPanel";
import MobileDebugOverlay from "@/components/debug/MobileDebugOverlay";
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
  const [videoHistory, setVideoHistory] = useState<Array<{ url: string; timestamp: Date }>>([]);
  const [wsMessages, setWsMessages] = useState<Array<{ timestamp: string; direction: 'sent' | 'received'; data: any }>>([]);

  const { isConnected, isSpeaking, isGenerating, connect, disconnect, recordAndSend } = useMuseTalkBackend({
    avatarUrl: config.customAvatarImage,
    onConnect: () => {
      console.log("[MUSETALK] Connecté");
      toast.success("Connecté au Backend MuseTalk");
    },
    onDisconnect: () => {
      console.log("[MUSETALK] Déconnecté");
      toast.info("Déconnecté");
    },
    onMessage: (message) => {
      console.log("[MUSETALK] Message:", JSON.stringify(message, null, 2));
      
      if (message.stage === 'avatar_generation') {
        console.log("[MUSETALK] Génération avatar démarrée");
      }
      if (message.stage === 'complete') {
        console.log("[MUSETALK] Traitement terminé");
      }
      
      if (message.type === 'video') {
        console.log("[MUSETALK] Vidéo reçue");
        toast.success("Vidéo reçue!");
      }
      if (message.type === 'transcription') {
        console.log("[MUSETALK] Transcription:", message.text);
      }
      if (message.type === 'ai_response') {
        console.log("[MUSETALK] Réponse IA:", message.text);
      }
    },
    onError: (error) => {
      console.error("[MUSETALK] Erreur:", JSON.stringify(error, null, 2));
      toast.error("Erreur de connexion");
    },
    onVideoGenerated: (videoUrl) => {
      console.log("[MUSETALK] Vidéo générée:", videoUrl);
      setVideoUrl(videoUrl);
      setVideoHistory(prev => [...prev, { url: videoUrl, timestamp: new Date() }]);
      toast.success("Vidéo générée!");
    },
    onWebSocketEvent: (direction, data) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[MUSETALK] ${direction.toUpperCase()} ${timestamp}`, JSON.stringify(data, null, 2));
      setWsMessages(prev => [...prev, { timestamp, direction, data }]);
    },
    onVolumeChange: (level) => {
      setAudioVolume(level);
    }
  });

  const handleConnect = async () => {
    try {
      console.log("[MUSETALK] Connexion...");
      console.log("[MUSETALK] Avatar URL:", config.customAvatarImage ? "✓" : "✗");
      toast.info("Connexion au Backend MuseTalk...");
      await connect();
      console.log("[MUSETALK] Connexion établie");
    } catch (error) {
      console.error("[MUSETALK] Erreur connexion:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Erreur: ${errorMessage}`);
    }
  };

  const handleDisconnect = () => {
    console.log("[MUSETALK] Déconnexion");
    disconnect();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Backend MuseTalk (Socket.IO)</h2>
          <p className="text-sm text-muted-foreground">
            Serveur: http://51.255.153.127:8000
          </p>
        </div>

        {/* Connection Status Section */}
        <div className="flex flex-col gap-4 p-4 bg-secondary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Statut de la connexion</span>
            <Badge variant={isConnected ? "default" : "secondary"} className="gap-2">
              {isConnected ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Connecté
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  Déconnecté
                </>
              )}
            </Badge>
          </div>
          
          {/* Connection Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleConnect}
              disabled={isConnected}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Wifi className="w-4 h-4 mr-2" />
              Se Connecter
            </Button>
            
            {isConnected && (
              <Button
                onClick={handleDisconnect}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <WifiOff className="w-4 h-4 mr-2" />
                Déconnecter
              </Button>
            )}
          </div>

          {/* Processing Status */}
          {isConnected && (
            <div className="flex items-center gap-2 text-sm">
              {isSpeaking && (
                <Badge variant="outline" className="gap-2">
                  <Mic className="w-3 h-3" />
                  En écoute
                </Badge>
              )}
              {isGenerating && (
                <Badge variant="outline" className="gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Génération en cours
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Avatar Display */}
        <div className="relative w-full aspect-square max-w-md mx-auto bg-secondary/10 rounded-lg overflow-hidden border-2 border-border">
          {videoUrl ? (
            <video
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {config.customAvatarImage ? (
                <img 
                  src={config.customAvatarImage} 
                  alt="Avatar Preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center space-y-2 p-4">
                  <Video className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploadez un avatar pour commencer</p>
                </div>
              )}
            </div>
          )}
          {audioVolume > 0 && (
            <div className="absolute top-4 right-4">
              <Badge variant="default" className="gap-2">
                <Volume2 className="w-3 h-3" />
                {Math.round(audioVolume * 100)}%
              </Badge>
            </div>
          )}
        </div>

        {/* Voice Controls - Only show when connected */}
        {isConnected && (
          <div className="flex justify-center">
            <Button
              onClick={() => recordAndSend()}
              disabled={isGenerating}
              variant={isSpeaking ? "destructive" : "default"}
              size="lg"
              className="gap-2"
            >
              <Mic className="w-5 h-5" />
              {isSpeaking ? "Arrêter" : isGenerating ? "Traitement..." : "Parler"}
            </Button>
          </div>
        )}

        {/* Historique des vidéos */}
        {videoHistory.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">📼 Historique des vidéos ({videoHistory.length})</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2 rounded-lg bg-muted/30">
              {videoHistory.map((video, index) => (
                <div
                  key={index}
                  className="relative group cursor-pointer rounded-lg overflow-hidden border-2 border-primary/20 hover:border-primary/50 transition-all"
                  onClick={() => {
                    setVideoUrl(video.url);
                    toast.info("Vidéo chargée");
                  }}
                >
                  <video
                    src={video.url}
                    className="w-full h-24 object-cover"
                    muted
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-white text-xs text-center px-2">
                      <p className="font-medium">Cliquez pour rejouer</p>
                      <p className="text-[10px] mt-1">{video.timestamp.toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2 p-4 rounded-lg bg-muted/30">
          <p className="font-medium">📝 Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Assurez-vous que votre backend tourne sur http://51.255.153.127:8000</li>
            <li>Cliquez sur "Tester la Connexion" pour établir la connexion Socket.IO</li>
            <li>Parlez dans votre microphone pour interagir avec l'avatar</li>
            <li>La vidéo MuseTalk sera générée et affichée automatiquement</li>
            <li>Consultez l'historique pour rejouer les vidéos générées</li>
          </ol>
        </div>
      </div>

      {/* WebSocket Debug Panel - En bas de page */}
      <div className="mt-6">
        <WebSocketDebugPanel 
          messages={wsMessages}
          onClear={() => setWsMessages([])}
        />
      </div>

      {/* Mobile Debug Overlay pour capturer tous les logs */}
      <MobileDebugOverlay />
    </Card>
  );
};

export default LocalWebSocketConversation;
