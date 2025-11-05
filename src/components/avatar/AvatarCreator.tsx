import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Loader2, Download, Video, Image } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const AvatarCreator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [generatedVideo, setGeneratedVideo] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  const generateAvatar = async (type: 'image' | 'video') => {
    if (!prompt.trim()) {
      toast.error('Veuillez entrer une description');
      return;
    }

    setIsGenerating(true);
    setGeneratedImage('');
    setGeneratedVideo('');

    try {
      const { data, error } = await supabase.functions.invoke('generate-avatar', {
        body: {
          prompt: prompt.trim(),
          type
        }
      });

      if (error) throw error;

      if (type === 'image' && data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success('Image générée avec succès! 🎨');
      } else if (type === 'video') {
        setGeneratedImage(data.imageUrl);
        if (data.videoUrl) {
          setGeneratedVideo(data.videoUrl);
          toast.success('Vidéo générée avec succès! 🎬');
        } else if (data.warning) {
          toast.warning(data.warning);
        }
      }
    } catch (error) {
      console.error('Error generating avatar:', error);
      toast.error('Erreur lors de la génération');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadMedia = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Téléchargement démarré!');
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Générateur d'Avatar IA</h2>
        <p className="text-muted-foreground mt-2">
          Décrivez votre avatar et générez une image ou une vidéo courte
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'image' | 'video')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="image">
            <Image className="w-4 h-4 mr-2" />
            Image
          </TabsTrigger>
          <TabsTrigger value="video">
            <Video className="w-4 h-4 mr-2" />
            Vidéo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="image" className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Description de l'avatar
              </label>
              <Textarea
                placeholder="Ex: Une femme souriante avec des cheveux longs bruns, arrière-plan neutre, éclairage professionnel..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <Button
              onClick={() => generateAvatar('image')}
              disabled={!prompt.trim() || isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Générer l'image
                </>
              )}
            </Button>

            {generatedImage && (
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/50">
                  <img 
                    src={generatedImage} 
                    alt="Avatar généré" 
                    className="w-full rounded-lg"
                  />
                </div>
                <Button
                  onClick={() => downloadMedia(generatedImage, `avatar-${Date.now()}.png`)}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger l'image
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="video" className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Description de l'avatar
              </label>
              <Textarea
                placeholder="Ex: Un homme d'affaires confiant avec un costume, regard professionnel, expression dynamique..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                La vidéo sera une courte animation (2-3 secondes) avec des mouvements subtils
              </p>
            </div>

            <Button
              onClick={() => generateAvatar('video')}
              disabled={!prompt.trim() || isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Générer la vidéo
                </>
              )}
            </Button>

            {(generatedImage || generatedVideo) && (
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-muted/50">
                  {generatedVideo ? (
                    <video 
                      src={generatedVideo} 
                      controls
                      autoPlay
                      loop
                      className="w-full rounded-lg"
                    />
                  ) : generatedImage ? (
                    <img 
                      src={generatedImage} 
                      alt="Avatar généré" 
                      className="w-full rounded-lg"
                    />
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {generatedImage && (
                    <Button
                      onClick={() => downloadMedia(generatedImage, `avatar-${Date.now()}.png`)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Image
                    </Button>
                  )}
                  {generatedVideo && (
                    <Button
                      onClick={() => downloadMedia(generatedVideo, `avatar-${Date.now()}.mp4`)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Vidéo
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
