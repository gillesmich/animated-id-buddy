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
    customAvatarImage?: string;
    selectedVoice: string;
    selectedModel: string;
    selectedWorkflow: string;
    workflows: Array<{ id: string; name: string; webhookUrl: string }>;
  };
}

const EmbedGenerator = ({ config }: EmbedGeneratorProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

const generateEmbedCode = () => {
    const selectedWorkflow = config.workflows?.find(w => w.id === config.selectedWorkflow);
    
    return `<!-- AvatarAI Embed Code - Optimisé pour performance -->
<div id="avatarai-container" style="width: 100%; max-width: 600px; margin: 0 auto;"></div>

<!-- Styles intégrés -->
<style>
  #avatarai-container {
    font-family: system-ui, -apple-system, sans-serif;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .avatarai-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
</style>

<!-- Script d'intégration -->
<script>
(function() {
  const AvatarAI = {
    config: {
      container: '#avatarai-container',
      avatar: '${config.customAvatarImage || config.selectedAvatar || 'default'}',
      voice: '${config.selectedVoice || 'alloy'}',
      model: '${config.selectedModel || 'gpt-4o-mini'}',
      workflowUrl: '${selectedWorkflow?.webhookUrl || 'YOUR_N8N_WEBHOOK_URL'}',
      streamResponse: true,
      voiceEnabled: true
    },
    
    init: function() {
      const container = document.querySelector(this.config.container);
      if (!container) return;
      
      container.innerHTML = \`
        <div class="avatarai-loading">
          <div>⏳ Chargement de l'avatar...</div>
        </div>
        <div id="avatarai-chat" style="display: none;">
          <div id="avatarai-video" style="aspect-ratio: 16/9; background: #000;"></div>
          <div id="avatarai-messages" style="max-height: 300px; overflow-y: auto; padding: 1rem;"></div>
          <div id="avatarai-input-container" style="display: flex; gap: 0.5rem; padding: 1rem;">
            <button id="avatarai-mic" style="padding: 0.5rem 1rem; cursor: pointer;">🎤</button>
            <input id="avatarai-text" type="text" placeholder="Tapez un message..." style="flex: 1; padding: 0.5rem; border-radius: 6px; border: 1px solid #ddd;" />
            <button id="avatarai-send" style="padding: 0.5rem 1rem; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">Envoyer</button>
          </div>
        </div>
      \`;
      
      // Simulate loading
      setTimeout(() => {
        container.querySelector('.avatarai-loading').style.display = 'none';
        container.querySelector('#avatarai-chat').style.display = 'block';
        this.setupEventListeners();
      }, 1500);
    },
    
    setupEventListeners: function() {
      const sendBtn = document.getElementById('avatarai-send');
      const input = document.getElementById('avatarai-text');
      const micBtn = document.getElementById('avatarai-mic');
      
      sendBtn.addEventListener('click', () => this.sendMessage(input.value));
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendMessage(input.value);
      });
      micBtn.addEventListener('click', () => this.startVoiceRecording());
    },
    
    async sendMessage(text) {
      if (!text.trim()) return;
      
      const messagesDiv = document.getElementById('avatarai-messages');
      messagesDiv.innerHTML += \`<div style="margin: 0.5rem 0; padding: 0.5rem; background: #f0f0f0; border-radius: 6px;">\${text}</div>\`;
      document.getElementById('avatarai-text').value = '';
      
      try {
        const response = await fetch(this.config.workflowUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            avatarId: this.config.avatar,
            voiceId: this.config.voice,
            model: this.config.model,
            timestamp: new Date().toISOString()
          })
        });
        
        const data = await response.json();
        messagesDiv.innerHTML += \`<div style="margin: 0.5rem 0; padding: 0.5rem; background: #e3f2fd; border-radius: 6px;">\${data.text || 'Réponse reçue'}</div>\`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      } catch (error) {
        console.error('Error:', error);
        messagesDiv.innerHTML += \`<div style="margin: 0.5rem 0; padding: 0.5rem; background: #ffebee; border-radius: 6px;">❌ Erreur de connexion</div>\`;
      }
    },
    
    startVoiceRecording() {
      alert('Fonctionnalité vocale: Implémentez navigator.mediaDevices.getUserMedia() pour l\\'enregistrement audio');
    }
  };
  
  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AvatarAI.init());
  } else {
    AvatarAI.init();
  }
  
  window.AvatarAI = AvatarAI;
})();
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
