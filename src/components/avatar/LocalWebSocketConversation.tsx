import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic } from "lucide-react";
import { toast } from "sonner";
import { useGradioApi } from "@/hooks/useGradioApi";
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

  const getAvatarImage = () => {
    return config.customAvatarImage || '';
  };

  const { isConnected, isSpeaking, isGenerating, connect, disconnect, recordAndSend } = useGradioApi({
    avatarData: config.customAvatarImage,
    onConnect: () => {
      console.log("✅ [CONNEXION] Connected to Gradio API");
      toast.success("Connecté à l'API Gradio");
    },
    onDisconnect: () => {
      console.log("🔌 [DÉCONNEXION] Disconnected from Gradio API");
      toast.info("Déconnecté");
    },
    onMessage: (message) => {
      console.log("📨 [MESSAGE] Received:", JSON.stringify(message, null, 2));
      
      // Logger les appels à inference.py
      if (message.stage === 'avatar_generation') {
        console.log("🎬 [INFERENCE.PY] Avatar generation started - Calling inference.py");
      }
      if (message.stage === 'musetalk_processing') {
        console.log("🎬 [INFERENCE.PY] MuseTalk processing in progress");
      }
      if (message.stage === 'complete') {
        console.log("✅ [INFERENCE.PY] Processing completed");
      }
      
      if (message.type === 'video') {
        console.log("🎥 [VIDEO] Video message received");
        toast.success("Vidéo reçue!");
      }
      if (message.type === 'transcription') {
        console.log("📝 [TRANSCRIPTION] User said:", message.text);
      }
      if (message.type === 'ai_response') {
        console.log("🤖 [AI RESPONSE] AI replied:", message.text);
      }
    },
    onError: (error) => {
      console.error("❌ [ERROR] Error occurred:", JSON.stringify(error, null, 2));
      toast.error("Erreur de connexion");
    },
    onVideoGenerated: (videoUrl) => {
      console.log("🎥 [VIDEO GENERATED] Video URL received:", videoUrl);
      console.log("✅ [INFERENCE.PY] Video generation completed successfully");
      setVideoUrl(videoUrl);
      setVideoHistory(prev => [...prev, { url: videoUrl, timestamp: new Date() }]);
      toast.success("Vidéo générée!");
    },
    onWebSocketEvent: (direction, data) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`🔄 [WEBSOCKET ${direction.toUpperCase()}] ${timestamp}`, JSON.stringify(data, null, 2));
      
      // Logger spécifiquement les événements liés à inference.py
      if (data.event === 'status' && data.data?.stage) {
        console.log(`⚙️ [INFERENCE.PY STATUS] Stage: ${data.data.stage}`);
      }
      if (data.event === 'chat_with_avatar') {
        console.log("📤 [REQUEST TO INFERENCE.PY] Sending audio data to backend for processing");
      }
      
      setWsMessages(prev => [...prev, { timestamp, direction, data }]);
    }
  });

  const handleConnect = async () => {
    try {
      console.log("🔌 [INIT] Initializing connection to backend at http://51.255.153.127:8000");
      console.log("📋 [CONFIG] Avatar data:", config.customAvatarImage ? "✅ Loaded" : "❌ Missing");
      toast.info("Connexion à l'API Gradio...");
      await connect();
      console.log("✅ [INIT] Connection established, inference.py ready to process requests");
    } catch (error) {
      console.error("❌ [ERROR] Connection failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Erreur: ${errorMessage}`);
    }
  };

  const handleDisconnect = () => {
    console.log("🔌 [DISCONNECT] Closing connection to backend");
    disconnect();
  };

  return (
    <Card className="glass border-2 border-primary/30 p-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-gradient">
            Backend Local (Socket.IO)
          </h3>
          <p className="text-muted-foreground">
            Connexion Socket.IO sur http://51.255.153.127:8000
          </p>
        </div>

        {/* Avatar Display */}
        <div className="relative space-y-2">
          {/* Connection Button - Small, above avatar */}
          <div className="flex justify-center gap-2">
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                size="sm"
                className="gradient-primary text-primary-foreground gap-2"
              >
                <Phone className="w-4 h-4" />
                Tester la Connexion
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
                  onClick={handleDisconnect}
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
            ) : config.customAvatarImage ? (
              <img
                src={config.customAvatarImage}
                alt="Avatar"
                className={`w-full h-full object-cover transition-transform duration-100 ${
                  isSpeaking ? 'animate-lipsync' : ''
                }`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">En attente de connexion...</p>
                </div>
              </div>
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
