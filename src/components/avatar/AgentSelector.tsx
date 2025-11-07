import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Agent {
  agent_id: string;
  name: string;
  description?: string;
}

interface AgentSelectorProps {
  value: string;
  onChange: (value: string) => void;
  apiKey: string;
}

export const AgentSelector = ({ value, onChange, apiKey }: AgentSelectorProps) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (apiKey) {
      loadAgents();
    }
  }, [apiKey]);

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      console.log("🤖 Fetching ElevenLabs agents...");
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-voices', {
        body: {}
      });

      if (error) throw error;

      if (data?.agents) {
        console.log(`✅ Loaded ${data.agents.length} agents`);
        setAgents(data.agents);
      }
    } catch (error) {
      console.error("❌ Error loading agents:", error);
      toast.error("Erreur lors du chargement des agents");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="agent-selector" className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Agent ElevenLabs
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => window.open('https://elevenlabs.io/app/conversational-ai', '_blank')}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Créer un agent
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-secondary/30">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Chargement des agents...</span>
        </div>
      ) : agents.length > 0 ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="glass">
            <SelectValue placeholder="Sélectionnez un agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.agent_id} value={agent.agent_id}>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{agent.name}</span>
                  {agent.description && (
                    <span className="text-xs text-muted-foreground">
                      {agent.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="p-4 rounded-lg border border-dashed border-border/50 bg-secondary/20 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Aucun agent trouvé
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://elevenlabs.io/app/conversational-ai', '_blank')}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Créer votre premier agent
          </Button>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Les agents permettent de créer des conversations IA personnalisées avec voix ultra-réaliste
      </p>
    </div>
  );
};
