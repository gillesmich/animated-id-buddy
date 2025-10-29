import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface EnvUploaderProps {
  onEnvParsed: (env: Record<string, string>) => void;
}

const EnvUploader = ({ onEnvParsed }: EnvUploaderProps) => {
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const parsed: Record<string, string> = {};

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            parsed[key.trim()] = value.trim();
          }
        }
      });

      onEnvParsed(parsed);
      toast({
        title: "Fichier chargé",
        description: `${Object.keys(parsed).length} clés API détectées`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de lire le fichier",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="env-upload" className="cursor-pointer">
        <div className="glass border-2 border-dashed border-border/50 hover:border-primary/50 rounded-lg p-6 text-center transition-colors">
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Uploader fichier .env</p>
          <p className="text-xs text-muted-foreground mt-1">
            Charger toutes les clés API en une fois
          </p>
        </div>
        <input
          id="env-upload"
          type="file"
          accept=".env,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
      </label>
    </div>
  );
};

export default EnvUploader;
