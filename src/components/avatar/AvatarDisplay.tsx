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
import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { DIDWebRTCManager } from "@/utils/didWebRTC";
import { getAvatarImage, getAvatarForDID } from "@/config/avatars";
import "./avatar-transitions.css";

interface AvatarDisplayProps {
  config: {
    didApiKey: string;
    openaiApiKey: string;
    elevenlabsApiKey: string;
    selectedAvatar: string;
    customAvatarImage: string;
    customAvatarVideo?: string;
    selectedVoice: string;
    selectedModel: string;
    selectedWorkflow: string;
    workflows: Array<{ id: string; name: string; webhookUrl: string }>;
    useN8n?: boolean;
    avatarProvider?: 'did' | 'musetalk';
  };
}

const AvatarDisplay = ({ config }: AvatarDisplayProps) => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<Array<{ role: string; content: string; type?: 'text' | 'voice' }>>([]);
  const [streamingText, setStreamingText] = useState("");
  const [apiError, setApiError] = useState<{ title: string; message: string; timestamp: Date } | null>(null);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  
  // Charger les vidéos depuis localStorage au démarrage
  const [generatedVideos, setGeneratedVideos] = useState<Array<{ url: string; text: string; timestamp: Date }>>(() => {
    try {
      const saved = localStorage.getItem('generatedVideos');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convertir les timestamps string en Date
        return parsed.map((v: any) => ({
          ...v,
          timestamp: new Date(v.timestamp)
        }));
      }
    } catch (error) {
      console.error("Erreur chargement vidéos:", error);
    }
    return [];
  });
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
  const [webRTCStatus, setWebRTCStatus] = useState<string>("");
  const webRTCManagerRef = useRef<any>(null);

  const [avatarForDID, setAvatarForDID] = useState<{ presenterId?: string; url?: string }>(getAvatarForDID('amy'));
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>(getAvatarImage('amy'));
  const [isVideoLoading, setIsVideoLoading] = useState(false);

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
  }, [config.customAvatarImage, config.customAvatarVideo, config.selectedAvatar, config.avatarProvider, isStreaming]);

  // Load avatar preview when selection changes
  useEffect(() => {
    console.log("🔄 Avatar config complet:", { 
      selectedAvatar: config.selectedAvatar, 
      customAvatarImage: config.customAvatarImage,
      customAvatarVideo: config.customAvatarVideo,
      provider: config.avatarProvider,
      hasVideo: !!config.customAvatarVideo,
      videoLength: config.customAvatarVideo?.length
    });
    
    // Pour MuseTalk, priorité ABSOLUE à la vidéo personnalisée
    if (config.avatarProvider === 'musetalk') {
      if (config.customAvatarVideo && config.customAvatarVideo.trim() !== '') {
        console.log("📹 ✅ Chargement vidéo personnalisée pour MuseTalk:", config.customAvatarVideo);
        setAvatarForDID({ url: config.customAvatarVideo });
        setCurrentVideoUrl(config.customAvatarVideo);
        return;
      } else {
        console.warn("⚠️ MuseTalk activé mais AUCUNE vidéo uploadée!");
        console.warn("⚠️ Uploadez une vidéo dans l'onglet Upload pour utiliser MuseTalk");
      }
    }
    
    // Priorité à l'image personnalisée (si elle existe vraiment)
    if (config.customAvatarImage && config.customAvatarImage.trim() !== '') {
      console.log("📸 Chargement image personnalisée");
      setAvatarForDID({ url: config.customAvatarImage });
      setCurrentVideoUrl(config.customAvatarImage);
    } else if (config.selectedAvatar) {
      // Utiliser presenter ID ou URL pour D-ID API
      const didConfig = getAvatarForDID(config.selectedAvatar);
      const localUrl = getAvatarImage(config.selectedAvatar);
      console.log("📸 Chargement avatar:", { didConfig, localUrl });
      setAvatarForDID(didConfig);
      setCurrentVideoUrl(localUrl);  // URL locale pour affichage UI
    } else {
      console.log("⚠️ Aucun avatar configuré - utilisation avatar par défaut");
      const defaultDIDConfig = getAvatarForDID('amy');
      const defaultLocalUrl = getAvatarImage('amy');
      console.log("📸 Avatar par défaut:", { defaultDIDConfig, defaultLocalUrl });
      setAvatarForDID(defaultDIDConfig);
      setCurrentVideoUrl(defaultLocalUrl);
    }
  }, [config.selectedAvatar, config.customAvatarImage, config.customAvatarVideo, config.avatarProvider]);





  // Démarrer une session WebRTC avec D-ID
  const startWebRTCSession = async () => {
    if (!avatarForDID.presenterId && !avatarForDID.url) {
      toast({
        title: "Avatar manquant",
        description: "Sélectionnez d'abord un avatar",
        variant: "destructive",
      });
      return;
    }

    if (!videoRef.current) {
      toast({
        title: "Erreur",
        description: "Élément vidéo non disponible",
        variant: "destructive",
      });
      return;
    }

    setIsVideoLoading(true);
    setIsStreaming(true);

    try {
      console.log("🎬 Démarrage session WebRTC D-ID");
      console.log("📸 Avatar config:", avatarForDID);
      
      // Créer le gestionnaire WebRTC
      webRTCManagerRef.current = new DIDWebRTCManager(
        videoRef.current,
        (status) => {
          console.log("📊 Statut WebRTC:", status);
          setWebRTCStatus(status);
        }
      );

      // Créer la session (use URL for now, WebRTC might need URL)
      const imageUrl = avatarForDID.url || '';
      await webRTCManagerRef.current.createSession(imageUrl);
      
      toast({
        title: "✅ Connexion établie",
        description: "L'avatar est prêt en mode WebRTC",
      });

      // Envoyer un message de test
      await webRTCManagerRef.current.sendText(
        "Bonjour! Je suis votre assistant virtuel en streaming WebRTC. Comment puis-je vous aider?",
        'fr-FR-DeniseNeural'
      );

      setIsVideoLoading(false);
    } catch (error) {
      console.error("❌ Erreur WebRTC:", error);
      setIsVideoLoading(false);
      setIsStreaming(false);
      
      setApiError({
        title: "Erreur WebRTC",
        message: error instanceof Error ? error.message : "Impossible de démarrer la session WebRTC",
        timestamp: new Date()
      });
      
      toast({
        title: "Erreur",
        description: "Impossible de démarrer le streaming WebRTC",
        variant: "destructive",
      });
    }
  };

  // Arrêter la session WebRTC
  const stopWebRTCSession = () => {
    if (webRTCManagerRef.current) {
      webRTCManagerRef.current.cleanup();
      webRTCManagerRef.current = null;
    }
    setIsStreaming(false);
    setWebRTCStatus("");
  };

  // Nettoyer la session WebRTC au démontage
  useEffect(() => {
    return () => {
      stopWebRTCSession();
    };
  }, []);

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

    // Mode WebRTC - envoyer le message directement au stream
    if (isStreaming && webRTCManagerRef.current) {
      const userMessage = message.trim();
      setMessage("");
      
      setConversation(prev => [
        ...prev,
        { role: "user", content: userMessage, type: 'text' }
      ]);

      setIsLoading(true);
      try {
        // En mode WebRTC, on envoie simplement le texte pour animation
        await webRTCManagerRef.current.sendText(userMessage, 'fr-FR-DeniseNeural');
        
        setConversation(prev => [
          ...prev,
          { role: "assistant", content: userMessage, type: 'text' }
        ]);
      } catch (error) {
        console.error("Error sending WebRTC message:", error);
        toast({
          title: "Erreur",
          description: "Impossible d'envoyer le message",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Validation pour mode REST classique
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

      const transcriptionResponse = await authenticatedFetch('whisper-transcribe', {
        method: 'POST',
        body: JSON.stringify({ audioBase64 }),
      });

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

      const chatResponse = await authenticatedFetch('openai-chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'Tu es un assistant virtuel intelligent et amical. Réponds de manière concise et naturelle.' },
            { role: 'user', content: cleanTranscription }
          ],
          model: config.selectedModel || 'gpt-4o-mini',
        }),
      });

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

      // Étape 3: Génération vidéo avec provider sélectionné
      const provider = config.avatarProvider || 'did';
      console.log(`🎬 Étape 3: Génération vidéo ${provider.toUpperCase()}...`);
      console.log('📋 Config complète:', { 
        avatarProvider: config.avatarProvider,
        provider,
        avatarForDID,
        currentVideoUrl 
      });
      
      if (!avatarForDID.presenterId && !avatarForDID.url) {
        console.log("⚠️ Pas d'avatar configuré");
        toast({
          title: "Avatar manquant",
          description: "Veuillez sélectionner un avatar dans la configuration",
          variant: "destructive",
        });
        return;
      }
      
      console.log("📸 Avatar config:", avatarForDID);
      
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
        let videoUrl: string;

        if (provider === 'musetalk') {
          // PRIORITÉ À config.customAvatarVideo pour éviter les problèmes de timing
          console.log("🎯 DEBUG MuseTalk:");
          console.log("  - config.customAvatarVideo:", config.customAvatarVideo);
          console.log("  - avatarForDID.url:", avatarForDID.url);
          console.log("  - currentVideoUrl:", currentVideoUrl);
          
          const sourceUrl = config.customAvatarVideo || avatarForDID.url || currentVideoUrl;
          
          if (!sourceUrl || sourceUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
            console.error("❌ MuseTalk: Pas de vidéo ou source est une image");
            toast({
              title: "📹 Vidéo requise",
              description: "Uploadez une vidéo dans Configuration → Onglet 'Upload vidéo' pour utiliser MuseTalk",
              variant: "destructive",
              duration: 8000,
            });
            setIsVideoLoading(false);
            return;
          }
          
          console.log("✅ MuseTalk - Source vidéo validée:", sourceUrl);

          // Upload local video to Supabase Storage to get a publicly accessible URL
          const { uploadLocalImageToStorage } = await import('@/utils/uploadImageToStorage');
          let videoUrl: string;
          
          if (sourceUrl.startsWith('http')) {
            videoUrl = sourceUrl;
          } else {
            videoUrl = await uploadLocalImageToStorage(
              `${window.location.origin}${sourceUrl}`
            );
          }

          console.log("📹 Public video URL:", videoUrl);

          // Appel à FAL AI MuseTalk via edge function
          const requestBody = {
            action: 'create_talk',
            data: {
              source_url: videoUrl,
              text: textForVideo,
              voice_id: config.selectedVoice,
              config: {
                bbox_shift: 0
              }
            }
          };

          const talkResponse = await authenticatedFetch('musetalk-avatar', {
            method: 'POST',
            body: JSON.stringify(requestBody),
          });

          if (!talkResponse.ok) {
            const errorData = await talkResponse.json().catch(() => ({}));
            console.error('❌ Erreur FAL MuseTalk:', talkResponse.status, errorData);
            
            if (errorData.code === 'INVALID_SOURCE_TYPE') {
              toast({
                title: "📹 Vidéo requise",
                description: errorData.message,
                variant: "destructive",
                duration: 8000,
              });
              throw new Error(errorData.message);
            }
            
            if (errorData.code === 'NOT_CONFIGURED') {
              throw new Error("FAL API key non configurée");
            }
            throw new Error(`Erreur FAL MuseTalk: ${errorData.error || talkResponse.status}`);
          }

          const talkData = await talkResponse.json();
          videoUrl = talkData.result_url;  // Direct result from FAL AI - no polling needed!
          console.log("✅ FAL MuseTalk vidéo générée:", videoUrl);
        } else {
          // Appel à D-ID (code existant)
          const requestBody: any = {
            action: 'create_talk',
            data: {
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
          };

          if (avatarForDID.presenterId) {
            requestBody.data.presenter_id = avatarForDID.presenterId;
            console.log("📸 Utilisation presenter ID:", avatarForDID.presenterId);
          } else if (avatarForDID.url) {
            requestBody.data.source_url = avatarForDID.url;
            console.log("📸 Utilisation URL:", avatarForDID.url);
          }

          const talkResponse = await authenticatedFetch('did-avatar', {
            method: 'POST',
            body: JSON.stringify(requestBody),
          });

          if (!talkResponse.ok) {
            const errorData = await talkResponse.json().catch(() => ({}));
            console.error('❌ Erreur D-ID:', talkResponse.status, errorData);
            throw new Error(`Erreur D-ID: ${errorData.error || talkResponse.status}`);
          }

          const talkData = await talkResponse.json();
          const talkId = talkData.id;
          console.log("✅ Talk créé:", talkId);

          // Polling pour attendre la vidéo D-ID
          let attempts = 0;
          const maxAttempts = 60;
          
          const pollVideo = async (): Promise<string> => {
            attempts++;
            
            if (attempts > maxAttempts) {
              throw new Error("Timeout génération vidéo");
            }

            const statusResponse = await authenticatedFetch('did-avatar', {
              method: 'POST',
              body: JSON.stringify({
                action: 'get_talk',
                data: { talkId }
              }),
            });

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

            await new Promise(resolve => setTimeout(resolve, 2000));
            return pollVideo();
          };

          videoUrl = await pollVideo();
          console.log("✅ Vidéo générée:", videoUrl);
        }

        // Jouer la vidéo avec transition
        if (transitionManagerRef.current) {
          transitionManagerRef.current.transitionToVideo(videoUrl);
          setIsAvatarSpeaking(true);
        }

        // Sauvegarder la vidéo générée
        const newVideo = {
          url: videoUrl,
          text: responseText,
          timestamp: new Date()
        };
        
        setGeneratedVideos(prev => {
          const updated = [...prev, newVideo];
          // Persister dans localStorage
          try {
            localStorage.setItem('generatedVideos', JSON.stringify(updated));
          } catch (error) {
            console.error("Erreur sauvegarde vidéos:", error);
          }
          return updated;
        });

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

      {/* WebRTC Controls - Only shown for DID provider */}
      {config.avatarProvider === 'did' && (
        <div className="flex gap-2 items-center">
          {!isStreaming ? (
            <Button
              onClick={startWebRTCSession}
              disabled={isVideoLoading || (!avatarForDID.presenterId && !avatarForDID.url)}
              className="gradient-primary"
            >
              {isVideoLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Connexion WebRTC...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Démarrer WebRTC
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={stopWebRTCSession}
              variant="destructive"
            >
              Arrêter WebRTC
            </Button>
          )}
          {webRTCStatus && (
            <span className="text-sm text-muted-foreground">
              Statut: {webRTCStatus}
            </span>
          )}
        </div>
      )}

      {/* Generated Videos Gallery - Remplace la prévisualisation */}
      {generatedVideos.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              Vidéos de Réponse ({generatedVideos.length})
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setGeneratedVideos([]);
                localStorage.removeItem('generatedVideos');
                toast({
                  title: "Galerie vidée",
                  description: "Toutes les vidéos ont été supprimées",
                });
              }}
            >
              Vider la galerie
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {generatedVideos.map((video, idx) => (
              <div key={idx} className="group relative rounded-lg overflow-hidden border border-border/50 bg-secondary/20">
                <video
                  src={video.url}
                  className="w-full aspect-video object-cover"
                  controls
                  preload="metadata"
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = video.url;
                      a.download = `avatar-response-${idx + 1}.mp4`;
                      a.click();
                      toast({
                        title: "📥 Téléchargement",
                        description: "La vidéo va être téléchargée",
                      });
                    }}
                  >
                    Télécharger
                  </Button>
                </div>
                <div className="p-2 bg-background/80 backdrop-blur-sm">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {video.text}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {video.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Voice Controls */}
          <VoiceControls
            onVoiceMessage={handleVoiceMessage}
            isProcessing={isLoading}
            className="justify-center mt-3"
            onUserSpeaking={handleUserSpeaking}
            isAvatarSpeaking={isAvatarSpeaking}
          />
        </div>
      ) : (
        /* Avatar Video Area - Affiché seulement si aucune vidéo générée */
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
              loop
              src={currentVideoUrl?.match(/\.(mp4|webm|mov)$/i) ? currentVideoUrl : undefined}
              poster={currentVideoUrl?.match(/\.(jpg|jpeg|png|gif)$/i) ? currentVideoUrl : undefined}
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
      )}

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
