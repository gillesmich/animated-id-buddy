import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import ConfigPanel from "@/components/avatar/ConfigPanel";
import AvatarDisplay from "@/components/avatar/AvatarDisplay";
import EmbedGenerator from "@/components/avatar/EmbedGenerator";
import AvatarAnimationTest from "@/components/avatar/AvatarAnimationTest";
import AvatarSelector from "@/components/avatar/AvatarSelector";
import MobileDebugOverlay from "@/components/debug/MobileDebugOverlay";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Charger la config depuis localStorage au démarrage
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem("avatarAI_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Charger les clés depuis .env si disponibles et pas déjà configurées
        return {
          ...parsed,
          didApiKey: parsed.didApiKey || import.meta.env.VITE_DID_API_KEY || "",
          openaiApiKey: parsed.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY || "",
          elevenlabsApiKey: parsed.elevenlabsApiKey || import.meta.env.VITE_ELEVENLABS_API_KEY || "",
        };
      } catch (e) {
        console.error("Erreur de chargement de la config:", e);
      }
    }
    // Charger depuis .env au premier démarrage
    return {
      didApiKey: import.meta.env.VITE_DID_API_KEY || "",
      openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
      elevenlabsApiKey: import.meta.env.VITE_ELEVENLABS_API_KEY || "",
      selectedAvatar: "amy",
      customAvatarImage: "",
      customAvatarVideo: "",
      selectedVoice: "EXAVITQu4vr4xnSDxMaL",
      selectedModel: "gpt-5-2025-08-07",
      workflows: [],
      selectedWorkflow: "",
      useN8n: false,
      systemPrompt: "Vous êtes un assistant virtuel nommé Clara. Vous êtes sympathique, professionnelle et vous aidez les utilisateurs avec leurs questions.",
      avatarProvider: 'did' as 'did' | 'musetalk',
    };
  });

  const [showEmbed, setShowEmbed] = useState(false);

  // Sauvegarder la config dans localStorage quand elle change
  useEffect(() => {
    localStorage.setItem("avatarAI_config", JSON.stringify(config));
  }, [config]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Mobile Debug Overlay */}
      <MobileDebugOverlay />
      
      {/* Hero Header */}
      <header className="border-b border-border/50 backdrop-blur-xl bg-background/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">AvatarAI</h1>
                <p className="text-xs text-muted-foreground">Interactive Avatar Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => setShowEmbed(!showEmbed)}
                variant="outline"
                className="glass border-primary/30 hover:border-primary/60"
              >
                {showEmbed ? "Close Embed" : "Get Embed Code"}
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline"
                size="icon"
                className="glass border-primary/30 hover:border-primary/60"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-5xl font-bold">
            Create <span className="text-gradient">Animated Avatars</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powered by D-ID, OpenAI, and ElevenLabs. Configure, test, and deploy interactive AI avatars on any website.
          </p>
        </div>

        {showEmbed ? (
          <EmbedGenerator config={config} />
        ) : (
          <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
            {/* Configuration Panel */}
            <div className="space-y-6">
              <ConfigPanel config={config} setConfig={setConfig} />
            </div>

            {/* Avatar Display & Tests */}
            <div className="space-y-6">
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Prévisualisation</TabsTrigger>
                  <TabsTrigger value="animations">Tests d'Animation</TabsTrigger>
                </TabsList>
                
                <TabsContent value="preview" className="mt-6 space-y-4">
                  <AvatarDisplay config={config} />
                  <AvatarSelector 
                    selectedAvatar={config.selectedAvatar}
                    onSelectAvatar={(avatarId) => setConfig({...config, selectedAvatar: avatarId})}
                  />
                </TabsContent>
                
                <TabsContent value="animations" className="mt-6">
                  <AvatarAnimationTest config={{
                    customAvatarImage: config.customAvatarImage,
                    selectedAvatar: config.selectedAvatar
                  }} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-20">
        <div className="container mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
          <p>Powered by D-ID, OpenAI, and ElevenLabs • Built with ❤️</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
