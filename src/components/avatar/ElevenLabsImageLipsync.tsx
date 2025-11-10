import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import ImageUploader from "./ImageUploader";

interface ElevenLabsImageLipsyncProps {
  config: {
    customAvatarImage?: string;
    elevenlabsVoiceId?: string;
  };
  onImageSelected: (imageUrl: string) => void;
}

const ElevenLabsImageLipsync = ({ config, onImageSelected }: ElevenLabsImageLipsyncProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [animatedVideoUrl, setAnimatedVideoUrl] = useState<string | null>(null);

  const generateLipsyncVideo = async () => {
    if (!config.customAvatarImage) {
      toast.error("Veuillez d'abord uploader une image");
      return;
    }

    if (!config.elevenlabsVoiceId) {
      toast.error("Veuillez sélectionner une voix ElevenLabs");
      return;
    }

    setIsGenerating(true);
    
    try {
      toast.info("Génération de l'animation lipsync en cours...");
      
      // TODO: Implémenter l'appel à l'API ElevenLabs pour la génération
      // Pour l'instant, on simule
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Animation générée avec succès!");
      
      // Pour l'instant, on utilise l'image d'origine comme placeholder
      setAnimatedVideoUrl(config.customAvatarImage);
      
    } catch (error) {
      console.error("❌ Error generating lipsync:", error);
      toast.error("Erreur lors de la génération");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="glass border-2 border-primary/30 p-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-gradient">
            Animation Lipsync ElevenLabs
          </h3>
          <p className="text-muted-foreground">
            Uploadez une image pour créer un avatar animé
          </p>
        </div>

        {/* Image Uploader */}
        <div className="space-y-4">
          <label className="text-sm font-medium">Image de l'avatar</label>
          <ImageUploader
            currentImage={config.customAvatarImage}
            onImageSelected={onImageSelected}
          />
        </div>

        {/* Preview */}
        {config.customAvatarImage && (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20">
              {animatedVideoUrl ? (
                <video
                  src={animatedVideoUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                />
              ) : (
                <img
                  src={config.customAvatarImage}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Generate Button */}
            <Button
              onClick={generateLipsyncVideo}
              disabled={isGenerating}
              size="lg"
              className="w-full gradient-primary text-primary-foreground gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Générer l'animation lipsync
                </>
              )}
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>📸 Uploadez une photo ou image de profil</p>
          <p>🎤 Utilisez une voix ElevenLabs pour l'animation</p>
          <p>✨ Génération automatique du lipsync</p>
        </div>
      </div>
    </Card>
  );
};

export default ElevenLabsImageLipsync;