import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
}

interface VoiceSelectorProps {
  value: string;
  onChange: (value: string) => void;
  apiKey?: string;
}

export function VoiceSelector({ value, onChange, apiKey }: VoiceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadVoices = async () => {
      setLoading(true);
      try {
        console.log('🎤 Fetching ElevenLabs voices and agents...');
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
          description: "Impossible de charger les voix. Vérifiez la configuration ElevenLabs.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadVoices();
  }, [toast]);

  // Grouper les voix par catégorie
  const groupedVoices = voices.reduce((acc, voice) => {
    const category = voice.category || 'Voix standards';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(voice);
    return acc;
  }, {} as Record<string, Voice[]>);

  const selectedVoice = voices.find((voice) => voice.voice_id === value);

  return (
    <div className="space-y-2">
      <Label htmlFor="voice-selector" className="flex items-center gap-2">
        <Mic className="w-4 h-4" />
        Voix (ElevenLabs)
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="voice-selector"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between glass"
            disabled={loading}
          >
            <div className="flex items-center gap-2 truncate">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement...
                </>
              ) : selectedVoice ? (
                <>
                  <Mic className="w-4 h-4" />
                  {selectedVoice.name}
                  {selectedVoice.category && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedVoice.category}
                    </Badge>
                  )}
                </>
              ) : (
                "Sélectionner une voix..."
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher une voix..." />
            <CommandList>
              <CommandEmpty>Aucune voix trouvée.</CommandEmpty>
              {Object.entries(groupedVoices).map(([category, categoryVoices]) => (
                <CommandGroup key={category} heading={category}>
                  {categoryVoices.map((voice) => (
                    <CommandItem
                      key={voice.voice_id}
                      value={`${voice.name} ${voice.voice_id}`}
                      onSelect={() => {
                        onChange(voice.voice_id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === voice.voice_id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col gap-1">
                        <span>{voice.name}</span>
                        {voice.labels && Object.keys(voice.labels).length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {Object.entries(voice.labels).map(([key, val]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {val}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
