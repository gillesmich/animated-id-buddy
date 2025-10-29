import { useState } from "react";
import ConfigPanel from "@/components/avatar/ConfigPanel";
import AvatarDisplay from "@/components/avatar/AvatarDisplay";
import EmbedGenerator from "@/components/avatar/EmbedGenerator";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const Index = () => {
  const [config, setConfig] = useState({
    didApiKey: "",
    openaiApiKey: "",
    elevenlabsApiKey: "",
    selectedAvatar: "",
    selectedVoice: "",
    selectedModel: "gpt-5-2025-08-07",
  });

  const [showEmbed, setShowEmbed] = useState(false);

  return (
    <div className="min-h-screen">
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
            <Button 
              onClick={() => setShowEmbed(!showEmbed)}
              variant="outline"
              className="glass border-primary/30 hover:border-primary/60"
            >
              {showEmbed ? "Close Embed" : "Get Embed Code"}
            </Button>
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

            {/* Avatar Display */}
            <div className="space-y-6">
              <AvatarDisplay config={config} />
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
