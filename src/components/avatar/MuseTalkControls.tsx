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
      const response = await authenticatedFetch('musetalk-avatar', {
        method: 'POST',
        body: JSON.stringify({
          action: 'health'
        }),
      });

      if (!response.ok) {
        throw new Error('Serveur MuseTalk non disponible');
      }

      const data = await response.json();
      setServerStatus(data);
      setIsConnected(true);
      setIsInitialized(data.model_initialized || false);
      
      onConnectionStatusChange?.(true);
      
      toast({
        title: "✅ Connexion réussie",
        description: "Le serveur MuseTalk est accessible",
      });
    } catch (error) {
      console.error('Erreur connexion MuseTalk:', error);
      setIsConnected(false);
      setIsInitialized(false);
      
      onConnectionStatusChange?.(false);
      
      toast({
        title: "❌ Erreur de connexion",
        description: "Impossible de contacter le serveur MuseTalk",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const initializeModel = async () => {
    if (!isConnected) {
      toast({
        title: "Erreur",
        description: "Veuillez d'abord vérifier la connexion",
        variant: "destructive",
      });
      return;
    }

    setIsInitializing(true);
    try {
      const response = await authenticatedFetch('musetalk-avatar', {
        method: 'POST',
        body: JSON.stringify({
          action: 'initialize'
        }),
      });

      if (!response.ok) {
        throw new Error('Échec de l\'initialisation du modèle');
      }

      const data = await response.json();
      setIsInitialized(true);
      
      toast({
        title: "✅ Modèle initialisé",
        description: "MuseTalk est prêt à générer des vidéos",
      });
    } catch (error) {
      console.error('Erreur initialisation:', error);
      toast({
        title: "❌ Erreur d'initialisation",
        description: "Impossible d'initialiser le modèle MuseTalk",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          MuseTalk Server
        </CardTitle>
        <CardDescription>
          Gérez la connexion et l'initialisation du serveur MuseTalk
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
