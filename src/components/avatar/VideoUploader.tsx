import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Video, Loader2 } from "lucide-react";

interface VideoUploaderProps {
  onVideoUploaded: (url: string) => void;
  currentVideo?: string;
}

const VideoUploader = ({ onVideoUploaded, currentVideo }: VideoUploaderProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(currentVideo || "");

  // Mettre à jour la preview quand currentVideo change
  useEffect(() => {
    if (currentVideo) {
      setPreviewUrl(currentVideo);
    }
  }, [currentVideo]);

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Vérifier le type de fichier (vidéo ou GIF)
      const isVideo = file.type.startsWith('video/');
      const isGif = file.type === 'image/gif';
      
      if (!isVideo && !isGif) {
        toast({
          title: "Erreur",
          description: "Veuillez sélectionner une vidéo courte ou un GIF",
          variant: "destructive",
        });
        return;
      }

      // Vérifier la taille (max 10MB recommandé pour éviter les timeouts)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast({
          title: "Fichier trop volumineux",
          description: `La vidéo ne doit pas dépasser 10MB. Taille actuelle: ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
          variant: "destructive",
        });
        return;
      }

      // Avertir si le fichier est assez gros (> 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Fichier volumineux",
          description: "L'upload peut prendre quelques secondes...",
        });
      }

      setUploading(true);

      // Générer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload vers Supabase Storage avec gestion améliorée des erreurs
      let uploadResult;
      try {
        uploadResult = await supabase.storage
          .from('avatars')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
      } catch (fetchError) {
        console.error('Erreur réseau lors de l\'upload:', fetchError);
        throw new Error('Erreur réseau : vérifiez votre connexion internet et réessayez. Si le problème persiste, le fichier est peut-être trop volumineux.');
      }

      if (uploadResult.error) {
        console.error('Erreur Supabase Storage:', uploadResult.error);
        throw new Error(`Échec de l'upload: ${uploadResult.error.message}`)
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setPreviewUrl(publicUrl);
      onVideoUploaded(publicUrl);

      toast({
        title: "Vidéo téléchargée",
        description: "Votre vidéo d'avatar a été téléchargée avec succès",
      });

    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Échec du téléchargement de la vidéo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="video-upload" className="flex items-center gap-2">
          <Video className="w-4 h-4" />
          Télécharger une vidéo d'avatar
        </Label>
        <p className="text-xs text-muted-foreground">
          Formats supportés: MP4, WebM, MOV, GIF (max 10MB recommandé)<br/>
          Pour éviter les erreurs, utilisez des vidéos courtes et compressées
        </p>
        <div className="flex gap-2">
          <Input
            id="video-upload"
            type="file"
            accept="video/mp4,video/webm,video/quicktime,image/gif"
            onChange={handleVideoUpload}
            disabled={uploading}
            className="glass"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={uploading}
            onClick={() => document.getElementById('video-upload')?.click()}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {previewUrl && (
        <div className="space-y-2">
          <Label>Aperçu</Label>
          <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted">
            {previewUrl.endsWith('.gif') ? (
              <img
                src={previewUrl}
                alt="GIF preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src={previewUrl}
                controls
                className="w-full h-full object-cover"
                preload="metadata"
              >
                Votre navigateur ne supporte pas la lecture de vidéos.
              </video>
            )}
          </div>
          <p className="text-xs text-muted-foreground break-all">
            {previewUrl}
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
