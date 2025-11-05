import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a local image to Supabase Storage and return the public URL
 */
export async function uploadLocalImageToStorage(imageUrl: string): Promise<string> {
  // If it's already a remote URL, return it
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }

  try {
    // Fetch the local image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    const fileName = `avatar-${Date.now()}.jpg`;
    const filePath = `avatars/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload error: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    throw error;
  }
}
