import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, Radio, MicOff, Settings, Shield } from "lucide-react";
import { toast } from "sonner";
import io, { Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface LocalWebRTCConversationProps {
  config: {
    customAvatarImage?: string;
    customAvatarVideo?: string;
  };
}

const LocalWebRTCConversation = ({ config }: LocalWebRTCConversationProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [transcription, setTranscription] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [backendUrl, setBackendUrl] = useState('http://51.255.153.127:5000');
  const [useProxy, setUseProxy] = useState(true); // Utiliser le proxy par défaut
  const [showSettings, setShowSettings] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // URL du proxy Supabase
  const proxyUrl = `wss://lmxcucdyvowoshqoblhk.supabase.co/functions/v1/socketio-proxy?backend=${encodeURIComponent(backendUrl)}`;

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (peerConnection) {
        peerConnection.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [peerConnection]);

  const handleConnect = async () => {
    try {
      console.log("[WebRTC] Mode:", useProxy ? "Proxy HTTPS" : "Direct");
      console.log("[WebRTC] Backend:", backendUrl);
      toast.info(useProxy ? "Connexion via proxy HTTPS..." : "Connexion directe...");

      if (useProxy) {
        // Connexion via WebSocket proxy
        await connectViaProxy();
      } else {
        // Connexion directe Socket.IO
        await connectDirect();
      }
    } catch (error) {
      console.error("[WebRTC] Erreur:", error);
      toast.error(`Erreur: ${error instanceof Error ? error.message : 'Connexion échouée'}`);
    }
  };

  const connectViaProxy = async () => {
    return new Promise<void>((resolve, reject) => {
      console.log("[Proxy] Connecting to:", proxyUrl);
      
      const ws = new WebSocket(proxyUrl);
      wsRef.current = ws;

      const timeoutId = setTimeout(() => {
        ws.close();
        reject(new Error("Timeout connexion proxy (20s)"));
      }, 20000);

      ws.onopen = () => {
        console.log("[Proxy] ✅ WebSocket connecté");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[Proxy] Message:", message.event || message.type);

          if (message.type === 'socketio_event') {
            handleSocketIOEvent(message.event, message.data);
            
            if (message.event === 'connected') {
              clearTimeout(timeoutId);
              setIsConnected(true);
              toast.success("Connecté via proxy HTTPS");
              resolve();
            } else if (message.event === 'connect_error') {
              clearTimeout(timeoutId);
              reject(new Error(message.data?.message || "Erreur connexion backend"));
            }
          }
        } catch (err) {
          console.error("[Proxy] Parse error:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("[Proxy] WebSocket error:", error);
        clearTimeout(timeoutId);
        reject(new Error("Erreur WebSocket proxy"));
      };

      ws.onclose = () => {
        console.log("[Proxy] WebSocket fermé");
        setIsConnected(false);
      };
    });
  };

  const connectDirect = async () => {
    // Créer la promesse de connexion
    let resolveConnection: () => void;
    let rejectConnection: (err: Error) => void;
    const connectionPromise = new Promise<void>((resolve, reject) => {
      resolveConnection = resolve;
      rejectConnection = reject;
    });

    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    socketRef.current = socket;

    const timeoutId = setTimeout(() => {
      rejectConnection(new Error("Timeout connexion (20s)"));
    }, 20000);

    socket.on('connect', () => {
      console.log("[Socket.IO] ✅ Transport connecté");
    });

    socket.on('connected', (data) => {
      console.log("[Socket.IO] ✅ Session:", data?.client_id);
      clearTimeout(timeoutId);
      setIsConnected(true);
      toast.success("Connecté au serveur");
      resolveConnection();
    });

    socket.on('disconnect', () => {
      console.log("[Socket.IO] Déconnecté");
      setIsConnected(false);
      toast.info("Déconnecté");
    });

    socket.on('error', (data) => handleSocketIOEvent('error', data));
    socket.on('status', (data) => handleSocketIOEvent('status', data));
    socket.on('transcription', (data) => handleSocketIOEvent('transcription', data));
    socket.on('ai_response', (data) => handleSocketIOEvent('ai_response', data));

    socket.on('connect_error', (err) => {
      console.error("[Socket.IO] Erreur connexion:", err.message);
      clearTimeout(timeoutId);
      toast.error(`Erreur: ${err.message}`);
      rejectConnection(err);
    });

    await connectionPromise;
  };

  const handleSocketIOEvent = (event: string, data: any) => {
    console.log(`[Event] ${event}:`, data);
    
    switch (event) {
      case 'error':
        toast.error(data?.message || "Erreur serveur");
        break;
      case 'status':
        setStatus(data?.message || "");
        setProgress(data?.progress || 0);
        break;
      case 'transcription':
        setTranscription(data?.text || "");
        break;
      case 'ai_response':
        setAiResponse(data?.text || "");
        break;
    }
  };

  const emitEvent = (event: string, data: any = {}) => {
    if (useProxy && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'emit', event, data }));
    } else if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  };

  const handleDisconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsConnected(false);
    setStatus("");
    setProgress(0);
    toast.info("Déconnecté");
  };

  const handleStartListening = () => {
    if (!isConnected) {
      toast.error("Non connecté");
      return;
    }

    setIsListening(true);
    setTranscription("");
    setAiResponse("");
    emitEvent('start_listening', {});
    toast.info("Écoute démarrée...");
  };

  const handleStopListening = () => {
    if (!isConnected) return;

    setIsListening(false);
    emitEvent('stop_listening', {});
    toast.info("Traitement en cours...");
  };

  return (
    <Card className="glass p-6 space-y-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Radio className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">WebRTC Local</h3>
              <p className="text-sm text-muted-foreground">Backend Python + MuseTalk</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connecté" : "Déconnecté"}
            </Badge>
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <div className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-3">
            {/* Proxy Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <Label htmlFor="use-proxy" className="text-xs font-medium">
                  Utiliser Proxy HTTPS
                </Label>
              </div>
              <Switch
                id="use-proxy"
                checked={useProxy}
                onCheckedChange={setUseProxy}
                disabled={isConnected}
              />
            </div>
            
            {useProxy && (
              <div className="p-2 rounded bg-primary/10 border border-primary/30 text-xs">
                <strong>✅ Mode sécurisé:</strong> Connexion via proxy Supabase (HTTPS).
                Pas besoin de certificat SSL sur le backend.
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium">URL Backend:</label>
              <Input
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://IP:5000"
                disabled={isConnected}
              />
            </div>
            
            {!useProxy && window.location.protocol === 'https:' && backendUrl.startsWith('http://') && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-xs">
                <strong>⚠️ Mixed Content:</strong> Activez le proxy ou configurez HTTPS sur le backend.
              </div>
            )}
          </div>
        )}

        {/* Status */}
        {status && (
          <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{status}</span>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Transcription & Response */}
        {(transcription || aiResponse) && (
          <div className="space-y-2">
            {transcription && (
              <div className="p-2 rounded bg-muted/50 text-sm">
                <span className="text-muted-foreground">Vous: </span>{transcription}
              </div>
            )}
            {aiResponse && (
              <div className="p-2 rounded bg-primary/10 text-sm">
                <span className="text-primary">IA: </span>{aiResponse}
              </div>
            )}
          </div>
        )}

        {/* Connection Controls */}
        <div className="flex gap-3">
          {!isConnected ? (
            <Button onClick={handleConnect} className="flex-1" size="lg">
              <Radio className="w-5 h-5 mr-2" />
              Connecter
            </Button>
          ) : (
            <Button onClick={handleDisconnect} variant="outline" className="flex-1" size="lg">
              Déconnecter
            </Button>
          )}
        </div>

        {/* Video Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Avatar WebRTC</span>
            </div>
            {isConnected && <Badge variant="default">Live</Badge>}
          </div>
          
          <div className="relative rounded-lg overflow-hidden border border-border/50 bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-sm text-muted-foreground">En attente de connexion...</p>
              </div>
            )}
          </div>
        </div>

        {/* Voice Controls */}
        {isConnected && (
          <div className="flex justify-center">
            <Button
              onClick={isListening ? handleStopListening : handleStartListening}
              size="lg"
              variant={isListening ? "destructive" : "default"}
              className="gap-2"
            >
              {isListening ? (
                <>
                  <MicOff className="w-5 h-5" />
                  Arrêter
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Parler
                </>
              )}
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <p className="text-xs text-muted-foreground">
            <strong>Mode:</strong> {useProxy ? "Proxy HTTPS (Supabase)" : "Direct Socket.IO"}
            <br />
            <strong>Backend:</strong> {backendUrl}
            <br />
            <strong>Pipeline:</strong> Audio → Whisper → OpenAI → ElevenLabs → MuseTalk
          </p>
        </div>
      </div>
    </Card>
  );
};

export default LocalWebRTCConversation;
