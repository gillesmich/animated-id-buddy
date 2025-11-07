import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, onTyping, disabled }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  let typingTimeout: NodeJS.Timeout;

  const handleInputChange = (value: string) => {
    setMessage(value);
    
    // Signal typing
    onTyping(true);
    
    // Clear previous timeout
    clearTimeout(typingTimeout);
    
    // Set timeout to stop typing signal
    typingTimeout = setTimeout(() => {
      onTyping(false);
    }, 1000);
  };

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
      onTyping(false);
      clearTimeout(typingTimeout);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-4 border-t bg-background">
      <Textarea
        value={message}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Écrivez votre message..."
        className="min-h-[60px] resize-none"
        disabled={disabled}
      />
      <Button 
        onClick={handleSend} 
        size="icon"
        disabled={!message.trim() || disabled}
        className="h-[60px] w-[60px]"
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
};
