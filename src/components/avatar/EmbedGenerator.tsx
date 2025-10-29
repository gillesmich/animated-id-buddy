import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface EmbedGeneratorProps {
  config: {
    didApiKey: string;
    openaiApiKey: string;
    elevenlabsApiKey: string;
    selectedAvatar: string;
    selectedVoice: string;
    selectedModel: string;
  };
}

const EmbedGenerator = ({ config }: EmbedGeneratorProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateEmbedCode = () => {
    return `<!-- AvatarAI Embed Code -->
<div id="avatarai-container"></div>
<script src="https://cdn.avatarai.com/embed.js"></script>
<script>
  AvatarAI.init({
    container: '#avatarai-container',
    avatar: '${config.selectedAvatar || 'default'}',
    voice: '${config.selectedVoice || 'default'}',
    model: '${config.selectedModel || 'gpt-5-2025-08-07'}',
    apiKeys: {
      did: 'YOUR_DID_API_KEY',
      openai: 'YOUR_OPENAI_API_KEY',
      elevenlabs: 'YOUR_ELEVENLABS_API_KEY'
    }
  });
</script>`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateEmbedCode());
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Embed code copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="glass p-8 max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h3 className="text-3xl font-bold flex items-center gap-2">
          <Code className="w-6 h-6 text-primary" />
          Embed Code Generator
        </h3>
        <p className="text-muted-foreground">
          Copy and paste this code into your website to integrate your interactive avatar
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-secondary/30 rounded-lg p-6 border border-border/50 relative">
          <pre className="text-sm overflow-x-auto">
            <code className="text-accent">{generateEmbedCode()}</code>
          </pre>
          <Button
            onClick={handleCopy}
            size="sm"
            variant="outline"
            className="absolute top-4 right-4 glass"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </>
            )}
          </Button>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Configuration Summary:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Avatar:</p>
              <p className="font-medium">{config.selectedAvatar || "Not selected"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Voice:</p>
              <p className="font-medium">{config.selectedVoice || "Not selected"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Model:</p>
              <p className="font-medium">{config.selectedModel || "Not selected"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">API Keys:</p>
              <p className="font-medium">
                {config.didApiKey && config.openaiApiKey && config.elevenlabsApiKey
                  ? "✓ All configured"
                  : "⚠ Incomplete"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-accent">Important Notes:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Replace placeholder API keys with your actual keys</li>
            <li>Never expose your API keys in client-side code in production</li>
            <li>Consider using a backend proxy for API calls</li>
            <li>Test the embed in a staging environment first</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default EmbedGenerator;
