import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, Radio, MicOff, Settings, Shield, Square } from "lucide-react";
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [transcription, setTranscription] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [backendUrl, setBackendUrl] = useState('http://51.255.153.127:5000');
  const [useProxy, setUseProxy] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  
  const socketRef = useRef<Socket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // URL du proxy Supabase
  const proxyUrl = `wss://lmxcucdyvowoshqoblhk.supabase.co/functions/v1/socketio-proxy?backend=${encodeURIComponent(backendUrl)}`;

  useEffect(() => {
    return () => {
      handleDisconnect();
    };
  }, []);

  // Jouer la vidéo quand l'URL change
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      console.log("[Video] Playing:", videoUrl);
      // Ajouter un timestamp pour éviter le cache
      const urlWithCache = videoUrl.includes('?') ? `${videoUrl}&t=${Date.now()}` : `${videoUrl}?t=${Date.now()}`;
      videoRef.current.src = urlWithCache;
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.error("[Video] Play error:", err);
      });
    }
  }, [videoUrl]);

  const handleConnect = async () => {
    try {
      console.log("[WebRTC] Mode:", useProxy ? "Proxy HTTPS" : "Direct");
      console.log("[WebRTC] Backend:", backendUrl);
      toast.info(useProxy ? "Connexion via proxy HTTPS..." : "Connexion directe...");

      if (useProxy) {
        await connectViaProxy();
      } else {
        await connectDirect();
      }
      
      // Envoyer l'avatar au backend après connexion
      if (config.customAvatarImage) {
        console.log("[Avatar] Envoi de l'avatar au backend...");
        setTimeout(() => {
          emitEvent('set_avatar', { 
            avatar_url: config.customAvatarImage,
            avatar_type: 'image'
          });
          toast.success("Avatar configuré sur le backend");
        }, 500);
      } else {
        toast.warning("Aucun avatar configuré - uploadez une image d'abord");
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
          console.log("[Proxy] Message:", message.event || message.type, message.data);

          if (message.type === 'socketio_event') {
            handleSocketIOEvent(message.event, message.data);
            
            if (message.event === 'connected' || message.event === 'connect') {
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

    // Events du backend
    socket.on('error', (data) => handleSocketIOEvent('error', data));
    socket.on('status', (data) => handleSocketIOEvent('status', data));
    socket.on('transcription', (data) => handleSocketIOEvent('transcription', data));
    socket.on('ai_response', (data) => handleSocketIOEvent('ai_response', data));
    socket.on('chat_result', (data) => handleSocketIOEvent('chat_result', data));
    socket.on('video_ready', (data) => handleSocketIOEvent('video_ready', data));
    socket.on('video_url', (data) => handleSocketIOEvent('video_url', data));

    socket.on('connect_error', (err) => {
      console.error("[Socket.IO] Erreur connexion:", err.message);
      clearTimeout(timeoutId);
      toast.error(`Erreur: ${err.message}`);
      rejectConnection(err);
    });

    await connectionPromise;
  };

  const handleSocketIOEvent = useCallback((event: string, data: any) => {
    console.log(`[Event] ${event}:`, data);
    
    switch (event) {
      case 'error':
        toast.error(data?.message || "Erreur serveur");
        setIsProcessing(false);
        break;
      case 'status':
        setStatus(data?.message || data?.status || "");
        setProgress(data?.progress || 0);
        break;
      case 'transcription':
        setTranscription(data?.text || data || "");
        break;
      case 'ai_response':
        setAiResponse(data?.text || data || "");
        break;
      case 'chat_result':
        // Résultat complet avec vidéo
        console.log("[chat_result] Data:", data);
        if (data?.transcription) setTranscription(data.transcription);
        if (data?.ai_response) setAiResponse(data.ai_response);
        if (data?.video_url) {
          // URL absolue ou relative au backend
          const fullVideoUrl = data.video_url.startsWith('http') 
            ? data.video_url 
            : `${backendUrl}${data.video_url}`;
          console.log("[chat_result] Video URL:", fullVideoUrl);
          setVideoUrl(fullVideoUrl);
        }
        setIsProcessing(false);
        break;
      case 'video_ready':
      case 'video_url':
        // URL de la vidéo générée
        console.log("[video] URL received:", data);
        const url = data?.url || data?.video_url || data;
        if (url) {
          const fullUrl = url.startsWith('http') ? url : `${backendUrl}${url}`;
          setVideoUrl(fullUrl);
        }
        setIsProcessing(false);
        break;
    }
  }, [backendUrl]);

  const emitEvent = useCallback((event: string, data: any = {}) => {
    console.log(`[Emit] ${event}:`, data);
    if (useProxy && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'emit', event, data }));
    } else if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn("[Emit] Not connected!");
    }
  }, [useProxy]);

  const handleDisconnect = () => {
    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsListening(false);
    setIsProcessing(false);
    setStatus("");
    setProgress(0);
  };

  const handleStartListening = async () => {
    if (!isConnected) {
      toast.error("Non connecté");
      return;
    }

    try {
      // Demander l'accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      audioChunksRef.current = [];
      
      // Créer le MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stopper le flux audio
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) {
          toast.error("Aucun audio enregistré");
          setIsListening(false);
          return;
        }

        // Créer le blob audio
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log("[Audio] Recorded blob size:", audioBlob.size);
        
        // Convertir en base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = (reader.result as string).split(',')[1];
          console.log("[Audio] Base64 length:", base64Audio.length);
          
          // Envoyer au backend avec le vrai audio
          setIsProcessing(true);
          setStatus("Envoi de l'audio...");
          setProgress(10);
          
          // Utiliser send_audio_message (événement attendu par le backend)
          emitEvent('send_audio_message', {
            audio_data: base64Audio,
            audio_format: 'webm',
          });
          
          toast.info("Audio envoyé, traitement en cours...");
        };
        reader.readAsDataURL(audioBlob);
        
        audioChunksRef.current = [];
      };

      // Démarrer l'enregistrement
      mediaRecorder.start(100); // Collecter des chunks toutes les 100ms
      setIsListening(true);
      setTranscription("");
      setAiResponse("");
      toast.info("🎤 Parlez maintenant...");
      
    } catch (error) {
      console.error("[Mic] Error:", error);
      toast.error("Erreur accès microphone");
    }
  };

  const handleStopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log("[Audio] Stopping recording...");
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
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
          </div>
        )}

        {/* Status */}
        {(status || isProcessing) && (
          <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{status || "Traitement..."}</span>
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
                <span className="text-muted-foreground font-medium">Vous: </span>{transcription}
              </div>
            )}
            {aiResponse && (
              <div className="p-2 rounded bg-primary/10 text-sm">
                <span className="text-primary font-medium">IA: </span>{aiResponse}
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
              <span className="text-sm font-medium">Avatar Vidéo</span>
            </div>
            {videoUrl && <Badge variant="default">Vidéo reçue</Badge>}
          </div>
          
          <div className="relative rounded-lg overflow-hidden border border-border/50 bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              controls
              className="w-full h-full object-contain"
            />
            {!videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-sm text-muted-foreground">
                  {isProcessing ? "Génération vidéo en cours..." : "En attente de vidéo..."}
                </p>
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
              disabled={isProcessing}
            >
              {isListening ? (
                <>
                  <Square className="w-5 h-5" />
                  Arrêter l'enregistrement
                </>
              ) : isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Traitement...
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
            <strong>Pipeline:</strong> Audio → Transcription → IA → TTS → MuseTalk → Vidéo
          </p>
        </div>
      </div>
    </Card>
  );
};

export default LocalWebRTCConversation;
