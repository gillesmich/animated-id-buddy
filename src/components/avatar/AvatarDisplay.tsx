import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Video, Play } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import VoiceControls from "./VoiceControls";
import ErrorOverlay from "./ErrorOverlay";
import { debounce } from "@/utils/audioUtils";
import { VideoTransitionManager } from "@/utils/videoTransitions";
import "./avatar-transitions.css";

interface AvatarDisplayProps {
  config: {
    didApiKey: string;
    openaiApiKey: string;
    elevenlabsApiKey: string;
    selectedAvatar: string;
    customAvatarImage: string;
    selectedVoice: string;
    selectedModel: string;
    selectedWorkflow: string;
    workflows: Array<{ id: string; name: string; webhookUrl: string }>;
    useN8n?: boolean;
  };
}

const AvatarDisplay = ({ config }: AvatarDisplayProps) => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<Array<{ role: string; content: string; type?: 'text' | 'voice' }>>([]);
  const [streamingText, setStreamingText] = useState("");
  const [apiError, setApiError] = useState<{ title: string; message: string; timestamp: Date } | null>(null);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const { toast } = useToast();
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const transitionManagerRef = useRef<VideoTransitionManager | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Avatar preview URLs - URLs officielles D-ID
  const avatarPreviews: Record<string, string> = {
    amy: "https://create-images-results.d-id.com/default_presenter_image/amy/image.jpeg",
    john: "https://create-images-results.d-id.com/default_presenter_image/maya/image.jpeg",
    sophia: "https://create-images-results.d-id.com/default_presenter_image/stacey/image.jpeg",
    marcus: "https://create-images-results.d-id.com/default_presenter_image/oliver/image.jpeg",
  };

  const [sourceImageUrl, setSourceImageUrl] = useState<string>(avatarPreviews.amy);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>(avatarPreviews.amy);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const posterImages: Record<string, string> = {
    amy: "https://create-images-results.d-id.com/default_presenter_image/amy/image.jpeg",
    john: "https://create-images-results.d-id.com/default_presenter_image/maya/image.jpeg",
    sophia: "https://create-images-results.d-id.com/default_presenter_image/stacey/image.jpeg",
    marcus: "https://create-images-results.d-id.com/default_presenter_image/oliver/image.jpeg",
  };

  // Auto-scroll to latest message
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, streamingText]);

  // Initialiser le gestionnaire de transitions
  useEffect(() => {
    if (videoRef.current && secondaryVideoRef.current) {
      transitionManagerRef.current = new VideoTransitionManager(
        videoRef.current,
        secondaryVideoRef.current,
        "" // Pas de vidéo idle par défaut
      );

      console.log("🎬 Gestionnaire de transitions initialisé");
    }

    return () => {
      transitionManagerRef.current?.cleanup();
    };
  }, [config.customAvatarImage, config.selectedAvatar, isStreaming]);

  // Load avatar preview when selection changes
  useEffect(() => {
    console.log("🔄 Avatar config:", { 
      selectedAvatar: config.selectedAvatar, 
      customAvatarImage: config.customAvatarImage?.substring(0, 50),
      hasAvatarPreviews: Object.keys(avatarPreviews).length
    });
    
    // Priorité à l'image personnalisée
    if (config.customAvatarImage) {
      console.log("📸 Chargement image personnalisée");
      setSourceImageUrl(config.customAvatarImage);
      setCurrentVideoUrl(config.customAvatarImage);
    } else if (config.selectedAvatar && avatarPreviews[config.selectedAvatar]) {
      const avatarUrl = avatarPreviews[config.selectedAvatar];
      console.log("📸 Chargement avatar D-ID:", avatarUrl);
      setSourceImageUrl(avatarUrl);
      setCurrentVideoUrl(avatarUrl);
    } else {
      console.log("⚠️ Aucun avatar configuré - utilisation avatar par défaut");
      // Fallback vers Amy (premier avatar) par défaut
      const defaultAvatar = avatarPreviews.amy || Object.values(avatarPreviews)[0];
      if (defaultAvatar) {
        console.log("📸 Avatar par défaut:", defaultAvatar);
        setSourceImageUrl(defaultAvatar);
        setCurrentVideoUrl(defaultAvatar);
      } else {
        console.error("❌ Aucun avatar disponible!");
        setSourceImageUrl("");
        setCurrentVideoUrl("");
      }
    }
  }, [config.selectedAvatar, config.customAvatarImage]);





  // Generate preview animation with D-ID
  const generatePreviewAnimation = async () => {
    if (!sourceImageUrl) {
      toast({
        title: "Avatar manquant",
        description: "Sélectionnez d'abord un avatar",
        variant: "destructive",
      });
      return;
    }

    setIsVideoLoading(true);

    try {
      console.log("🎬 Génération D-ID démarrée");
      console.log("📸 Image source URL:", sourceImageUrl);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/did-avatar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create_talk',
            data: {
              source_url: sourceImageUrl,
              script: {
                type: 'text',
                input: 'Bonjour! Je suis votre assistant virtuel intelligent. Comment puis-je vous aider aujourd\'hui?',
                provider: {
                  type: 'microsoft',
                  voice_id: 'fr-FR-DeniseNeural'
                }
              },
              config: {
                fluent: true,
                pad_audio: 0,
                stitch: true,
                result_format: 'mp4'
              }
            }
          }),
        }
      );

      console.log("📡 Réponse D-ID:", response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erreur D-ID:', response.status, errorData);
        
        let errorTitle = "Erreur API D-ID";
        let errorMessage = `Erreur D-ID: ${errorData.error || response.status}`;
        
        if (response.status === 401) {
          errorTitle = "Authentification échouée";
          errorMessage = "Clé D-ID non configurée ou invalide.";
        } else if (response.status === 500) {
          errorTitle = "Internal Server Error";
          errorMessage = "Erreur serveur D-ID. Le service rencontre des difficultés. Veuillez réessayer dans quelques instants.";
        } else if (response.status === 429) {
          errorTitle = "Limite atteinte";
          errorMessage = "Trop de requêtes. Attendez quelques instants avant de réessayer.";
        }
        
        setApiError({
          title: errorTitle,
          message: errorMessage,
          timestamp: new Date()
        });
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ D-ID talk créé:", data);
      const talkId = data.id;

      // Poll for video status
      let attempts = 0;
      const maxAttempts = 60;
      
      const pollVideo = async (): Promise<string> => {
        attempts++;
        console.log(`Vérification statut ${attempts}/${maxAttempts}`);
        
        if (attempts > maxAttempts) {
          throw new Error("Timeout génération vidéo");
        }

        const statusResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/did-avatar`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'get_talk',
              data: { talkId }
            }),
          }
        );

        if (!statusResponse.ok) {
          throw new Error("Erreur vérification statut");
        }

        const statusData = await statusResponse.json();
        console.log(`Statut D-ID (tentative ${attempts}):`, statusData.status);

        if (statusData.status === 'done' && statusData.result_url) {
          return statusData.result_url;
        } else if (statusData.status === 'error' || statusData.status === 'rejected') {
          throw new Error(statusData.error?.description || 'Erreur de génération');
        }

        // Attendre 2 secondes avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 2000));
        return pollVideo();
      };

      const videoUrl = await pollVideo();
      
      setCurrentVideoUrl(videoUrl);
      setIsVideoLoading(false);
      
      // Auto-play video
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = videoUrl;
        videoRef.current.play().catch(err => console.log("Autoplay bloqué:", err));
      }

      toast({
        title: "Prévisualisation prête",
        description: "Animation de l'avatar générée avec succès!",
      });

    } catch (error) {
      setIsVideoLoading(false);
      console.error('Preview generation error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Échec de génération. Vérifiez votre clé D-ID.";
      
      setApiError({
        title: "Erreur de génération",
        message: errorMessage,
        timestamp: new Date()
      });
      
      toast({
        title: "Erreur de génération",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const sendToWorkflow = async (messageText: string, audioBase64?: string) => {
    const selectedWorkflow = config.workflows.find(w => w.id === config.selectedWorkflow);
    
    if (!selectedWorkflow) {
      throw new Error("Aucun workflow sélectionné");
    }

    try {
      const response = await fetch(selectedWorkflow.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          avatarId: config.customAvatarImage || config.selectedAvatar,
          voiceId: config.selectedVoice,
          model: config.selectedModel,
          audio: audioBase64,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur workflow: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Workflow error:', error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    // Validation
    if (!config.didApiKey || !config.openaiApiKey || !config.elevenlabsApiKey) {
      toast({
        title: "Configuration manquante",
        description: "Veuillez configurer toutes les clés API",
        variant: "destructive",
      });
      return;
    }

    if (!config.selectedAvatar || !config.selectedVoice || !config.selectedModel) {
      toast({
        title: "Sélection manquante",
        description: "Veuillez sélectionner avatar, voix et modèle",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setConversation([...conversation, { role: "user", content: message, type: 'text' }]);
    const userMessage = message;
    setMessage("");

    try {
      // Mode n8n workflow
      if (config.useN8n && config.selectedWorkflow) {
        console.log("🔀 Utilisation du workflow n8n");
        const result = await sendToWorkflow(userMessage);
        
        // Simulate streaming text
        const responseText = result.text || "Réponse du workflow reçue avec succès";
        let currentText = "";
        
        for (let i = 0; i < responseText.length; i++) {
          currentText += responseText[i];
          setStreamingText(currentText);
          await new Promise(resolve => setTimeout(resolve, 30));
        }
        
        setConversation((prev) => [
          ...prev,
          { role: "assistant", content: responseText, type: 'text' },
        ]);
        setStreamingText("");
        
        toast({
          title: "Réponse reçue",
          description: "Le workflow a traité votre message",
        });
      } 
      // Mode Python Backend (par défaut)
      else {
        console.error("Backend Python non configuré");
      }
    } catch (error) {
      console.error('Send message error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Échec de l'envoi";
      
      setApiError({
        title: "Erreur d'envoi",
        message: errorMessage,
        timestamp: new Date()
      });
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceMessage = async (audioBase64: string) => {
    setIsLoading(true);

    try {
      // Étape 1: Transcription avec Whisper
      console.log("🎤 Étape 1: Transcription Whisper...");
      toast({
        title: "🎤 Transcription...",
        description: "Analyse de votre message vocal",
      });

      const transcriptionResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whisper-transcribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audioBase64 }),
        }
      );

      if (!transcriptionResponse.ok) {
        throw new Error('Erreur de transcription');
      }

      const { text: transcription } = await transcriptionResponse.json();
      console.log("✅ Transcription:", transcription);
      
      // Filtrage: ignorer les transcriptions vides ou trop courtes
      const cleanTranscription = transcription.trim();
      if (!cleanTranscription || cleanTranscription.length < 5) {
        console.log("⚠️ Transcription trop courte ou vide, ignorée:", cleanTranscription);
        setIsLoading(false);
        return;
      }
      
      // Filtrage: ignorer les phrases de remerciement génériques
      const genericPhrases = ["merci à tous", "au revoir", "merci et"];
      if (genericPhrases.some(phrase => cleanTranscription.toLowerCase().includes(phrase)) && cleanTranscription.length < 30) {
        console.log("⚠️ Phrase générique détectée, ignorée:", cleanTranscription);
        setIsLoading(false);
        return;
      }
      
      setConversation((prev) => [...prev, { role: "user", content: cleanTranscription, type: 'voice' }]);

      // Étape 2: Génération de réponse avec OpenAI
      console.log("🤖 Étape 2: Génération réponse OpenAI...");
      toast({
        title: "🤖 Réflexion...",
        description: "Génération de la réponse",
      });

      const chatResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'Tu es un assistant virtuel intelligent et amical. Réponds de manière concise et naturelle.' },
              { role: 'user', content: cleanTranscription }
            ],
            model: config.selectedModel || 'gpt-4o-mini',
          }),
        }
      );

      if (!chatResponse.ok) {
        throw new Error('Erreur de génération de réponse');
      }

      const chatData = await chatResponse.json();
      const responseText = chatData.choices[0].message.content;
      console.log("✅ Réponse OpenAI:", responseText);

      // Affichage streaming de la réponse
      let currentText = "";
      for (let i = 0; i < responseText.length; i++) {
        currentText += responseText[i];
        setStreamingText(currentText);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: responseText, type: 'text' },
      ]);
      setStreamingText("");

      // Étape 3: Génération vidéo avec D-ID Talks API
      console.log("🎬 Étape 3: Génération vidéo D-ID...");
      
      if (!sourceImageUrl) {
        console.log("⚠️ Pas d'avatar configuré - sourceImageUrl vide");
        toast({
          title: "Avatar manquant",
          description: "Veuillez sélectionner un avatar dans la configuration",
          variant: "destructive",
        });
        return;
      }
      
      console.log("📸 Avatar URL:", sourceImageUrl.substring(0, 100));
      
      // Validation de la longueur du texte
      let textForVideo = responseText;
      if (textForVideo.length > 1000) {
        console.warn("⚠️ Texte trop long, troncature à 1000 caractères");
        textForVideo = textForVideo.substring(0, 997) + "...";
      }
      
      setIsVideoLoading(true);
      toast({
        title: "🎬 Génération vidéo...",
        description: "Création de l'animation",
      });
      
      try {
        // Créer une vidéo avec l'edge function D-ID
        const talkResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/did-avatar`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'create_talk',
              data: {
                source_url: sourceImageUrl,
                script: {
                  type: 'text',
                  input: textForVideo,
                  provider: {
                    type: 'microsoft',
                    voice_id: 'fr-FR-DeniseNeural'
                  }
                },
                config: {
                  fluent: true,
                  pad_audio: 0,
                  stitch: true,
                  result_format: 'mp4'
                }
              }
            }),
          }
        );

        if (!talkResponse.ok) {
          const errorData = await talkResponse.json().catch(() => ({}));
          console.error('❌ Erreur D-ID:', talkResponse.status, errorData);
          throw new Error(`Erreur D-ID: ${errorData.error || talkResponse.status}`);
        }

        const talkData = await talkResponse.json();
        const talkId = talkData.id;
        console.log("✅ Talk créé:", talkId);

        // Polling pour attendre la vidéo
        let attempts = 0;
        const maxAttempts = 60;
        
        const pollVideo = async (): Promise<string> => {
          attempts++;
          
          if (attempts > maxAttempts) {
            throw new Error("Timeout génération vidéo");
          }

          const statusResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/did-avatar`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'get_talk',
                data: { talkId }
              }),
            }
          );

          if (!statusResponse.ok) {
            throw new Error("Erreur vérification statut");
          }

          const statusData = await statusResponse.json();
          console.log(`📊 Statut (${attempts}/${maxAttempts}):`, statusData.status);

          if (statusData.status === 'done' && statusData.result_url) {
            return statusData.result_url;
          } else if (statusData.status === 'error') {
            throw new Error(`Erreur D-ID: ${statusData.error?.description || 'Inconnue'}`);
          }

          // Attendre 2 secondes avant de réessayer
          await new Promise(resolve => setTimeout(resolve, 2000));
          return pollVideo();
        };

        const videoUrl = await pollVideo();
        console.log("✅ Vidéo générée:", videoUrl);

        // Jouer la vidéo avec transition
        if (transitionManagerRef.current) {
          transitionManagerRef.current.transitionToVideo(videoUrl);
          setIsAvatarSpeaking(true);
        }

        setIsVideoLoading(false);
        toast({
          title: "✅ Vidéo prête",
          description: "L'avatar répond",
        });
      } catch (videoError) {
        console.error("❌ Erreur génération vidéo:", videoError);
        setIsVideoLoading(false);
        // Continuer sans vidéo - le texte est déjà affiché
        toast({
          title: "⚠️ Vidéo non disponible",
          description: "Réponse affichée en texte",
        });
      }



    } catch (error) {
      console.error('Voice message error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Échec du traitement vocal";
      
      setApiError({
        title: "Erreur vocale",
        message: errorMessage,
        timestamp: new Date()
      });
      
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
      
      setIsVideoLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced typing indicator
  const handleTyping = debounce(() => {
    // Typing indicator
  }, 500);

  // Gérer quand l'utilisateur commence à parler - transition vers idle
  const handleUserSpeaking = useCallback((speaking: boolean) => {
    console.log(speaking ? "🎤 Utilisateur commence à parler - passage en idle" : "🎤 Utilisateur a fini de parler");
    
    if (speaking) {
      // Passer en mode idle (image statique) quand l'utilisateur parle
      if (videoRef.current) {
        videoRef.current.pause();
        console.log("⏸️ Avatar en position d'attente");
      }
      setIsAvatarSpeaking(false);
    } else {
      // Ne rien faire ici - l'avatar reprendra quand il aura une nouvelle réponse
      console.log("✅ Utilisateur a fini - en attente de réponse");
    }
  }, []);

  // Détecter quand l'avatar parle et gérer les transitions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsAvatarSpeaking(true);
      console.log("🗣️ Avatar commence à parler");
    };

    const handlePause = () => {
      setIsAvatarSpeaking(false);
      console.log("🤫 Avatar arrête de parler");
    };

    const handleEnded = async () => {
      setIsAvatarSpeaking(false);
      console.log("✅ Avatar a fini de parler - retour à l'idle");
      
      // Retourner à l'idle après un court délai
      setTimeout(async () => {
        if (transitionManagerRef.current && !isStreaming) {
          await transitionManagerRef.current.returnToIdle();
        }
      }, 500);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isStreaming]);

  return (
    <Card className="glass p-6 space-y-6 h-full">
      <div className="space-y-2">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          Avatar Preview
        </h3>
        <p className="text-sm text-muted-foreground">
          Test your interactive avatar
        </p>
      </div>

      {/* Avatar Video Area */}
      <div className="rounded-lg bg-secondary/30 border border-border/50 relative overflow-hidden group">
        <div className="absolute inset-0 gradient-glow opacity-30"></div>
        
        {/* Deux éléments vidéo pour les transitions fluides */}
        <div className="relative w-full aspect-video">
          {/* Vidéo principale */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover avatar-video-transition ${
              isAvatarSpeaking ? 'avatar-speaking' : 'avatar-idle'
            }`}
            autoPlay
            playsInline
            muted={false}
            poster={config.customAvatarImage || (config.selectedAvatar && posterImages[config.selectedAvatar]) || ""}
            style={{ opacity: 1 }}
          />
          
          {/* Vidéo secondaire pour transitions */}
          <video
            ref={secondaryVideoRef}
            className="absolute inset-0 w-full h-full object-cover avatar-video-transition"
            playsInline
            muted={false}
            style={{ opacity: 0, display: 'none' }}
          />
          
          {/* Indicateur d'état */}
          {isAvatarSpeaking && (
            <div className="absolute top-4 right-4 px-3 py-2 bg-primary/90 text-primary-foreground text-sm rounded-full flex items-center gap-2 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Parle...
            </div>
          )}
          
          {isStreaming && !isAvatarSpeaking && (
            <div className="absolute top-4 right-4 px-3 py-2 bg-green-500/90 text-white text-sm rounded-full flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white" />
              Prêt
            </div>
          )}
          
          {!isStreaming && !isAvatarSpeaking && (
            <div className="absolute top-4 right-4 px-3 py-2 bg-yellow-500/90 text-white text-sm rounded-full animate-pulse">
              Connexion...
            </div>
          )}
        </div>
            
        
        {/* Voice Controls - Positionnés directement sous la vidéo */}
        <VoiceControls
          onVoiceMessage={handleVoiceMessage}
          isProcessing={isLoading}
          className="justify-center mt-3"
          onUserSpeaking={handleUserSpeaking}
          isAvatarSpeaking={isAvatarSpeaking}
        />
      </div>

      {/* Chat Interface */}
      <div className="space-y-4">
        <div className="h-64 overflow-y-auto space-y-3 p-4 rounded-lg bg-secondary/20 border border-border/30">
          {conversation.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Démarrez une conversation avec votre avatar
            </div>
          ) : (
            <>
              {conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg animate-fade-in ${
                    msg.role === "user"
                      ? "bg-primary/20 ml-auto max-w-[80%]"
                      : "bg-secondary/50 mr-auto max-w-[80%]"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  {msg.type === 'voice' && (
                    <span className="text-xs text-muted-foreground">🎤</span>
                  )}
                </div>
              ))}
              {streamingText && (
                <div className="p-3 rounded-lg bg-secondary/50 mr-auto max-w-[80%] animate-pulse">
                  <p className="text-sm">{streamingText}</p>
                </div>
              )}
            </>
          )}
          {isLoading && !streamingText && (
            <div className="flex items-center gap-2 text-muted-foreground p-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Avatar réfléchit...</span>
            </div>
          )}
          <div ref={conversationEndRef} />
        </div>

        {/* Text Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Tapez votre message..."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !isLoading) {
                handleSendMessage();
              }
            }}
            className="glass"
            disabled={isLoading}
            autoComplete="off"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim()}
            className="gradient-primary"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Error Overlay */}
      <ErrorOverlay 
        error={apiError}
        onClose={() => setApiError(null)}
      />
    </Card>
  );
};

export default AvatarDisplay;
