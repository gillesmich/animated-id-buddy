import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowRight, Settings } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
}

interface WorkflowDesignerProps {
  onWorkflowUpdate: (nodes: WorkflowNode[]) => void;
}

const nodeTypes = [
  { value: "webhook", label: "Webhook Trigger", icon: "🌐" },
  { value: "openai", label: "OpenAI", icon: "🤖" },
  { value: "elevenlabs", label: "ElevenLabs TTS", icon: "🗣️" },
  { value: "did", label: "D-ID Avatar", icon: "👤" },
  { value: "code", label: "Code/Transform", icon: "💻" },
  { value: "http", label: "HTTP Request", icon: "📡" },
];

const WorkflowDesigner = ({ onWorkflowUpdate }: WorkflowDesignerProps) => {
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    {
      id: "1",
      type: "webhook",
      name: "Webhook Trigger",
      config: { path: "avatar-webhook" }
    }
  ]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { toast } = useToast();

  const addNode = () => {
    const newNode: WorkflowNode = {
      id: Date.now().toString(),
      type: "code",
      name: "New Node",
      config: {}
    };
    const updated = [...nodes, newNode];
    setNodes(updated);
    onWorkflowUpdate(updated);
  };

  const removeNode = (id: string) => {
    const updated = nodes.filter(n => n.id !== id);
    setNodes(updated);
    onWorkflowUpdate(updated);
    if (selectedNode === id) setSelectedNode(null);
  };

  const updateNode = (id: string, updates: Partial<WorkflowNode>) => {
    const updated = nodes.map(n => n.id === id ? { ...n, ...updates } : n);
    setNodes(updated);
    onWorkflowUpdate(updated);
  };

  const updateNodeConfig = (id: string, key: string, value: any) => {
    const updated = nodes.map(n => 
      n.id === id ? { ...n, config: { ...n.config, [key]: value } } : n
    );
    setNodes(updated);
    onWorkflowUpdate(updated);
  };

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Workflow Canvas */}
      <Card className="glass p-4 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Workflow Designer</h3>
          <Button onClick={addNode} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter nœud
          </Button>
        </div>

        <div className="space-y-3">
          {nodes.map((node, index) => (
            <div key={node.id}>
              <div
                className={`glass p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  selectedNode === node.id
                    ? "border-primary shadow-lg"
                    : "border-border/50 hover:border-primary/50"
                }`}
                onClick={() => setSelectedNode(node.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl">
                      {nodeTypes.find(t => t.value === node.type)?.icon || "📦"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{node.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {nodeTypes.find(t => t.value === node.type)?.label}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNode(node.id);
                    }}
                    disabled={index === 0}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {index < nodes.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowRight className="w-5 h-5 text-primary" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Node Configuration Panel */}
      <Card className="glass p-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Configuration</h3>
        </div>

        {selectedNodeData ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de nœud</Label>
              <Select
                value={selectedNodeData.type}
                onValueChange={(value) => updateNode(selectedNode!, { type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {nodeTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nom du nœud</Label>
              <Input
                value={selectedNodeData.name}
                onChange={(e) => updateNode(selectedNode!, { name: e.target.value })}
                placeholder="Nom du nœud"
              />
            </div>

            {/* Node-specific configuration */}
            {selectedNodeData.type === "openai" && (
              <>
                <div className="space-y-2">
                  <Label>Modèle</Label>
                  <Select
                    value={selectedNodeData.config.model || "gpt-4o-mini"}
                    onValueChange={(value) => updateNodeConfig(selectedNode!, "model", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>System Prompt</Label>
                  <Textarea
                    value={selectedNodeData.config.systemPrompt || ""}
                    onChange={(e) => updateNodeConfig(selectedNode!, "systemPrompt", e.target.value)}
                    placeholder="You are a helpful assistant..."
                    rows={3}
                  />
                </div>
              </>
            )}

            {selectedNodeData.type === "elevenlabs" && (
              <div className="space-y-2">
                <Label>Model ID</Label>
                <Select
                  value={selectedNodeData.config.modelId || "eleven_multilingual_v2"}
                  onValueChange={(value) => updateNodeConfig(selectedNode!, "modelId", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eleven_multilingual_v2">Multilingual v2</SelectItem>
                    <SelectItem value="eleven_turbo_v2_5">Turbo v2.5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedNodeData.type === "code" && (
              <div className="space-y-2">
                <Label>Code JavaScript</Label>
                <Textarea
                  value={selectedNodeData.config.code || ""}
                  onChange={(e) => updateNodeConfig(selectedNode!, "code", e.target.value)}
                  placeholder="const data = $input.item.json;&#10;return { json: data };"
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
            )}

            {selectedNodeData.type === "http" && (
              <>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={selectedNodeData.config.url || ""}
                    onChange={(e) => updateNodeConfig(selectedNode!, "url", e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Méthode</Label>
                  <Select
                    value={selectedNodeData.config.method || "POST"}
                    onValueChange={(value) => updateNodeConfig(selectedNode!, "method", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sélectionnez un nœud pour le configurer
          </p>
        )}
      </Card>
    </div>
  );
};

export default WorkflowDesigner;
