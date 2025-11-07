import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Sparkles, MessageSquare } from "lucide-react";

interface ProviderSelectionProps {
  onProviderSelect: (provider: 'did' | 'musetalk') => void;
}

const ProviderSelection = ({ onProviderSelect }: ProviderSelectionProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-background/95">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AvatarAI
          </h1>
          <p className="text-xl text-muted-foreground">
            Choisissez votre moteur d'avatar IA
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="glass p-8 space-y-6 cursor-pointer hover:scale-105 transition-all duration-300 hover:shadow-xl border-2 hover:border-primary/50"
            onClick={() => onProviderSelect('did')}
          >
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Video className="w-10 h-10 text-primary" />
              </div>
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold">D-ID</h2>
              <p className="text-muted-foreground">
                Avatars vidéo haute qualité avec synchronisation labiale avancée et rendu professionnel
              </p>
            </div>
            <Button 
              className="w-full" 
              size="lg"
              onClick={(e) => {
                e.stopPropagation();
                onProviderSelect('did');
              }}
            >
              Utiliser D-ID
            </Button>
          </Card>

          <Card 
            className="glass p-8 space-y-6 cursor-pointer hover:scale-105 transition-all duration-300 hover:shadow-xl border-2 hover:border-primary/50"
            onClick={() => onProviderSelect('musetalk')}
          >
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold">Muse</h2>
              <p className="text-muted-foreground">
                Solution open-source avec contrôle total et personnalisation avancée sur votre infrastructure
              </p>
            </div>
            <Button 
              className="w-full" 
              size="lg"
              onClick={(e) => {
                e.stopPropagation();
                onProviderSelect('musetalk');
              }}
            >
              Utiliser Muse
            </Button>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default ProviderSelection;
