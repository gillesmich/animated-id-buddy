import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { OnlineUsers } from "./OnlineUsers";
import { useMessages } from "@/hooks/useMessages";
import { usePresence } from "@/hooks/usePresence";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";

interface ChatRoomProps {
  userId: string;
}

export const ChatRoom = ({ userId }: ChatRoomProps) => {
  const navigate = useNavigate();
  const { messages, sendMessage, isLoading } = useMessages();
  const { onlineUsers, setTyping } = usePresence(userId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content, userId);
  };

  const handleTyping = (isTyping: boolean) => {
    setTyping(isTyping);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen gap-4 p-4 bg-background">
      <Card className="flex-1 flex flex-col">
        <div className="p-4 border-b bg-card flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Chat en direct</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux avatars
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isOwnMessage={message.sender_id === userId}
              />
            ))}
          </div>
        </ScrollArea>
        
        <ChatInput onSend={handleSendMessage} onTyping={handleTyping} />
      </Card>
      
      <OnlineUsers onlineUsers={onlineUsers} />
    </div>
  );
};
