import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, Loader2, Radio, MicOff, Settings } from "lucide-react";
import { toast } from "sonner";
import io, { Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";

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
  const [showSettings, setShowSettings] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
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
      console.log("[WebRTC] Connexion à:", backendUrl);
      toast.info("Connexion au backend...");

      // Créer la promesse de connexion AVANT de créer le socket
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

      // Timeout de 20s
      const timeoutId = setTimeout(() => {
        rejectConnection(new Error("Timeout connexion (20s)"));
      }, 20000);

      // Événements du backend
      socket.on('connect', () => {
        console.log("[Socket.IO] ✅ Transport connecté");
      });

      socket.on('connected', (data) => {
        console.log("[Socket.IO] ✅ Session:", data?.client_id);
        clearTimeout(timeoutId);
        toast.success("Connecté au serveur");
        resolveConnection();
      });

      socket.on('disconnect', () => {
        console.log("[Socket.IO] Déconnecté");
        setIsConnected(false);
        toast.info("Déconnecté");
      });

      socket.on('error', (data) => {
        console.error("[Backend] Erreur:", data.message);
        toast.error(data.message || "Erreur serveur");
      });

      socket.on('status', (data) => {
        console.log("[Status]", data);
        setStatus(data.message);
        setProgress(data.progress || 0);
      });

      socket.on('transcription', (data) => {
        console.log("[Transcription]", data.text);
        setTranscription(data.text);
      });

      socket.on('ai_response', (data) => {
        console.log("[AI Response]", data.text);
        setAiResponse(data.text);
      });

      socket.on('connect_error', (err) => {
        console.error("[Socket.IO] Erreur connexion:", err.message);
        clearTimeout(timeoutId);
        toast.error(`Erreur: ${err.message}`);
        rejectConnection(err);
      });

      // Attendre la connexion
      await connectionPromise;

      // Créer PeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Recevoir les tracks du serveur
      pc.ontrack = (event) => {
        console.log("[WebRTC] Track reçu:", event.track.kind);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          toast.success("Flux vidéo reçu");
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[ICE] Candidate:", event.candidate.candidate?.substring(0, 50));
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[ICE] State:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setIsConnected(true);
          toast.success("WebRTC connecté");
        } else if (pc.iceConnectionState === 'failed') {
          toast.error("Échec ICE");
        }
      };

      // Ajouter le track audio local pour l'envoi
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
          console.log("[WebRTC] Track audio ajouté");
        });
      } catch (err) {
        console.warn("[Audio] Pas d'accès micro:", err);
      }

      // Créer et envoyer l'offre
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      console.log("[WebRTC] Offre envoyée");
      socket.emit('webrtc_offer', {
        offer: { type: offer.type, sdp: offer.sdp }
      });

      // Attendre la réponse
      socket.once('webrtc_answer', async (data) => {
        console.log("[WebRTC] Answer reçue");
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("[WebRTC] ✅ Remote description set");
        } catch (error) {
          console.error("[WebRTC] Erreur answer:", error);
        }
      });

      setPeerConnection(pc);

      // Envoyer l'avatar si configuré
      if (config.customAvatarImage) {
        socket.emit('set_avatar', { avatar_url: config.customAvatarImage });
      }

    } catch (error) {
      console.error("[WebRTC] Erreur:", error);
      toast.error(`Erreur: ${error instanceof Error ? error.message : 'Connexion échouée'}`);
    }
  };

  const handleDisconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
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
    if (!socketRef.current?.connected) {
      toast.error("Non connecté");
      return;
    }

    setIsListening(true);
    setTranscription("");
    setAiResponse("");
    socketRef.current.emit('start_listening', {});
    toast.info("Écoute démarrée...");
  };

  const handleStopListening = () => {
    if (!socketRef.current?.connected) return;

    setIsListening(false);
    socketRef.current.emit('stop_listening', {});
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
            <div className="space-y-2">
              <label className="text-xs font-medium">URL Backend:</label>
              <Input
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="https://IP:5000"
                disabled={isConnected}
              />
            </div>
            {window.location.protocol === 'https:' && backendUrl.startsWith('http://') && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-xs">
                <strong>⚠️ Mixed Content:</strong> Votre page est en HTTPS mais le backend en HTTP. 
                Le navigateur bloque cette connexion. Solutions:
                <ul className="list-disc ml-4 mt-1">
                  <li>Configurer HTTPS sur le backend</li>
                  <li>Ou tester en local (localhost)</li>
                </ul>
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
            <strong>Backend:</strong> {backendUrl}
            <br />
            <strong>Pipeline:</strong> Audio → Whisper → OpenAI → ElevenLabs → MuseTalk → WebRTC
          </p>
        </div>
      </div>
    </Card>
  );
};

export default LocalWebRTCConversation;
