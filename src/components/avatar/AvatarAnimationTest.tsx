import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface AvatarAnimationTestProps {
  config: {
    customAvatarImage?: string;
    selectedAvatar: string;
  };
}

const AvatarAnimationTest = ({ config }: AvatarAnimationTestProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationType, setAnimationType] = useState<'idle' | 'talking' | 'listening'>('idle');
  const { toast } = useToast();

  const animations = {
    idle: "Repos - Avatar immobile",
    talking: "Parole - Avatar qui parle",
    listening: "Écoute - Avatar attentif"
  };

  const handleStartAnimation = (type: 'idle' | 'talking' | 'listening') => {
    setAnimationType(type);
    setIsAnimating(true);
    
    toast({
      title: "Animation démarrée",
      description: `Test d'animation: ${animations[type]}`,
    });

    // Simule une durée d'animation
    setTimeout(() => {
      setIsAnimating(false);
    }, 5000);
  };

  const handleStopAnimation = () => {
    setIsAnimating(false);
    setAnimationType('idle');
    
    toast({
      title: "Animation arrêtée",
      description: "L'avatar est retourné au repos",
    });
  };

  const getAnimationClass = () => {
    if (!isAnimating) return '';
    
    switch (animationType) {
      case 'talking':
        return 'animate-pulse';
      case 'listening':
        return 'animate-bounce';
      default:
        return '';
    }
  };

  return (
    <Card className="glass p-6 space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Tests d'Animation Avatar
        </h3>
        <p className="text-sm text-muted-foreground">
          Testez les différentes animations de l'avatar
        </p>
      </div>

      {/* Preview Area */}
      <div className="aspect-video rounded-lg bg-secondary/30 border border-border/50 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 gradient-glow opacity-30"></div>
        
        <div className={`relative z-10 transition-all duration-300 ${getAnimationClass()}`}>
          <div className="w-32 h-32 rounded-full gradient-primary flex items-center justify-center shadow-elegant">
            <div className="w-28 h-28 rounded-full bg-background/90 flex items-center justify-center">
              {config.customAvatarImage ? (
                <img 
                  src={config.customAvatarImage} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="text-4xl">🤖</div>
              )}
            </div>
          </div>
        </div>

        {/* Animation Indicator */}
        {isAnimating && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-primary/90 text-primary-foreground text-sm font-medium animate-fade-in">
            {animations[animationType]}
          </div>
        )}
      </div>

      {/* Animation Controls */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className="glass"
            onClick={() => handleStartAnimation('idle')}
            disabled={isAnimating && animationType === 'idle'}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Repos
          </Button>
          <Button
            variant="outline"
            className="glass"
            onClick={() => handleStartAnimation('talking')}
            disabled={isAnimating && animationType === 'talking'}
          >
            <Play className="w-4 h-4 mr-2" />
            Parole
          </Button>
          <Button
            variant="outline"
            className="glass"
            onClick={() => handleStartAnimation('listening')}
            disabled={isAnimating && animationType === 'listening'}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Écoute
          </Button>
        </div>

        {isAnimating && (
          <Button
            onClick={handleStopAnimation}
            variant="destructive"
            className="w-full"
          >
            <Pause className="w-4 h-4 mr-2" />
            Arrêter l'animation
          </Button>
        )}
      </div>

      {/* Animation Info */}
      <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 space-y-2">
        <h4 className="font-semibold text-accent">États d'animation:</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Repos:</strong> Avatar immobile en attente</li>
          <li><strong>Parole:</strong> Mouvement des lèvres et expressions</li>
          <li><strong>Écoute:</strong> Avatar attentif, micro-mouvements</li>
        </ul>
      </div>

      {/* Technical Details */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Détails techniques:</h4>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Avatar: {config.selectedAvatar || 'Non sélectionné'}</p>
          <p>• Image: {config.customAvatarImage ? 'Personnalisée' : 'Par défaut'}</p>
          <p>• État: {isAnimating ? `Animation ${animationType}` : 'Inactif'}</p>
        </div>
      </div>
    </Card>
  );
};

export default AvatarAnimationTest;
