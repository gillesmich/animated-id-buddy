import { ImagePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface ImageUploaderProps {
  currentImage?: string;
  onImageSelected: (imageUrl: string) => void;
}

const ImageUploader = ({ currentImage, onImageSelected }: ImageUploaderProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une image",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Créer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log("📤 Upload vers Supabase Storage:", filePath);

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error("❌ Erreur upload:", error);
        throw error;
      }

      console.log("✅ Upload réussi:", data);

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log("🔗 URL publique:", publicUrl);

      onImageSelected(publicUrl);
      
      toast({
        title: "✅ Image uploadée",
        description: "Votre avatar est maintenant accessible publiquement",
      });
    } catch (error) {
      console.error("❌ Erreur:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur d'upload",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearImage = () => {
    onImageSelected("");
  };

  return (
    <div className="space-y-2">
      {currentImage ? (
        <div className="relative">
          <img 
            src={currentImage} 
            alt="Avatar" 
            className="w-full h-48 object-cover rounded-lg"
          />
          <Button
            size="sm"
            variant="destructive"
            className="absolute top-2 right-2"
            onClick={clearImage}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <label htmlFor="image-upload" className="cursor-pointer">
          <div className="glass border-2 border-dashed border-border/50 hover:border-primary/50 rounded-lg p-6 text-center transition-colors">
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-primary animate-spin" />
                <p className="text-sm font-medium">Upload en cours...</p>
              </>
            ) : (
              <>
                <ImagePlus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Sélectionner une image</p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG ou WEBP (URL publique pour D-ID)
                </p>
              </>
            )}
          </div>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
};

export default ImageUploader;
