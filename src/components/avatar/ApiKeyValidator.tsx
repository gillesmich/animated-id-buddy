import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Shield } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface ApiKeyValidatorProps {
  config: {
    didApiKey: string;
    openaiApiKey: string;
    elevenlabsApiKey: string;
  };
  avatarProvider?: 'did' | 'musetalk';
}

interface ValidationResult {
  did: boolean | null;
  openai: boolean | null;
  elevenlabs: boolean | null;
}

const ApiKeyValidator = ({ config, avatarProvider }: ApiKeyValidatorProps) => {
  const [isValidating, setIsValidating] = useState(false);
  const [results, setResults] = useState<ValidationResult>({
    did: null,
    openai: null,
    elevenlabs: null,
  });
  const { toast } = useToast();

  const validateDidKey = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://api.d-id.com/credits', {
        headers: {
          'Authorization': `Basic ${config.didApiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const validateOpenAIKey = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const validateElevenLabsKey = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: {
          'xi-api-key': config.elevenlabsApiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleValidateAll = async () => {
    setIsValidating(true);
    setResults({ did: null, openai: null, elevenlabs: null });

    const newResults: ValidationResult = {
      did: null,
      openai: null,
      elevenlabs: null,
    };

    // Validate D-ID only if not using MuseTalk
    if (avatarProvider !== 'musetalk' && config.didApiKey) {
      newResults.did = await validateDidKey();
    }

    // Validate OpenAI
    if (config.openaiApiKey) {
      newResults.openai = await validateOpenAIKey();
    }

    // Validate ElevenLabs
    if (config.elevenlabsApiKey) {
      newResults.elevenlabs = await validateElevenLabsKey();
    }

    setResults(newResults);
    setIsValidating(false);

    const allValid = Object.values(newResults).every(v => v === true || v === null);
    const validatedKeys = Object.entries(newResults).filter(([_, v]) => v !== null);
    
    if (allValid && validatedKeys.length > 0) {
      toast({
        title: "✅ Validation réussie",
        description: "Toutes les clés API sont valides",
      });
    } else {
      const invalidKeys = Object.entries(newResults)
        .filter(([_, valid]) => valid === false)
        .map(([key]) => key.toUpperCase());
      
      if (invalidKeys.length > 0) {
        toast({
          title: "❌ Échec de validation",
          description: `Clés invalides: ${invalidKeys.join(', ')}`,
          variant: "destructive",
        });
      }
    }
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === null) return null;
    return status ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-destructive" />
    );
  };

  const canValidate = config.didApiKey || config.openaiApiKey || config.elevenlabsApiKey;

  return (
    <Card className="glass p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Validation des Clés API
        </h3>
        <p className="text-sm text-muted-foreground">
          Vérifiez que vos clés API sont valides
        </p>
      </div>

      <div className="space-y-3">
        {avatarProvider !== 'musetalk' && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">D-ID API</span>
              {results.did !== null && (
                <span className="text-xs text-muted-foreground">
                  {results.did ? "Connecté" : "Invalide"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isValidating ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                getStatusIcon(results.did)
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">OpenAI API</span>
            {results.openai !== null && (
              <span className="text-xs text-muted-foreground">
                {results.openai ? "Connecté" : "Invalide"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isValidating ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              getStatusIcon(results.openai)
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">ElevenLabs API</span>
            {results.elevenlabs !== null && (
              <span className="text-xs text-muted-foreground">
                {results.elevenlabs ? "Connecté" : "Invalide"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isValidating ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              getStatusIcon(results.elevenlabs)
            )}
          </div>
        </div>
      </div>

      <Button
        onClick={handleValidateAll}
        disabled={!canValidate || isValidating}
        className="w-full gradient-primary"
      >
        {isValidating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Validation en cours...
          </>
        ) : (
          <>
            <Shield className="w-4 h-4 mr-2" />
            Valider les Clés
          </>
        )}
      </Button>

      {!canValidate && (
        <p className="text-xs text-muted-foreground text-center">
          Ajoutez au moins une clé API pour valider
        </p>
      )}
    </Card>
  );
};

export default ApiKeyValidator;
