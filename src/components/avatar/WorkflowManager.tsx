import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Workflow, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface WorkflowConfig {
  id: string;
  name: string;
  webhookUrl: string;
}

interface WorkflowManagerProps {
  workflows: WorkflowConfig[];
  selectedWorkflow: string;
  onWorkflowsChange: (workflows: WorkflowConfig[]) => void;
  onSelectedChange: (id: string) => void;
}

const WorkflowManager = ({ 
  workflows, 
  selectedWorkflow, 
  onWorkflowsChange,
  onSelectedChange 
}: WorkflowManagerProps) => {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const addWorkflow = () => {
    if (!newName || !newUrl) return;
    
    const newWorkflow: WorkflowConfig = {
      id: Date.now().toString(),
      name: newName,
      webhookUrl: newUrl
    };
    
    onWorkflowsChange([...workflows, newWorkflow]);
    setNewName("");
    setNewUrl("");
  };

  const removeWorkflow = (id: string) => {
    onWorkflowsChange(workflows.filter(w => w.id !== id));
    if (selectedWorkflow === id) {
      onSelectedChange("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Workflow className="w-4 h-4" />
          Workflow n8n actif
        </Label>
        <Select value={selectedWorkflow} onValueChange={onSelectedChange}>
          <SelectTrigger className="glass">
            <SelectValue placeholder="Sélectionner un workflow" />
          </SelectTrigger>
          <SelectContent>
            {workflows.map(workflow => (
              <SelectItem key={workflow.id} value={workflow.id}>
                {workflow.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 pt-4 border-t border-border/50">
        <Label className="text-sm font-medium">Ajouter un workflow</Label>
        
        <input
          type="text"
          placeholder="Nom du workflow"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        
        <Textarea
          placeholder="URL du webhook n8n"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="glass min-h-[80px]"
        />
        
        <Button 
          onClick={addWorkflow} 
          size="sm" 
          className="w-full"
          disabled={!newName || !newUrl}
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter workflow
        </Button>
      </div>

      {workflows.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border/50">
          <Label className="text-sm font-medium">Workflows configurés</Label>
          {workflows.map(workflow => (
            <div key={workflow.id} className="glass p-3 rounded-lg flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{workflow.name}</p>
                <p className="text-xs text-muted-foreground truncate">{workflow.webhookUrl}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeWorkflow(workflow.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowManager;
