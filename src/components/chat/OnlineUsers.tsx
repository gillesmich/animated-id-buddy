import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PresenceUser } from "@/hooks/usePresence";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OnlineUsersProps {
  onlineUsers: PresenceUser[];
}

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
}

export const OnlineUsers = ({ onlineUsers }: OnlineUsersProps) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const userIds = onlineUsers.map(u => u.user_id);
      if (userIds.length === 0) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      if (data) {
        setProfiles(data);
      }
    };

    fetchProfiles();
  }, [onlineUsers]);

  const getUserProfile = (userId: string) => {
    return profiles.find(p => p.id === userId);
  };

  const typingUsers = onlineUsers.filter(u => u.is_typing);

  return (
    <Card className="w-64 h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-foreground">En ligne ({onlineUsers.length})</h3>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {onlineUsers.map((user) => {
            const profile = getUserProfile(user.user_id);
            return (
              <div key={user.user_id} className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile?.username?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile?.username || 'Utilisateur'}
                  </p>
                  {user.is_typing && (
                    <Badge variant="secondary" className="text-xs">
                      En train d'écrire...
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
};
