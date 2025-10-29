import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import N8nWorkflowGenerator from "./N8nWorkflowGenerator";
import { Key, Mic, Bot, User, Image as ImageIcon, Workflow } from "lucide-react";
import EnvUploader from "./EnvUploader";
import ImageUploader from "./ImageUploader";
import WorkflowManager from "./WorkflowManager";

interface WorkflowConfig {
  id: string;
  name: string;
  webhookUrl: string;
}

interface ConfigPanelProps {
  config: {
    didApiKey: string;
    openaiApiKey: string;
    elevenlabsApiKey: string;
    selectedAvatar: string;
    customAvatarImage?: string;
    selectedVoice: string;
    selectedModel: string;
    workflows: WorkflowConfig[];
    selectedWorkflow: string;
  };
  setConfig: (config: any) => void;
}

const ConfigPanel = ({ config, setConfig }: ConfigPanelProps) => {
  const handleEnvParsed = (env: Record<string, string>) => {
    setConfig({
      ...config,
      didApiKey: env.DID_API_KEY || env.VITE_DID_API_KEY || config.didApiKey,
      openaiApiKey: env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || config.openaiApiKey,
      elevenlabsApiKey: env.ELEVENLABS_API_KEY || env.VITE_ELEVENLABS_API_KEY || config.elevenlabsApiKey,
    });
  };

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="avatar">Avatar</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4 mt-4">
          <EnvUploader onEnvParsed={handleEnvParsed} />

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
            >
              <SelectTrigger className="glass">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXAVITQu4vr4xnSDxMaL">Sarah - Warm & Friendly</SelectItem>
                <SelectItem value="TX3LPaxmHKxFdv7VOQHJ">Liam - Professional</SelectItem>
                <SelectItem value="pNInz6obpgDQGcFmaJgB">Charlotte - Energetic</SelectItem>
                <SelectItem value="nPczCjzI2devNBz1zQrb">Brian - Clear & Concise</SelectItem>
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

        <TabsContent value="workflow" className="mt-4">
          <WorkflowManager
            workflows={config.workflows}
            selectedWorkflow={config.selectedWorkflow}
            onWorkflowsChange={(workflows) => setConfig({ ...config, workflows })}
            onSelectedChange={(id) => setConfig({ ...config, selectedWorkflow: id })}
          />
          
          <div className="mt-6">
            <N8nWorkflowGenerator 
              config={{
                selectedWorkflow: config.selectedWorkflow,
                workflows: config.workflows
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default ConfigPanel;
