-- Créer un bucket pour les avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Politique pour permettre l'upload d'avatars (public)
CREATE POLICY "Avatars publiquement téléchargeables" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Tout le monde peut uploader des avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars');