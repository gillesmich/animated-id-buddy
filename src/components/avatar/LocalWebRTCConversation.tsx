import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, Volume2, Loader2, Download, Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface LocalWebRTCConversationProps {
  config: {
    customAvatarImage?: string;
    customAvatarVideo?: string;
  };
}

const STORAGE_KEY = 'musetalk_webrtc_video_history';

const LocalWebRTCConversation = ({ config }: LocalWebRTCConversationProps) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState(0);
  const [videoHistory, setVideoHistory] = useState<Array<{ url: string; timestamp: Date }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Charger l'historique des vidéos au démarrage
  useEffect(() => {
    const loadVideoHistory = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const history = parsed.map((item: any) => ({
            url: item.url,
            timestamp: new Date(item.timestamp)
          }));
          setVideoHistory(history);
          
          if (history.length > 0) {
            const lastVideo = history[history.length - 1];
            setVideoUrl(lastVideo.url);
            setVideoKey(prev => prev + 1);
            toast.success(`Dernière vidéo rechargée (${history.length} vidéos en cache)`);
          }
        }
      } catch (error) {
        console.error('Erreur chargement historique:', error);
      }
    };
    loadVideoHistory();
  }, []);

  // Sauvegarder l'historique à chaque mise à jour
  useEffect(() => {
    if (videoHistory.length > 0) {
      try {
        const toStore = videoHistory.map(v => ({
          url: v.url,
          timestamp: v.timestamp.toISOString()
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      } catch (error) {
        console.error('Erreur sauvegarde historique:', error);
      }
    }
  }, [videoHistory]);

  const handleConnect = async () => {
    try {
      console.log("[WebRTC] Initialisation de la connexion...");
      toast.info("Connexion au serveur de signalisation...");

      // 1. Créer une session via le serveur de signalisation
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke(
        'webrtc-signaling',
        { 
          body: {},
          method: 'POST'
        }
      );

      if (sessionError) throw sessionError;
      
      const newSessionId = sessionData.sessionId;
      setSessionId(newSessionId);
      console.log("[WebRTC] Session créée:", newSessionId);

      // 2. Créer une connexion RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // 3. Créer un data channel pour échanger des données
      const dc = pc.createDataChannel('musetalk', {
        ordered: true
      });

      dc.onopen = () => {
        console.log("[WebRTC] Data channel ouvert");
        setIsConnected(true);
        toast.success("Connexion WebRTC établie");
      };

      dc.onclose = () => {
        console.log("[WebRTC] Data channel fermé");
        setIsConnected(false);
        toast.info("Connexion WebRTC fermée");
      };

      dc.onerror = (error) => {
        console.error("[WebRTC] Erreur data channel:", error);
        toast.error("Erreur dans le canal de données");
      };

      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[WebRTC] Message reçu:", data);

          if (data.type === 'video_ready') {
            const newVideoUrl = data.url;
            setVideoUrl(newVideoUrl);
            setVideoKey(prev => prev + 1);
            
            setVideoHistory(prev => [
              ...prev,
              { url: newVideoUrl, timestamp: new Date() }
            ]);
            
            setIsGenerating(false);
            toast.success("Vidéo générée avec succès!");
          } else if (data.type === 'status') {
            toast.info(data.message);
          } else if (data.type === 'error') {
            toast.error(data.message);
            setIsGenerating(false);
          }
        } catch (error) {
          console.error("[WebRTC] Erreur parsing message:", error);
        }
      };

      // 4. Gérer les événements ICE - envoyer au serveur de signalisation
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log("[WebRTC] ICE candidate:", event.candidate);
          try {
            await supabase.functions.invoke('webrtc-signaling', {
              body: {
                sessionId: newSessionId,
                candidate: event.candidate
              }
            });
          } catch (error) {
            console.error("[WebRTC] Erreur envoi ICE candidate:", error);
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[WebRTC] ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          toast.error("Échec de la connexion ICE");
        }
      };

      // 5. Créer une offre SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("[WebRTC] Offre SDP créée");

      // 6. Envoyer l'offre au serveur de signalisation et obtenir la réponse
      toast.info("Échange des paramètres de connexion...");
      const { data: answerData, error: answerError } = await supabase.functions.invoke(
        'webrtc-signaling',
        {
          body: {
            sessionId: newSessionId,
            offer: pc.localDescription
          }
        }
      );

      if (answerError) throw answerError;

      // 7. Définir la description distante avec la réponse
      await pc.setRemoteDescription(new RTCSessionDescription(answerData.answer));
      console.log("[WebRTC] Réponse SDP appliquée");

      setPeerConnection(pc);
      setDataChannel(dc);

      toast.success("Connexion WebRTC initialisée");

    } catch (error) {
      console.error("[WebRTC] Erreur de connexion:", error);
      toast.error(`Erreur: ${error instanceof Error ? error.message : 'Connexion WebRTC échouée'}`);
    }
  };

  const handleDisconnect = async () => {
    console.log("[WebRTC] Déconnexion");
    
    if (dataChannel) {
      dataChannel.close();
      setDataChannel(null);
    }
    
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    
    // Fermer la session sur le serveur de signalisation
    if (sessionId) {
      try {
        await supabase.functions.invoke('webrtc-signaling', {
          body: { sessionId }
        });
      } catch (error) {
        console.error("[WebRTC] Erreur fermeture session:", error);
      }
      setSessionId(null);
    }
    
    setIsConnected(false);
    toast.info("Déconnecté du serveur WebRTC");
  };

  const handleSpeak = async () => {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      toast.error("Canal de données non disponible");
      return;
    }

    try {
      setIsSpeaking(true);
      setIsGenerating(true);
      
      console.log("[WebRTC] Démarrage enregistrement audio...");
      toast.info("Enregistrement audio...");

      // Obtenir l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log("[WebRTC] Audio enregistré:", audioBlob.size, "bytes");

        // Convertir en base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          
          // Envoyer via le data channel
          dataChannel.send(JSON.stringify({
            type: 'audio_data',
            audio: base64Audio,
            avatar_url: config.customAvatarVideo || config.customAvatarImage,
            timestamp: new Date().toISOString()
          }));

          console.log("[WebRTC] Audio envoyé via data channel");
          toast.success("Audio envoyé au serveur");
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach(track => track.stop());
        setIsSpeaking(false);
      };

      mediaRecorder.start();
      
      // Enregistrer pendant 5 secondes
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          toast.info("Enregistrement terminé, traitement en cours...");
        }
      }, 5000);

    } catch (error) {
      console.error("[WebRTC] Erreur enregistrement:", error);
      toast.error("Erreur lors de l'enregistrement audio");
      setIsSpeaking(false);
      setIsGenerating(false);
    }
  };

  const handleDownloadLastVideo = () => {
    if (!videoUrl) {
      toast.error("Aucune vidéo à télécharger");
      return;
    }
    
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `musetalk_webrtc_${new Date().getTime()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Téléchargement démarré");
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

        {/* Video Display */}
        {videoUrl && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Vidéo générée</span>
              </div>
              <Badge variant="outline">
                {videoHistory.length} vidéo{videoHistory.length > 1 ? 's' : ''}
              </Badge>
            </div>
            
            <div className="relative rounded-lg overflow-hidden border border-border/50 bg-black aspect-video">
              <video
                key={videoKey}
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full h-full object-contain"
                onError={(e) => {
                  console.error('[VIDEO] Erreur de chargement:', e);
                  toast.error('Erreur de chargement de la vidéo');
                }}
              />
            </div>
          </div>
        )}

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
            {videoUrl && (
              <Button
                onClick={handleDownloadLastVideo}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Download className="w-5 h-5" />
                Télécharger
              </Button>
            )}
          </div>
        )}

        {/* Info */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-muted-foreground">
            <strong>WebRTC:</strong> Connexion peer-to-peer directe pour une latence minimale.
            Le data channel permet l'échange bidirectionnel de données en temps réel.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default LocalWebRTCConversation;
