import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface WebSocketMessage {
  timestamp: string;
  direction: 'sent' | 'received';
  data: any;
}

interface WebSocketDebugPanelProps {
  messages: WebSocketMessage[];
  onClear: () => void;
}

export const WebSocketDebugPanel: React.FC<WebSocketDebugPanelProps> = ({ 
  messages, 
  onClear 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[500px] bg-background/95 backdrop-blur border-2 z-50">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Badge variant="outline">WebSocket Debug</Badge>
          <Badge variant="secondary">{messages.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <ScrollArea className="h-[400px] p-3">
          <div className="space-y-2">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Aucun message WebSocket
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    msg.direction === 'sent'
                      ? 'bg-blue-500/10 border-blue-500/20'
                      : 'bg-green-500/10 border-green-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge
                      variant={msg.direction === 'sent' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {msg.direction === 'sent' ? '📤 SENT' : '📥 RECEIVED'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {msg.timestamp}
                    </span>
                  </div>
                  <pre className="text-xs overflow-x-auto bg-background/50 p-2 rounded">
                    {JSON.stringify(msg.data, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
};
