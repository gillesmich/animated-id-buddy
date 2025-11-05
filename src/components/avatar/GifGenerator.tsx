import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadLocalImageToStorage } from '@/utils/uploadImageToStorage';

export const GifGenerator: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedGif, setGeneratedGif] = useState<string>('');

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error loading image:', error);
      toast.error('Erreur lors du chargement de l\'image');
    }
  };

  const generateAnimation = async () => {
    if (!selectedImage) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    setIsGenerating(true);
    setGeneratedGif('');

    try {
      // Upload image to storage if it's a local file
      let imageUrl = selectedImage;
      if (selectedImage.startsWith('data:')) {
        const blob = await (await fetch(selectedImage)).blob();
        const fileName = `gif-source-${Date.now()}.jpg`;
        const filePath = `avatars/${fileName}`;

        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(data.path);

        imageUrl = publicUrlData.publicUrl;
      }

      const { data, error } = await supabase.functions.invoke('animate-image', {
        body: {
          image_url: imageUrl,
          animation_type: 'subtle'
        }
      });

      if (error) throw error;

      if (data.gifUrl) {
        setGeneratedGif(data.gifUrl);
        toast.success('GIF animé généré avec succès! 🎉');
      } else {
        throw new Error('No GIF URL returned');
      }
    } catch (error) {
      console.error('Error generating animation:', error);
      toast.error('Erreur lors de la génération du GIF');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadGif = () => {
    if (!generatedGif) return;
    
    const link = document.createElement('a');
    link.href = generatedGif;
    link.download = `animated-${Date.now()}.gif`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Téléchargement démarré!');
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Générateur de GIF Animé</h2>
      <p className="text-muted-foreground">
        Uploadez une image et générez une animation subtile au format GIF
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Image Selection */}
        <div className="space-y-4">
          <label className="block">
            <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
              {selectedImage ? (
                <img 
                  src={selectedImage} 
                  alt="Selected" 
                  className="max-h-64 mx-auto rounded-lg"
                />
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Cliquez pour sélectionner une image JPG
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </label>

          <Button
            onClick={generateAnimation}
            disabled={!selectedImage || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Génération en cours...
              </>
            ) : (
              'Générer l\'animation'
            )}
          </Button>
        </div>

        {/* Generated GIF */}
        <div className="space-y-4">
          {generatedGif ? (
            <>
              <div className="border rounded-lg p-4 bg-muted/50">
                <img 
                  src={generatedGif} 
                  alt="Generated GIF" 
                  className="w-full rounded-lg"
                />
              </div>
              <Button
                onClick={downloadGif}
                variant="outline"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger le GIF
              </Button>
            </>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center h-full flex items-center justify-center">
              <p className="text-muted-foreground">
                Le GIF animé apparaîtra ici
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
