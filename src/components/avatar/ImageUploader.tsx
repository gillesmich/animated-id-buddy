import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ImageUploaderProps {
  currentImage?: string;
  onImageSelected: (imageUrl: string) => void;
}

const ImageUploader = ({ currentImage, onImageSelected }: ImageUploaderProps) => {
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      onImageSelected(imageUrl);
      toast({
        title: "Image chargée",
        description: "Votre avatar personnalisé est prêt",
      });
    };
    reader.readAsDataURL(file);
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
            <ImagePlus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Sélectionner une image</p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG ou WEBP
            </p>
          </div>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
};

export default ImageUploader;
