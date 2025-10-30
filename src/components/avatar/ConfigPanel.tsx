import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import N8nWorkflowGenerator from "./N8nWorkflowGenerator";
import WorkflowDesigner from "./WorkflowDesigner";
import PythonBackendGenerator from "./PythonBackendGenerator";
import EmbedGenerator from "./EmbedGenerator";
import { Key, Mic, Bot, User, Image as ImageIcon, FileCode, MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import EnvUploader from "./EnvUploader";
import ImageUploader from "./ImageUploader";
import VideoUploader from "./VideoUploader";
import WorkflowManager from "./WorkflowManager";
import ApiKeyValidator from "./ApiKeyValidator";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface WorkflowConfig {
  id: string;
  name: string;
  webhookUrl: string;
}

interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
}

interface ConfigPanelProps {
  config: {
    didApiKey: string;
    openaiApiKey: string;
    elevenlabsApiKey: string;
    selectedAvatar: string;
    customAvatarImage?: string;
    customAvatarVideo?: string;
    selectedVoice: string;
    selectedModel: string;
    workflows: WorkflowConfig[];
    selectedWorkflow: string;
    useN8n?: boolean;
    systemPrompt?: string;
  };
  setConfig: (config: any) => void;
}

const ConfigPanel = ({ config, setConfig }: ConfigPanelProps) => {
  const [useN8n, setUseN8n] = useState(false); // Python par défaut
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [voices, setVoices] = useState<Array<{ voice_id: string; name: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const { toast } = useToast();

  const handleEnvParsed = (env: Record<string, string>) => {
    console.log("🔑 Env keys received:", Object.keys(env));
    console.log("🔑 Env values:", env);
    
    const updatedConfig = {
      ...config,
      didApiKey: env.DID_API_KEY || env.VITE_DID_API_KEY || config.didApiKey,
      openaiApiKey: env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || config.openaiApiKey,
      elevenlabsApiKey: env.ELEVENLABS_API_KEY || env.VITE_ELEVENLABS_API_KEY || config.elevenlabsApiKey,
    };
    
    setConfig(updatedConfig);
  };

  // Charger les voix ElevenLabs au montage si la clé API est présente
  useEffect(() => {
    const loadVoices = async () => {
      if (!config.elevenlabsApiKey) {
        console.log('⚠️ ElevenLabs API key not set, skipping voice fetch');
        return;
      }

      setLoadingVoices(true);
      try {
        console.log('🎤 Fetching ElevenLabs voices...');
        const { data, error } = await supabase.functions.invoke('elevenlabs-voices');
        
        if (error) throw error;
        
        if (data?.voices) {
          setVoices(data.voices);
          console.log(`✅ Loaded ${data.voices.length} voices`);
        }
      } catch (error) {
        console.error('❌ Error loading voices:', error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les voix ElevenLabs. Vérifiez votre clé API.",
          variant: "destructive",
        });
      } finally {
        setLoadingVoices(false);
      }
    };

    loadVoices();
  }, [config.elevenlabsApiKey]);

  // Mettre à jour la config quand le mode backend change
  useEffect(() => {
    setConfig((prev: any) => ({
      ...prev,
      useN8n: useN8n
    }));
  }, [useN8n]);

  return (
    <Card className="glass p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure your API keys and preferences
        </p>
      </div>

      <Tabs defaultValue="api" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="avatar">Avatar</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4 mt-4">
          <EnvUploader onEnvParsed={handleEnvParsed} />

          <ApiKeyValidator config={{
            didApiKey: config.didApiKey,
            openaiApiKey: config.openaiApiKey,
            elevenlabsApiKey: config.elevenlabsApiKey
          }} />

          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="space-y-2">
              <Label htmlFor="did-key" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                D-ID API Key
              </Label>
              <Input
                id="did-key"
                type="password"
                placeholder="Enter your D-ID API key"
                value={config.didApiKey}
                onChange={(e) => setConfig({ ...config, didApiKey: e.target.value })}
                className="glass"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai-key" className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                OpenAI API Key
              </Label>
              <Input
                id="openai-key"
                type="password"
                placeholder="Enter your OpenAI API key"
                value={config.openaiApiKey}
                onChange={(e) => setConfig({ ...config, openaiApiKey: e.target.value })}
                className="glass"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="elevenlabs-key" className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                ElevenLabs API Key
              </Label>
              <Input
                id="elevenlabs-key"
                type="password"
                placeholder="Enter your ElevenLabs API key"
                value={config.elevenlabsApiKey}
                onChange={(e) => setConfig({ ...config, elevenlabsApiKey: e.target.value })}
                className="glass"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="avatar" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Image personnalisée
            </Label>
            <ImageUploader 
              currentImage={config.customAvatarImage}
              onImageSelected={(url) => setConfig({ ...config, customAvatarImage: url })}
            />
          </div>

          <div className="space-y-2 pt-4 border-t border-border/50">
            <VideoUploader 
              currentVideo={config.customAvatarVideo}
              onVideoUploaded={(url) => setConfig({ ...config, customAvatarVideo: url })}
            />
          </div>

          <div className="space-y-2 pt-4 border-t border-border/50">
            <Label htmlFor="avatar" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Avatar pré-configuré
            </Label>
            <Select
              value={config.selectedAvatar}
              onValueChange={(value) => setConfig({ ...config, selectedAvatar: value })}
            >
              <SelectTrigger className="glass">
                <SelectValue placeholder="Select an avatar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="amy">Amy - Professional Woman</SelectItem>
                <SelectItem value="john">John - Business Man</SelectItem>
                <SelectItem value="sophia">Sophia - Young Professional</SelectItem>
                <SelectItem value="marcus">Marcus - Tech Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="options" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="voice" className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Voice (ElevenLabs)
            </Label>
            <Select
              value={config.selectedVoice}
              onValueChange={(value) => setConfig({ ...config, selectedVoice: value })}
              disabled={loadingVoices}
            >
              <SelectTrigger className="glass">
                <SelectValue placeholder={loadingVoices ? "Chargement..." : "Sélectionner une voix"} />
              </SelectTrigger>
              <SelectContent>
                {voices.length > 0 ? (
                  voices.map((voice) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                      {voice.name}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="EXAVITQu4vr4xnSDxMaL">Sarah - Warm & Friendly</SelectItem>
                    <SelectItem value="TX3LPaxmHKxFdv7VOQHJ">Liam - Professional</SelectItem>
                    <SelectItem value="pNInz6obpgDQGcFmaJgB">Charlotte - Energetic</SelectItem>
                    <SelectItem value="nPczCjzI2devNBz1zQrb">Brian - Clear & Concise</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              LLM Model
            </Label>
            <Select
              value={config.selectedModel}
              onValueChange={(value) => setConfig({ ...config, selectedModel: value })}
            >
              <SelectTrigger className="glass">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-5-2025-08-07">GPT-5 - Most Capable</SelectItem>
                <SelectItem value="gpt-5-mini-2025-08-07">GPT-5 Mini - Fast & Efficient</SelectItem>
                <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 - Reliable</SelectItem>
                <SelectItem value="o3-2025-04-16">O3 - Advanced Reasoning</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="system-prompt" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              System Prompt (ChatGPT)
            </Label>
            <p className="text-sm text-muted-foreground">
              Définissez le comportement et la personnalité de votre avatar
            </p>
            <Textarea
              id="system-prompt"
              placeholder="Vous êtes un assistant virtuel sympathique et professionnel..."
              value={config.systemPrompt || "Vous êtes un assistant virtuel nommé Clara. Vous êtes sympathique, professionnelle et vous aidez les utilisateurs avec leurs questions."}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              className="glass min-h-[200px]"
            />
          </div>
        </TabsContent>

        <TabsContent value="workflow" className="mt-4">
          <div className="glass rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Mode Backend</h3>
                <p className="text-sm text-muted-foreground">
                  Choisissez entre n8n workflow ou Python backend
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="backend-mode" className="text-sm font-medium">
                  {useN8n ? "n8n Workflow" : "Python Backend"}
                </Label>
                <Switch
                  id="backend-mode"
                  checked={useN8n}
                  onCheckedChange={setUseN8n}
                />
              </div>
            </div>
          </div>

          {useN8n ? (
            <div className="space-y-6">
              <WorkflowManager
                workflows={config.workflows}
                selectedWorkflow={config.selectedWorkflow}
                onWorkflowsChange={(workflows) => setConfig({ ...config, workflows })}
                onSelectedChange={(id) => setConfig({ ...config, selectedWorkflow: id })}
              />
              
              <div className="border-t border-border/50 pt-6">
                <h4 className="text-lg font-semibold mb-4">Designer Visuel de Workflow</h4>
                <WorkflowDesigner onWorkflowUpdate={setWorkflowNodes} />
              </div>
              
              <div className="border-t border-border/50 pt-6">
                <N8nWorkflowGenerator 
                  config={{
                    selectedWorkflow: config.selectedWorkflow,
                    workflows: config.workflows
                  }}
                />
              </div>
            </div>
          ) : (
            <PythonBackendGenerator 
              config={{
                openaiKey: config.openaiApiKey,
                elevenlabsKey: config.elevenlabsApiKey,
                didKey: config.didApiKey,
                model: config.selectedModel,
                voiceId: config.selectedVoice
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <FileCode className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Code d'intégration</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Copiez ce code pour intégrer votre avatar dans n'importe quelle page HTML
            </p>
            <EmbedGenerator config={config} />
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default ConfigPanel;
