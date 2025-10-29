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

      console.log("📦 Parsed env:", parsed);
      onEnvParsed(parsed);
      toast({
        title: "Fichier chargé",
        description: `${Object.keys(parsed).length} clés API détectées`,
      });
      
      // Reset input to allow re-upload of same file
      e.target.value = "";
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
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 rounded-lg p-4 mb-4">
        <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Import Rapide
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Gagnez du temps en chargeant toutes vos clés API depuis un fichier .env
        </p>
        
        <label htmlFor="env-upload" className="cursor-pointer block">
          <div className="glass border-2 border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 rounded-lg p-6 text-center transition-all duration-200 hover:shadow-lg">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-primary">Cliquez pour charger votre fichier .env</p>
              <p className="text-xs text-muted-foreground">
                Formats acceptés: .env, .txt
              </p>
            </div>
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
    </div>
  );
};

export default EnvUploader;
