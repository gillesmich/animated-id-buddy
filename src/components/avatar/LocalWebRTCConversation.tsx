import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, Radio, MicOff, Settings, Shield, Square, Upload, CheckCircle2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import io, { Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface LocalWebRTCConversationProps {
  config: {
    customAvatarImage?: string;
    customAvatarVideo?: string;
    selectedVoice?: string;
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
  const [manualVideoPath, setManualVideoPath] = useState<string>("");
  const [avatarSent, setAvatarSent] = useState(false);
  const [avatarConfirmed, setAvatarConfirmed] = useState(false);
  const [voiceSent, setVoiceSent] = useState(false);
  const [voiceConfirmed, setVoiceConfirmed] = useState(false);
  const [streamingStage, setStreamingStage] = useState<string>("");
  
  const socketRef = useRef<Socket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastVideoTimeRef = useRef<number>(0);

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
      // Les blob URLs ne supportent pas les query params - ne pas ajouter de timestamp
      videoRef.current.src = videoUrl;
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.error("[Video] Play error:", err);
      });
      // Arrêter le polling quand on a une vidéo
      stopPolling();
    }
  }, [videoUrl]);

  // Fonction pour arrêter le polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      console.log("[Polling] Arrêt du polling");
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Fonction pour émettre des événements via WebSocket ou Socket.IO
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

  // Fonction pour vérifier les nouvelles vidéos via l'événement Socket.IO
  // Le polling HTTP direct ne fonctionne pas à cause de CORS
  // On utilise plutôt les événements du backend
  const checkForNewVideo = useCallback(() => {
    // Demander au backend la liste des vidéos via Socket.IO
    console.log("[Polling] Requesting video list via Socket.IO");
    emitEvent('get_latest_video', { path: '/results/output/' });
  }, [emitEvent]);

  // Démarrer le polling quand le traitement commence
  const startPolling = useCallback(() => {
    if (pollingRef.current) return; // Déjà en cours
    
    console.log("[Polling] Démarrage du polling sur /results/output/");
    lastVideoTimeRef.current = Date.now(); // Ignorer les anciennes vidéos
    
    // Polling toutes les 2 secondes
    pollingRef.current = setInterval(() => {
      checkForNewVideo();
    }, 2000);
    
    // Timeout après 60 secondes
    setTimeout(() => {
      if (pollingRef.current) {
        console.log("[Polling] Timeout - arrêt");
        stopPolling();
      }
    }, 60000);
  }, [checkForNewVideo, stopPolling]);

  // Démarrer le polling quand on atteint l'étape vidéo
  useEffect(() => {
    if (isProcessing && progress >= 70) {
      startPolling();
    }
    return () => {
      stopPolling();
    };
  }, [isProcessing, progress, startPolling, stopPolling]);

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
      
      // Envoyer l'avatar vidéo au backend après connexion (remplace saint-paul.mp4)
      setTimeout(() => {
        if (config.customAvatarVideo) {
          console.log("[Avatar] Envoi de la vidéo avatar au backend:", config.customAvatarVideo);
          emitEvent('set_avatar', { 
            avatar_url: config.customAvatarVideo,
            avatar_type: 'video'
          });
          toast.success("Vidéo avatar envoyée au serveur");
        } else if (config.customAvatarImage) {
          console.log("[Avatar] Envoi de l'image avatar au backend:", config.customAvatarImage);
          emitEvent('set_avatar', { 
            avatar_url: config.customAvatarImage,
            avatar_type: 'image'
          });
          toast.success("Image avatar envoyée au serveur");
        } else {
          toast.warning("Aucun avatar configuré - uploadez une image ou vidéo d'abord");
        }
      }, 500);
      
      // Envoyer la voix ElevenLabs au backend après connexion
      setTimeout(() => {
        const voiceId = config.selectedVoice || 'EXAVITQu4vr4xnSDxMaL';
        console.log("[Voice] Envoi de la voix ElevenLabs au backend:", voiceId);
        emitEvent('set_voice', { 
          voice_id: voiceId,
          voice_provider: 'elevenlabs'
        });
        setVoiceSent(true);
        toast.info(`Voix ElevenLabs envoyée: ${voiceId}`);
      }, 700);
    } catch (error) {
      console.error("[WebRTC] Erreur:", error);
      toast.error(`Erreur: ${error instanceof Error ? error.message : 'Connexion échouée'}`);
    }
  };

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isReconnectingRef = useRef(false);

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
        reconnectAttemptsRef.current = 0; // Reset reconnect counter on success
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
              isReconnectingRef.current = false;
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
        
        // Reconnexion automatique si pas une déconnexion volontaire
        if (!isReconnectingRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          isReconnectingRef.current = true;
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`[Proxy] Reconnexion dans ${delay}ms (tentative ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          toast.info(`Reconnexion... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(async () => {
            try {
              await connectViaProxy();
              // Renvoyer l'avatar après reconnexion
              setTimeout(() => {
                if (config.customAvatarVideo) {
                  emitEvent('set_avatar', { 
                    avatar_url: config.customAvatarVideo,
                    avatar_type: 'video'
                  });
                } else if (config.customAvatarImage) {
                  emitEvent('set_avatar', { 
                    avatar_url: config.customAvatarImage,
                    avatar_type: 'image'
                  });
                }
              }, 500);
            } catch (err) {
              console.error("[Proxy] Reconnexion échouée:", err);
              isReconnectingRef.current = false;
            }
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          toast.error("Connexion perdue. Cliquez sur Connecter pour réessayer.");
          isReconnectingRef.current = false;
        }
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

  const handleSocketIOEvent = useCallback(async (event: string, data: any) => {
    console.log(`[Event] ${event}:`, data);
    
    // Fonction helper pour charger la vidéo via le proxy HTTPS
    const loadVideoViaProxy = async (videoPath: string): Promise<boolean> => {
      try {
        // Extraire le nom du fichier du chemin
        let filename = videoPath;
        if (videoPath.includes('/')) {
          filename = videoPath.split('/').pop() || 'video_latest.mp4';
        }
        
        // Utiliser le proxy edge function pour éviter le blocage HTTPS/HTTP
        const proxyUrl = `https://lmxcucdyvowoshqoblhk.supabase.co/functions/v1/video-proxy?path=${encodeURIComponent(filename)}`;
        console.log("[Video] Loading via proxy:", proxyUrl);
        
        setStatus("Chargement de la vidéo...");
        
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log("[Video] Blob loaded, size:", blob.size, "type:", blob.type);
        
        if (blob.size === 0) {
          throw new Error("Vidéo vide reçue");
        }
        
        const blobUrl = URL.createObjectURL(blob);
        console.log("[Video] Blob URL created:", blobUrl);
        
        setVideoUrl(blobUrl);
        setIsProcessing(false);
        setStatus("Vidéo prête!");
        setProgress(100);
        stopPolling();
        toast.success("Vidéo chargée!");
        return true;
      } catch (error) {
        console.error("[Video] Proxy load error:", error);
        toast.error(`Erreur vidéo: ${error instanceof Error ? error.message : 'Échec'}`);
        return false;
      }
    };
    
    // Fonction helper pour extraire le chemin vidéo et charger via proxy
    const extractAndLoadVideo = async (source: any): Promise<boolean> => {
      const possiblePath = typeof source === 'string' ? source : 
        (source?.url || source?.video_url || source?.download_url || source?.path || source?.video || source?.file || source?.video_path);
      
      if (possiblePath && typeof possiblePath === 'string') {
        return await loadVideoViaProxy(possiblePath);
      }
      return false;
    };
    
    switch (event) {
      case 'error':
        toast.error(data?.message || "Erreur serveur");
        setIsProcessing(false);
        break;
      case 'status':
        setStatus(data?.message || data?.status || "");
        setProgress(data?.progress || 0);
        
        // Traiter le stage streaming spécifiquement
        if (data?.stage) {
          setStreamingStage(data.stage);
          console.log("[Status] Stage:", data.stage);
          
          if (data.stage === 'streaming') {
            toast.success("🎬 Streaming vidéo en cours...");
            // Charger automatiquement video_latest.mp4 via proxy
            await loadVideoViaProxy('video_latest.mp4');
          }
        }
        
        // Check if status contains video path
        await extractAndLoadVideo(data);
        break;
      case 'transcription':
        setTranscription(typeof data === 'string' ? data : (data?.text ?? ""));
        break;
      case 'ai_response':
        setAiResponse(typeof data === 'string' ? data : (data?.text ?? ""));
        break;
      case 'chat_result':
        // Résultat complet avec vidéo
        console.log("[chat_result] Data:", data);
        if (data?.transcription) setTranscription(data.transcription);
        if (data?.ai_response) setAiResponse(data.ai_response);
        await extractAndLoadVideo(data);
        break;
      case 'avatar_confirmed':
      case 'avatar_received':
      case 'avatar_set':
        // Confirmation de réception de l'avatar
        console.log("[Avatar] Confirmation reçue du serveur:", data);
        setAvatarConfirmed(true);
        toast.success("Avatar vidéo chargé sur le serveur (sample.mp4)");
        break;
      case 'voice_confirmed':
      case 'voice_received':
      case 'voice_set':
        // Confirmation de réception de la voix
        console.log("[Voice] Confirmation reçue du serveur:", data);
        setVoiceConfirmed(true);
        toast.success(`Voix ElevenLabs configurée: ${data?.voice_id || config.selectedVoice}`);
        break;
      case 'video_ready':
      case 'video_url':
      case 'video_done':
      case 'result':
      case 'complete':
      case 'finished':
      case 'latest_video':
      case 'video_generated':
        // URL de la vidéo générée
        console.log("[video] Event received:", event, data);
        await extractAndLoadVideo(data);
        break;
      default:
        // Log unknown events for debugging
        console.log(`[Unknown event] ${event}:`, data);
        // Check if any unknown event contains video path
        if (data && typeof data === 'object') {
          const hasVideo = await extractAndLoadVideo(data);
          if (hasVideo) {
            toast.success("Vidéo détectée!");
          }
        }
        break;
    }
  }, [stopPolling]);


  const handleDisconnect = () => {
    // Arrêter la reconnexion automatique
    reconnectAttemptsRef.current = maxReconnectAttempts; // Empêcher nouvelle reconnexion
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    isReconnectingRef.current = false;
    
    // Stop polling
    stopPolling();
    
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
    
    // Reset reconnect counter pour prochaine connexion
    reconnectAttemptsRef.current = 0;
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
          
          // Utiliser send_audio_message avec la voix ElevenLabs sélectionnée
          emitEvent('send_audio_message', {
            audio_data: base64Audio,
            audio_format: 'webm',
            voice_id: config.selectedVoice || 'EXAVITQu4vr4xnSDxMaL', // Sarah par défaut
          });
          console.log("[Audio] Voice ID envoyé:", config.selectedVoice || 'EXAVITQu4vr4xnSDxMaL');
          
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

        {/* Send Avatar Button */}
        {isConnected && (
          <div className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Envoyer Avatar au Serveur</span>
              </div>
              {avatarConfirmed && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  sample.mp4 chargé
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  if (config.customAvatarVideo) {
                    console.log("[Avatar] Envoi manuel de la vidéo:", config.customAvatarVideo);
                    setAvatarSent(true);
                    setAvatarConfirmed(false);
                    emitEvent('set_avatar', { 
                      avatar_url: config.customAvatarVideo,
                      avatar_type: 'video',
                      save_as: 'sample.mp4'
                    });
                    toast.info("Envoi de l'avatar vidéo au serveur...");
                  } else {
                    toast.warning("Aucune vidéo avatar configurée. Uploadez une vidéo d'abord.");
                  }
                }}
                disabled={!config.customAvatarVideo || avatarSent}
                className="flex-1"
                variant={avatarConfirmed ? "secondary" : "default"}
              >
                <Upload className="w-4 h-4 mr-2" />
                {avatarSent && !avatarConfirmed ? "Envoi en cours..." : avatarConfirmed ? "Renvoyer Avatar" : "Envoyer Avatar"}
              </Button>
              
              {avatarSent && !avatarConfirmed && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => {
                    setAvatarSent(false);
                  }}
                >
                  ↻
                </Button>
              )}
            </div>
            
            {config.customAvatarVideo && (
              <p className="text-xs text-muted-foreground truncate">
                Vidéo: {config.customAvatarVideo.substring(0, 60)}...
              </p>
            )}
          </div>
        )}

        {/* Send Voice Button */}
        {isConnected && (
          <div className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Voix ElevenLabs</span>
              </div>
              <div className="flex items-center gap-2">
                {streamingStage === 'streaming' && (
                  <Badge variant="default" className="bg-green-500 animate-pulse">
                    🎬 Streaming
                  </Badge>
                )}
                {voiceConfirmed && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Configurée
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Badge variant="outline" className="flex-1 justify-center py-1.5">
                {config.selectedVoice || 'EXAVITQu4vr4xnSDxMaL'} (Sarah)
              </Badge>
              <Button 
                onClick={() => {
                  const voiceId = config.selectedVoice || 'EXAVITQu4vr4xnSDxMaL';
                  console.log("[Voice] Envoi manuel de la voix:", voiceId);
                  setVoiceSent(true);
                  setVoiceConfirmed(false);
                  emitEvent('set_voice', { 
                    voice_id: voiceId,
                    voice_provider: 'elevenlabs'
                  });
                  toast.info(`Envoi de la voix ElevenLabs: ${voiceId}`);
                }}
                disabled={voiceSent && !voiceConfirmed}
                size="sm"
                variant={voiceConfirmed ? "secondary" : "default"}
              >
                <Volume2 className="w-4 h-4 mr-1" />
                {voiceSent && !voiceConfirmed ? "Envoi..." : voiceConfirmed ? "Renvoyer" : "Envoyer"}
              </Button>
            </div>
          </div>
        )}

        {/* Video Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Avatar Vidéo</span>
            </div>
            {videoUrl && <Badge variant="default">Vidéo reçue</Badge>}
          </div>
          
          {/* Manual Video URL Input */}
          <div className="flex gap-2">
            <Input
              value={manualVideoPath}
              onChange={(e) => setManualVideoPath(e.target.value)}
              placeholder="/exports/video_latest.mp4"
              className="text-xs flex-1"
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                if (manualVideoPath) {
                  const fullUrl = manualVideoPath.startsWith('http') 
                    ? manualVideoPath 
                    : `${backendUrl}${manualVideoPath.startsWith('/') ? '' : '/'}${manualVideoPath}`;
                  console.log("[Manual] Loading video:", fullUrl);
                  setVideoUrl(fullUrl);
                  setIsProcessing(false);
                  setStatus("Vidéo chargée!");
                  setProgress(100);
                  toast.success("Vidéo chargée!");
                }
              }}
            >
              Charger
            </Button>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={async () => {
                // Use edge function proxy to avoid mixed content blocking
                const proxyUrl = `https://lmxcucdyvowoshqoblhk.supabase.co/functions/v1/video-proxy?path=video_latest.mp4`;
                console.log("[Refresh] Fetching video via proxy:", proxyUrl);
                toast.info("Chargement de la vidéo via proxy...");
                
                try {
                  const response = await fetch(proxyUrl);
                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                  }
                  const blob = await response.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  console.log("[Refresh] Blob URL created:", blobUrl, "Size:", blob.size);
                  setVideoUrl(blobUrl);
                  setIsProcessing(false);
                  setStatus("Vidéo chargée!");
                  setProgress(100);
                  toast.success("Vidéo chargée avec succès!");
                } catch (error) {
                  console.error("[Refresh] Proxy error:", error);
                  toast.error(`Erreur: ${error instanceof Error ? error.message : 'Échec du chargement'}`);
                }
              }}
              disabled={!isConnected}
            >
              🔄 Refresh
            </Button>
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
