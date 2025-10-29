import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Video, Play } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import VoiceControls from "./VoiceControls";
import ErrorOverlay from "./ErrorOverlay";
import { debounce } from "@/utils/audioUtils";

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
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [apiError, setApiError] = useState<{ title: string; message: string; timestamp: Date } | null>(null);
  const { toast } = useToast();
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Avatar preview URLs - URLs officielles D-ID
  const avatarPreviews: Record<string, string> = {
    amy: "https://create-images-results.d-id.com/default_presenter_image/amy/image.jpeg",
    john: "https://create-images-results.d-id.com/default_presenter_image/maya/image.jpeg",
    sophia: "https://create-images-results.d-id.com/default_presenter_image/stacey/image.jpeg",
    marcus: "https://create-images-results.d-id.com/default_presenter_image/oliver/image.jpeg",
  };

  // Auto-scroll to latest message
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, streamingText]);

  // Load avatar preview when selection changes
  useEffect(() => {
    console.log("🔄 Avatar config:", { 
      selectedAvatar: config.selectedAvatar, 
      customAvatarImage: config.customAvatarImage?.substring(0, 50) 
    });
    
    // Priorité à l'image personnalisée
    if (config.customAvatarImage) {
      console.log("📸 Chargement image personnalisée");
      setVideoUrl(config.customAvatarImage);
    } else if (config.selectedAvatar && avatarPreviews[config.selectedAvatar]) {
      const avatarUrl = avatarPreviews[config.selectedAvatar];
      console.log("📸 Chargement avatar D-ID:", avatarUrl);
      setVideoUrl(avatarUrl);
    } else {
      console.log("⚠️ Aucun avatar configuré");
      setVideoUrl("");
    }
  }, [config.selectedAvatar, config.customAvatarImage]);

  // Generate preview animation with D-ID
  const generatePreviewAnimation = async () => {
    // Mode démo si pas de clé API
    if (!config.didApiKey) {
      toast({
        title: "Mode Démo",
        description: "Ajoutez votre clé D-ID pour générer de vraies animations",
      });
      
      // Simuler une animation de chargement
      setIsVideoLoading(true);
      setTimeout(() => {
        setIsVideoLoading(false);
        toast({
          title: "✅ Démo terminée",
          description: "Ajoutez vos clés API pour des animations réelles",
        });
      }, 3000);
      return;
    }

    if (!videoUrl) {
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
      console.log("📸 Avatar URL:", videoUrl);
      console.log("🔑 Clé D-ID configurée:", config.didApiKey.substring(0, 10) + "...");
      
      const response = await fetch('https://api.d-id.com/talks', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${config.didApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_url: videoUrl,
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
        }),
      });

      console.log("📡 Réponse D-ID:", response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erreur D-ID:', response.status, errorData);
        
        let errorTitle = "Erreur API D-ID";
        let errorMessage = `Erreur D-ID (${response.status})`;
        
        if (errorData.description) {
          errorMessage = errorData.description;
        } else if (response.status === 401) {
          errorTitle = "Authentification échouée";
          errorMessage = "Clé D-ID invalide. Vérifiez votre configuration.";
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
      const maxAttempts = 60; // 2 minutes max
      
      const checkStatus = setInterval(async () => {
        attempts++;
        console.log(`Vérification statut ${attempts}/${maxAttempts}`);
        
        if (attempts > maxAttempts) {
          clearInterval(checkStatus);
          setIsVideoLoading(false);
          toast({
            title: "Timeout",
            description: "La génération prend trop de temps. Réessayez.",
            variant: "destructive",
          });
          return;
        }

        try {
          const statusResponse = await fetch(`https://api.d-id.com/talks/${talkId}`, {
            headers: {
              'Authorization': `Basic ${config.didApiKey}`,
            },
          });

          const statusData = await statusResponse.json();
          console.log(`Statut D-ID (tentative ${attempts}):`, statusData.status);

          if (statusData.status === 'done' && statusData.result_url) {
            clearInterval(checkStatus);
            setVideoUrl(statusData.result_url);
            setIsVideoLoading(false);
            
            // Auto-play video
            if (videoRef.current) {
              videoRef.current.src = statusData.result_url;
              videoRef.current.play().catch(err => console.log("Autoplay bloqué:", err));
            }

            toast({
              title: "✅ Prévisualisation prête",
              description: "Animation de l'avatar générée avec succès!",
            });
          } else if (statusData.status === 'error' || statusData.status === 'rejected') {
            clearInterval(checkStatus);
            setIsVideoLoading(false);
            throw new Error(statusData.error?.description || 'Erreur de génération');
          }
        } catch (error) {
          clearInterval(checkStatus);
          setIsVideoLoading(false);
          console.error('Status check error:', error);
          
          const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
          
          setApiError({
            title: "Erreur de suivi",
            message: errorMessage,
            timestamp: new Date()
          });
          
          toast({
            title: "Erreur de suivi",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }, 2000);

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
        title: "❌ Erreur de génération",
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
          title: "✅ Réponse reçue",
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
        title: "❌ Erreur",
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
      
      setConversation((prev) => [...prev, { role: "user", content: transcription, type: 'voice' }]);

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
              { role: 'user', content: transcription }
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

      // Étape 3: Génération vidéo D-ID
      console.log("🎬 Étape 3: Génération vidéo D-ID...");
      
      // Validation de la longueur du texte (D-ID limite à ~1000 caractères)
      let textForVideo = responseText;
      if (textForVideo.length > 1000) {
        console.warn("⚠️ Texte trop long, troncature à 1000 caractères");
        textForVideo = textForVideo.substring(0, 997) + "...";
      }
      
      setIsVideoLoading(true);
      toast({
        title: "🎬 Génération vidéo...",
        description: "Création de la réponse animée",
      });

      const avatarUrl = config.customAvatarImage || avatarPreviews[config.selectedAvatar];
      
      console.log("🔍 Configuration D-ID:", {
        avatarUrl,
        textLength: textForVideo.length,
        hasApiKey: !!config.didApiKey
      });
      
      const didResponse = await fetch('https://api.d-id.com/talks', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${config.didApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_url: avatarUrl,
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
        }),
      });

      if (!didResponse.ok) {
        const errorData = await didResponse.json().catch(() => ({}));
        console.error('❌ Erreur D-ID:', {
          status: didResponse.status,
          statusText: didResponse.statusText,
          error: errorData
        });
        
        let errorMessage = 'Erreur de génération vidéo';
        if (didResponse.status === 401) {
          errorMessage = 'Clé API D-ID invalide ou expirée';
        } else if (didResponse.status === 400) {
          errorMessage = errorData.description || 'Paramètres invalides (vérifiez l\'URL de l\'avatar)';
        } else if (didResponse.status === 500) {
          errorMessage = 'Erreur serveur D-ID. Réessayez dans quelques instants.';
        } else if (errorData.description) {
          errorMessage = errorData.description;
        }
        
        toast({
          title: "❌ Erreur D-ID",
          description: errorMessage,
          variant: "destructive",
        });
        
        throw new Error(errorMessage);
      }

      const didData = await didResponse.json();
      const talkId = didData.id;
      console.log("✅ D-ID talk créé:", talkId);

      // Poll pour le statut de la vidéo
      let attempts = 0;
      const maxAttempts = 60;
      
      const checkStatus = setInterval(async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
          clearInterval(checkStatus);
          setIsVideoLoading(false);
          throw new Error('Timeout de génération vidéo');
        }

        const statusResponse = await fetch(`https://api.d-id.com/talks/${talkId}`, {
          headers: {
            'Authorization': `Basic ${config.didApiKey}`,
          },
        });

        const statusData = await statusResponse.json();
        console.log(`Statut D-ID (${attempts}/${maxAttempts}):`, statusData.status);

        if (statusData.status === 'done' && statusData.result_url) {
          clearInterval(checkStatus);
          setVideoUrl(statusData.result_url);
          setIsVideoLoading(false);
          
          // Auto-play vidéo
          if (videoRef.current) {
            videoRef.current.src = statusData.result_url;
            videoRef.current.play().catch(err => console.log("Autoplay bloqué:", err));
          }

          toast({
            title: "✅ Réponse prête!",
            description: "Vidéo générée avec succès",
          });
        } else if (statusData.status === 'error' || statusData.status === 'rejected') {
          clearInterval(checkStatus);
          setIsVideoLoading(false);
          throw new Error(statusData.error?.description || 'Erreur de génération');
        }
      }, 2000);

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
      <div className="aspect-video rounded-lg bg-secondary/30 border border-border/50 relative overflow-hidden group">
        <div className="absolute inset-0 gradient-glow opacity-30"></div>
        
        {videoUrl ? (
          <div className="relative w-full h-full">
            {videoUrl.endsWith('.mp4') || videoUrl.includes('result_url') || videoUrl.includes('d-id.com/talks') ? (
              // Vidéo D-ID générée
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                loop
                muted
                playsInline
                controls
                poster={videoUrl.replace('.mp4', '.jpg').replace('/talks/', '/images/')}
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            ) : (
              // Image statique de l'avatar
              <div className="w-full h-full flex items-center justify-center p-8">
                <div className="relative">
                  <img
                    src={videoUrl}
                    alt="Avatar preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-elegant"
                    onError={(e) => {
                      console.error("❌ Erreur chargement image:", videoUrl);
                      e.currentTarget.src = "https://via.placeholder.com/400x400/1a1a1a/666?text=Avatar";
                    }}
                  />
                  {/* Badge "Preview" */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-primary/90 text-primary-foreground text-xs rounded-full">
                    Prévisualisation
                  </div>
                </div>
              </div>
            )}
            
            {/* Generate Animation Button Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
              <Button
                onClick={generatePreviewAnimation}
                disabled={isVideoLoading}
                className="gradient-primary"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2" />
                {config.didApiKey ? 'Générer Animation' : 'Mode Démo'}
              </Button>
              {!config.didApiKey && (
                <p className="text-xs text-white/80 px-4 text-center">
                  Ajoutez une clé D-ID pour des animations réelles
                </p>
              )}
            </div>
          </div>
        ) : isVideoLoading ? (
          <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="w-16 h-16 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">Génération en cours...</p>
              <p className="text-sm text-muted-foreground">Création de l'animation avatar</p>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-24 h-24 rounded-full gradient-primary mx-auto flex items-center justify-center">
              <Video className="w-12 h-12 text-primary-foreground" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">Sélectionnez un Avatar</p>
              <p className="text-sm text-muted-foreground px-4">
                Choisissez un avatar dans l'onglet Configuration
              </p>
              {config.selectedAvatar && (
                <Button
                  onClick={generatePreviewAnimation}
                  disabled={isVideoLoading}
                  variant="outline"
                  className="mt-4"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {config.didApiKey ? 'Générer Animation' : 'Tester en Mode Démo'}
                </Button>
              )}
            </div>
          </div>
        )}
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

        {/* Voice Controls */}
        <VoiceControls
          onVoiceMessage={handleVoiceMessage}
          isProcessing={isLoading}
          className="justify-center"
        />

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
