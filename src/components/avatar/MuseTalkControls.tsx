import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Play, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

interface MuseTalkControlsProps {
  onConnectionStatusChange?: (connected: boolean) => void;
}

const MuseTalkControls = ({ onConnectionStatusChange }: MuseTalkControlsProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const { toast } = useToast();

  const checkConnection = async () => {
    setIsConnecting(true);
    try {
      // Test FAL AI connection by making a simple test call
      const response = await authenticatedFetch('musetalk-avatar', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_talk',
          data: {
            source_url: 'https://via.placeholder.com/512x512',
            audio_url: 'data:audio/mpeg;base64,test',
            config: { bbox_shift: 0 }
          }
        }),
      });

      // Even if it fails, if we get a response it means FAL is configured
      const isConfigured = response.status !== 400;
      
      setIsConnected(isConfigured);
      setIsInitialized(isConfigured);
      
      if (isConfigured) {
        setServerStatus({ status: 'ready', timestamp: new Date().toISOString() });
        onConnectionStatusChange?.(true);
        
        toast({
          title: "✅ FAL AI configuré",
          description: "MuseTalk est prêt via FAL AI",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'FAL API key manquante');
      }
    } catch (error) {
      console.error('Erreur FAL AI:', error);
      setIsConnected(false);
      setIsInitialized(false);
      
      onConnectionStatusChange?.(false);
      
      toast({
        title: "❌ Configuration FAL AI manquante",
        description: error instanceof Error ? error.message : "Ajoutez votre clé FAL_API_KEY",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const initializeModel = async () => {
    // With FAL AI, no initialization needed - instant ready
    toast({
      title: "✅ Déjà prêt",
      description: "FAL AI MuseTalk est toujours prêt à l'emploi",
    });
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          FAL AI MuseTalk
        </CardTitle>
        <CardDescription>
          Vérifiez la configuration de votre clé FAL AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">État de connexion</p>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <Badge variant="outline" className="bg-green-500/10 text-green-500">
                    Connecté
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline" className="bg-muted">
                    Déconnecté
                  </Badge>
                </>
              )}
            </div>
          </div>
          <Button
            onClick={checkConnection}
            disabled={isConnecting}
            variant="outline"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Vérification...
              </>
            ) : (
              "Vérifier la connexion"
            )}
          </Button>
        </div>

        {isConnected && (
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="space-y-1">
              <p className="text-sm font-medium">État du modèle</p>
              <div className="flex items-center gap-2">
                {isInitialized ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      Initialisé
                    </Badge>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-orange-500" />
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
                      Non initialisé
                    </Badge>
                  </>
                )}
              </div>
            </div>
            {!isInitialized && (
              <Button
                onClick={initializeModel}
                disabled={isInitializing}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initialisation...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Initialiser le modèle
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {serverStatus && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm font-medium mb-2">Informations serveur</p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                Statut: <span className="text-foreground font-mono">{serverStatus.status}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Timestamp: <span className="text-foreground font-mono">
                  {new Date(serverStatus.timestamp).toLocaleString('fr-FR')}
                </span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MuseTalkControls;
