import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { ProfileSetup } from "@/components/chat/ProfileSetup";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Chat = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    setUserId(session.user.id);

    // Check if user has a profile with username
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .single();

    setHasProfile(!!profile?.username);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  if (!hasProfile) {
    return <ProfileSetup userId={userId} onComplete={() => setHasProfile(true)} />;
  }

  return <ChatRoom userId={userId} />;
};

export default Chat;
