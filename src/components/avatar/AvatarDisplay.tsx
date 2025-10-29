import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Video } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface AvatarDisplayProps {
  config: {
    didApiKey: string;
    openaiApiKey: string;
    elevenlabsApiKey: string;
    selectedAvatar: string;
    selectedVoice: string;
    selectedModel: string;
  };
}

const AvatarDisplay = ({ config }: AvatarDisplayProps) => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<Array<{ role: string; content: string }>>([]);
  const { toast } = useToast();

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
    setConversation([...conversation, { role: "user", content: message }]);
    setMessage("");

    // Simulate API call (in real implementation, this would call your backend)
    setTimeout(() => {
      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: "This is a demo response. To enable real interactions, you'll need to implement the backend integration with D-ID, OpenAI, and ElevenLabs." },
      ]);
      setIsLoading(false);
      
      toast({
        title: "Demo Mode",
        description: "This is a preview. Connect your APIs for live avatars.",
      });
    }, 2000);
  };

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
        <div className="h-48 overflow-y-auto space-y-3 p-4 rounded-lg bg-secondary/20 border border-border/30">
          {conversation.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Start a conversation with your avatar
            </div>
          ) : (
            conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.role === "user"
                    ? "bg-primary/20 ml-auto max-w-[80%]"
                    : "bg-secondary/50 mr-auto max-w-[80%]"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground p-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Avatar is thinking...</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            className="glass"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading}
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
