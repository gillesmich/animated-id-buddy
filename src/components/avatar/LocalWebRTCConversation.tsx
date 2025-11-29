import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, Loader2, Download, Radio } from "lucide-react";
import { toast } from "sonner";
import io, { Socket } from "socket.io-client";

interface LocalWebRTCConversationProps {
  config: {
    customAvatarImage?: string;
    customAvatarVideo?: string;
  };
}

const STORAGE_KEY = 'musetalk_webrtc_video_history';

const LocalWebRTCConversation = ({ config }: LocalWebRTCConversationProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [backendUrl] = useState('http://localhost:8000'); // URL du backend Python local
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Charger l'historique des vidéos au démarrage
  useEffect(() => {
    return () => {
      // Cleanup lors du démontage
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, [peerConnection]);

  const handleConnect = async () => {
    try {
      console.log("[WebRTC] Initialisation de la connexion...");
      console.log("[WebRTC] Tentative de connexion à:", backendUrl);
      toast.info("Connexion au backend Python via Socket.IO...");

      // 1. Établir la connexion Socket.IO
      const socket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 15000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log("[Socket.IO] ✅ Connecté au serveur");
        toast.success("Socket.IO connecté");
      });

      socket.on('server_message', (data) => {
        console.log("[Socket.IO] Message du serveur:", data);
      });

      socket.on('disconnect', () => {
        console.log("[Socket.IO] Déconnecté du serveur");
        setIsConnected(false);
        toast.info("Déconnecté du serveur");
      });

      socket.on('webrtc_error', (data) => {
        console.error("[WebRTC] Erreur:", data);
        toast.error(data.error || "Erreur WebRTC");
        setIsGenerating(false);
      });

      socket.on('connect_error', (err) => {
        console.error("[Socket.IO] Erreur de connexion:", err.message);
        toast.error(`Erreur Socket.IO: ${err.message}`);
      });

      // Attendre la connexion Socket.IO
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', (err) => {
          console.error("[Socket.IO] connect_error:", err);
          reject(new Error(`Impossible de se connecter à ${backendUrl}: ${err.message}`));
        });
        setTimeout(() => {
          console.error("[Socket.IO] Timeout après 15s");
          reject(new Error(`Timeout Socket.IO (15s) - Le backend ${backendUrl} ne répond pas`));
        }, 15000);
      });

      // 2. Créer la PeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // 3. Gérer les tracks reçus (vidéo/audio du serveur)
      pc.ontrack = (event) => {
        console.log("[WebRTC] Track reçu:", event.track.kind);
        if (videoRef.current && event.streams && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          toast.success("Flux vidéo reçu du serveur");
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[WebRTC] ICE candidate local:", event.candidate);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[WebRTC] ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setIsConnected(true);
          toast.success("Connexion WebRTC établie");
        } else if (pc.iceConnectionState === 'failed') {
          toast.error("Échec de la connexion ICE");
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[WebRTC] Connection state:", pc.connectionState);
      };

      // 4. Créer l'offre
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      console.log("[WebRTC] Offre créée:", offer);

      // 5. Envoyer l'offre au serveur Python via Socket.IO
      socket.emit('webrtc_offer', {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });

      // 6. Attendre la réponse du serveur
      socket.once('webrtc_answer', async (data) => {
        console.log("[WebRTC] Answer reçue:", data.answer);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("[WebRTC] Remote description définie");
          toast.success("Connexion WebRTC établie avec le backend");
        } catch (error) {
          console.error("[WebRTC] Erreur setRemoteDescription:", error);
          toast.error("Erreur lors de la configuration WebRTC");
        }
      });

      setPeerConnection(pc);

    } catch (error) {
      console.error("[WebRTC] Erreur de connexion:", error);
      toast.error(`Erreur: ${error instanceof Error ? error.message : 'Connexion échouée'}`);
    }
  };

  const handleDisconnect = () => {
    console.log("[WebRTC] Déconnexion");
    
    if (socketRef.current) {
      socketRef.current.emit('webrtc_close');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsConnected(false);
    toast.info("Déconnecté du serveur WebRTC");
  };

  const handleSpeak = async () => {
    if (!socketRef.current || !socketRef.current.connected) {
      toast.error("Socket.IO non connecté");
      return;
    }

    try {
      setIsSpeaking(true);
      setIsGenerating(true);
      
      console.log("[Audio] Démarrage enregistrement...");
      toast.info("Enregistrement audio...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        console.log("[Audio] Enregistré:", audioBlob.size, "bytes");

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          // Envoyer via Socket.IO
          socketRef.current?.emit('upload_audio_b64', {
            audio_base64: base64Audio
          });

          console.log("[Socket.IO] Audio envoyé");
          toast.success("Audio envoyé au serveur");
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach(track => track.stop());
        setIsSpeaking(false);
      };

      // Gérer les réponses du serveur
      socketRef.current.once('upload_success', (data) => {
        console.log("[Socket.IO] Audio uploadé avec succès:", data);
        toast.success(`Audio traité (${data.duration.toFixed(2)}s)`);
        setIsGenerating(false);
      });

      socketRef.current.once('upload_error', (data) => {
        console.error("[Socket.IO] Erreur upload:", data);
        toast.error(data.error || "Erreur lors de l'upload");
        setIsGenerating(false);
      });

      mediaRecorder.start();
      
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          toast.info("Enregistrement terminé");
        }
      }, 5000);

    } catch (error) {
      console.error("[Audio] Erreur:", error);
      toast.error("Erreur lors de l'enregistrement");
      setIsSpeaking(false);
      setIsGenerating(false);
    }
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
              <h3 className="font-semibold text-lg">WebRTC Connection</h3>
              <p className="text-sm text-muted-foreground">Connexion peer-to-peer</p>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connecté" : "Déconnecté"}
          </Badge>
        </div>

        {/* Connection Status */}
        <div className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">État de la connexion</span>
            <Badge variant={isConnected ? "default" : "outline"}>
              {isConnected ? "En ligne" : "Hors ligne"}
            </Badge>
          </div>
          
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Génération en cours...</span>
            </div>
          )}
        </div>

        {/* Connection Controls */}
        <div className="flex gap-3">
          {!isConnected ? (
            <Button 
              onClick={handleConnect}
              className="flex-1"
              size="lg"
            >
              <Radio className="w-5 h-5 mr-2" />
              Connecter WebRTC
            </Button>
          ) : (
            <Button 
              onClick={handleDisconnect}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              Déconnecter
            </Button>
          )}
        </div>

        {/* Video Display - WebRTC Stream */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Flux vidéo WebRTC</span>
            </div>
            {isConnected && (
              <Badge variant="default">En direct</Badge>
            )}
          </div>
          
          <div className="relative rounded-lg overflow-hidden border border-border/50 bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              onError={(e) => {
                console.error('[VIDEO] Erreur:', e);
                toast.error('Erreur vidéo');
              }}
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
          <div className="flex justify-center gap-3">
            <Button
              onClick={handleSpeak}
              disabled={isGenerating || isSpeaking}
              size="lg"
              className="gap-2"
            >
              <Mic className="w-5 h-5" />
              {isSpeaking ? "Enregistrement..." : isGenerating ? "Traitement..." : "Parler"}
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-muted-foreground">
            <strong>WebRTC + Socket.IO:</strong> Connexion au backend Python via Socket.IO pour la signalisation,
            puis WebRTC pour le streaming vidéo/audio en temps réel avec aiortc.
            <br />
            <strong>Backend:</strong> {backendUrl}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default LocalWebRTCConversation;
