import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Video, Play } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import VoiceControls from "./VoiceControls";
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
  };
}

const AvatarDisplay = ({ config }: AvatarDisplayProps) => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<Array<{ role: string; content: string; type?: 'text' | 'voice' }>>([]);
  const [streamingText, setStreamingText] = useState("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const { toast } = useToast();
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Avatar preview URLs (sample videos - à remplacer par vraies URLs D-ID)
  const avatarPreviews: Record<string, string> = {
    amy: "https://create-images-results.d-id.com/default_presenter_image/amy/image.jpeg",
    john: "https://create-images-results.d-id.com/default_presenter_image/john/image.jpeg",
    sophia: "https://create-images-results.d-id.com/default_presenter_image/sophia/image.jpeg",
    marcus: "https://create-images-results.d-id.com/default_presenter_image/marcus/image.jpeg",
  };

  // Auto-scroll to latest message
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, streamingText]);

  // Load avatar preview when selection changes
  useEffect(() => {
    if (config.customAvatarImage) {
      setVideoUrl(config.customAvatarImage);
    } else if (config.selectedAvatar && avatarPreviews[config.selectedAvatar]) {
      setVideoUrl(avatarPreviews[config.selectedAvatar]);
    } else {
      setVideoUrl("");
    }
  }, [config.selectedAvatar, config.customAvatarImage]);

  // Generate preview animation with D-ID
  const generatePreviewAnimation = async () => {
    if (!config.didApiKey || !videoUrl) {
      toast({
        title: "Configuration manquante",
        description: "Ajoutez votre clé D-ID et sélectionnez un avatar",
        variant: "destructive",
      });
      return;
    }

    setIsVideoLoading(true);

    try {
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
            input: 'Bonjour! Je suis votre assistant virtuel. Comment puis-je vous aider aujourd\'hui?',
            provider: {
              type: 'microsoft',
              voice_id: 'fr-FR-DeniseNeural'
            }
          },
          config: {
            fluent: true,
            pad_audio: 0,
            stitch: true
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Échec de génération de la prévisualisation');
      }

      const data = await response.json();
      const talkId = data.id;

      // Poll for video status
      let attempts = 0;
      const maxAttempts = 30;
      
      const checkStatus = setInterval(async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
          clearInterval(checkStatus);
          setIsVideoLoading(false);
          toast({
            title: "Timeout",
            description: "La génération prend trop de temps",
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

          if (statusData.status === 'done' && statusData.result_url) {
            clearInterval(checkStatus);
            setVideoUrl(statusData.result_url);
            setIsVideoLoading(false);
            
            // Auto-play video
            if (videoRef.current) {
              videoRef.current.src = statusData.result_url;
              videoRef.current.play();
            }

            toast({
              title: "Prévisualisation prête",
              description: "Animation de l'avatar générée",
            });
          } else if (statusData.status === 'error') {
            clearInterval(checkStatus);
            setIsVideoLoading(false);
            throw new Error(statusData.error || 'Erreur de génération');
          }
        } catch (error) {
          clearInterval(checkStatus);
          setIsVideoLoading(false);
          console.error('Status check error:', error);
        }
      }, 2000);

    } catch (error) {
      setIsVideoLoading(false);
      console.error('Preview generation error:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec de génération",
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
        title: "Missing Configuration",
        description: "Please configure all API keys first.",
        variant: "destructive",
      });
      return;
    }

    if (!config.selectedAvatar || !config.selectedVoice || !config.selectedModel) {
      toast({
        title: "Missing Selection",
        description: "Please select avatar, voice, and model.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setConversation([...conversation, { role: "user", content: message, type: 'text' }]);
    const userMessage = message;
    setMessage("");

    try {
      // Simulate streaming response for better UX
      if (config.selectedWorkflow) {
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
          description: "L'avatar a traité votre message",
        });
      } else {
        // Demo mode
        const demoResponse = "Mode démo: Configurez vos API et sélectionnez un workflow n8n pour des interactions réelles.";
        setConversation((prev) => [
          ...prev,
          { role: "assistant", content: demoResponse, type: 'text' },
        ]);
        
        toast({
          title: "Mode Démo",
          description: "Configurez un workflow pour activer les fonctionnalités",
        });
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec de l'envoi",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceMessage = async (audioBase64: string) => {
    setIsLoading(true);
    setConversation((prev) => [...prev, { role: "user", content: "🎤 Message vocal", type: 'voice' }]);

    try {
      if (config.selectedWorkflow) {
        const result = await sendToWorkflow("Message vocal", audioBase64);
        
        setConversation((prev) => [
          ...prev,
          { role: "assistant", content: result.text || "Réponse vocale traitée", type: 'voice' },
        ]);
        
        toast({
          title: "Message vocal traité",
          description: "Réponse générée avec succès",
        });
      } else {
        throw new Error("Configurez un workflow pour les messages vocaux");
      }
    } catch (error) {
      console.error('Voice message error:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec du traitement vocal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced typing indicator
  const handleTyping = debounce(() => {
    console.log('User is typing...');
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
        
        {videoUrl && !isVideoLoading ? (
          <>
            {videoUrl.endsWith('.mp4') || videoUrl.includes('result_url') ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                loop
                muted
                playsInline
                poster={config.customAvatarImage || avatarPreviews[config.selectedAvatar]}
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            ) : (
              <img
                src={videoUrl}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Generate Animation Button Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                onClick={generatePreviewAnimation}
                disabled={isVideoLoading || !config.didApiKey}
                className="gradient-primary"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Générer Animation
              </Button>
            </div>
          </>
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
              <p className="text-lg font-semibold">Avatar Preview</p>
              <p className="text-sm text-muted-foreground px-4">
                {config.selectedAvatar ? `${config.selectedAvatar} sélectionné` : "Sélectionnez un avatar"}
              </p>
              {config.selectedAvatar && (
                <Button
                  onClick={generatePreviewAnimation}
                  disabled={!config.didApiKey}
                  variant="outline"
                  className="mt-4"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Générer Prévisualisation
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
            onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendMessage()}
            className="glass"
            disabled={isLoading}
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
    </Card>
  );
};

export default AvatarDisplay;
