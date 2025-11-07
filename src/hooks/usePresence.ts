import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PresenceUser {
  user_id: string;
  is_online: boolean;
  is_typing: boolean;
  last_activity: string;
}

export const usePresence = (userId: string | undefined) => {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    // Set user as online
    const setOnline = async () => {
      const { error } = await supabase
        .from('presence')
        .upsert({
          user_id: userId,
          is_online: true,
          is_typing: false,
          last_activity: new Date().toISOString(),
        });

      if (error) {
        console.error('Error setting presence:', error);
        toast({
          title: "Erreur de connexion",
          description: "Impossible de se connecter au système de présence",
          variant: "destructive",
        });
      }
    };

    setOnline();

    // Subscribe to presence changes
    const channel = supabase
      .channel('presence-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presence',
        },
        async () => {
          // Fetch all online users
          const { data, error } = await supabase
            .from('presence')
            .select('*')
            .eq('is_online', true);

          if (error) {
            console.error('Error fetching presence:', error);
          } else {
            setOnlineUsers(data || []);
          }
        }
      )
      .subscribe();

    // Update presence every 30 seconds
    const interval = setInterval(async () => {
      await supabase
        .from('presence')
        .update({
          last_activity: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }, 30000);

    // Set offline on cleanup
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      supabase
        .from('presence')
        .update({ is_online: false })
        .eq('user_id', userId)
        .then();
    };
  }, [userId, toast]);

  const setTyping = async (isTyping: boolean) => {
    if (!userId) return;
    
    await supabase
      .from('presence')
      .update({ is_typing: isTyping })
      .eq('user_id', userId);
  };

  return { onlineUsers, setTyping };
};
