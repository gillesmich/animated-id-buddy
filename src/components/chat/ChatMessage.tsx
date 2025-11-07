import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Message } from "@/hooks/useMessages";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
}

export const ChatMessage = ({ message, isOwnMessage }: ChatMessageProps) => {
  return (
    <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={message.sender?.avatar_url || ''} />
        <AvatarFallback className="bg-primary text-primary-foreground">
          {message.sender?.username?.[0]?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      
      <div className={`flex flex-col gap-1 max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {message.sender?.username || 'Utilisateur'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.created_at), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
        </div>
        
        <div className={`rounded-lg px-4 py-2 ${
          isOwnMessage 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-secondary text-secondary-foreground'
        }`}>
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
};
