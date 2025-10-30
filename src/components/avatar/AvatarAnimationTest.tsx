import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { getAvatarImage } from "@/config/avatars";

interface AvatarAnimationTestProps {
  config: {
    customAvatarImage?: string;
    selectedAvatar: string;
  };
}

const AvatarAnimationTest = ({ config }: AvatarAnimationTestProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationType, setAnimationType] = useState<'idle' | 'talking' | 'listening'>('idle');
  const [animationFrame, setAnimationFrame] = useState(0);
  const { toast } = useToast();

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 100);
    }, 50);

    return () => clearInterval(interval);
  }, [isAnimating]);

  const animations = {
    idle: "Repos - Avatar immobile",
    talking: "Parole - Avatar qui parle",
    listening: "Écoute - Avatar attentif"
  };

  const handleStartAnimation = (type: 'idle' | 'talking' | 'listening') => {
    setAnimationType(type);
    setIsAnimating(true);
    setAnimationFrame(0);
    
    toast({
      title: "🎬 Animation démarrée",
      description: `Test d'animation: ${animations[type]}`,
    });

    // Animation auto-stop après 5 secondes
    setTimeout(() => {
      setIsAnimating(false);
      toast({
        title: "⏸️ Animation terminée",
        description: "L'avatar est retourné au repos",
      });
    }, 5000);
  };

  const handleStopAnimation = () => {
    setIsAnimating(false);
    setAnimationType('idle');
    setAnimationFrame(0);
    
    toast({
      title: "⏹️ Animation arrêtée",
      description: "L'avatar est retourné au repos",
    });
  };

  const getAnimationStyles = () => {
    if (!isAnimating) return {};
    
    const progress = animationFrame / 100;
    
    switch (animationType) {
      case 'talking':
        // Mouvement de bouche et tête
        return {
          transform: `scale(${1 + Math.sin(progress * Math.PI * 10) * 0.05}) 
                     rotate(${Math.sin(progress * Math.PI * 5) * 3}deg)`,
          transition: 'transform 0.05s ease-out'
        };
      case 'listening':
        // Léger mouvement de balancement
        return {
          transform: `translateY(${Math.sin(progress * Math.PI * 4) * 8}px) 
                     rotate(${Math.sin(progress * Math.PI * 2) * 2}deg)`,
          transition: 'transform 0.1s ease-in-out'
        };
      default:
        return {};
    }
  };

  const getGlowIntensity = () => {
    if (!isAnimating) return 0.3;
    const progress = animationFrame / 100;
    return 0.3 + Math.sin(progress * Math.PI * 8) * 0.3;
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
        <div 
          className="absolute inset-0 gradient-glow transition-opacity duration-100" 
          style={{ opacity: getGlowIntensity() }}
        />
        
        <div 
          className="relative z-10"
          style={getAnimationStyles()}
        >
          <div className="w-32 h-32 rounded-full gradient-primary flex items-center justify-center shadow-elegant relative">
            <div className="w-28 h-28 rounded-full bg-background/90 flex items-center justify-center relative overflow-hidden">
              {config.customAvatarImage && config.customAvatarImage.trim() !== '' ? (
                <img 
                  src={config.customAvatarImage} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : config.selectedAvatar ? (
                <img 
                  src={getAvatarImage(config.selectedAvatar)} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="text-4xl">🤖</div>
              )}
              
              {/* Talking indicator */}
              {isAnimating && animationType === 'talking' && (
                <div className="absolute bottom-4 flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-4 bg-primary rounded-full animate-pulse"
                      style={{
                        animationDelay: `${i * 0.1}s`,
                        height: `${12 + Math.sin((animationFrame + i * 10) / 10) * 8}px`
                      }}
                    />
                  ))}
                </div>
              )}
              
              {/* Listening indicator */}
              {isAnimating && animationType === 'listening' && (
                <div className="absolute top-2 right-2">
                  <Volume2 className="w-5 h-5 text-primary animate-pulse" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Animation Status Badge */}
        {isAnimating && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-primary/90 text-primary-foreground text-sm font-medium animate-fade-in flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            {animations[animationType]}
          </div>
        )}

        {/* Frame counter (debug) */}
        {isAnimating && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/50 text-white text-xs font-mono">
            Frame: {animationFrame}
          </div>
        )}
      </div>

      {/* Animation Controls */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={animationType === 'idle' && isAnimating ? 'default' : 'outline'}
            className="glass"
            onClick={() => handleStartAnimation('idle')}
            disabled={isAnimating && animationType === 'idle'}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Repos
          </Button>
          <Button
            variant={animationType === 'talking' && isAnimating ? 'default' : 'outline'}
            className="glass"
            onClick={() => handleStartAnimation('talking')}
            disabled={isAnimating && animationType === 'talking'}
          >
            <Play className="w-4 h-4 mr-2" />
            Parole
          </Button>
          <Button
            variant={animationType === 'listening' && isAnimating ? 'default' : 'outline'}
            className="glass"
            onClick={() => handleStartAnimation('listening')}
            disabled={isAnimating && animationType === 'listening'}
          >
            <Volume2 className="w-4 h-4 mr-2" />
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
        <h4 className="font-semibold text-accent">États d'animation disponibles:</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Repos:</strong> Avatar immobile en attente</li>
          <li><strong>Parole:</strong> Mouvements dynamiques simulant la parole</li>
          <li><strong>Écoute:</strong> Léger balancement, avatar attentif</li>
        </ul>
      </div>

      {/* Technical Details */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Détails techniques:</h4>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Avatar: {config.selectedAvatar || 'Non sélectionné'}</p>
          <p>• Image: {config.customAvatarImage && config.customAvatarImage.trim() !== '' ? 'Personnalisée' : 'Par défaut'}</p>
          <p>• État: {isAnimating ? `Animation ${animationType} active` : 'Inactif'}</p>
          <p>• FPS: ~20 (50ms par frame)</p>
          <p>• Durée: 5 secondes par animation</p>
        </div>
      </div>
    </Card>
  );
};

export default AvatarAnimationTest;
