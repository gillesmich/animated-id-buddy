import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Video } from "lucide-react";
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
  const { toast } = useToast();
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, streamingText]);

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
      <div className="aspect-video rounded-lg bg-secondary/30 border border-border/50 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 gradient-glow opacity-50"></div>
        <div className="relative z-10 text-center space-y-4">
          <div className="w-24 h-24 rounded-full gradient-primary mx-auto flex items-center justify-center">
            <Video className="w-12 h-12 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold">Avatar Ready</p>
            <p className="text-sm text-muted-foreground px-4">
              {config.selectedAvatar ? `${config.selectedAvatar} selected` : "Select an avatar to begin"}
            </p>
          </div>
        </div>
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
