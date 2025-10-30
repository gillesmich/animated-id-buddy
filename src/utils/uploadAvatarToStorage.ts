import { supabase } from "@/integrations/supabase/client";

/**
 * Upload an avatar image to Supabase Storage and return the public URL
 */
export async function uploadAvatarToStorage(
  imageUrl: string,
  avatarId: string
): Promise<string> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const fileName = `preset-${avatarId}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true, // Overwrite if exists
      });

    if (error) throw error;

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading avatar to storage:', error);
    throw error;
  }
}

/**
 * Initialize preset avatars by uploading local images to Supabase Storage
 */
export async function initializePresetAvatars(): Promise<Record<string, string>> {
  const avatarImports = {
    amy: (await import('@/assets/avatar-amy.jpg')).default,
    john: (await import('@/assets/avatar-john.jpg')).default,
    sophia: (await import('@/assets/avatar-sophia.jpg')).default,
    marcus: (await import('@/assets/avatar-marcus.jpg')).default,
    clara: (await import('@/assets/clara-avatar.png')).default,
  };

  const uploadedUrls: Record<string, string> = {};

  for (const [id, localUrl] of Object.entries(avatarImports)) {
    try {
      const publicUrl = await uploadAvatarToStorage(localUrl, id);
      uploadedUrls[id] = publicUrl;
      console.log(`✅ Uploaded avatar ${id}:`, publicUrl);
    } catch (error) {
      console.error(`❌ Failed to upload avatar ${id}:`, error);
      // Keep local URL as fallback
      uploadedUrls[id] = localUrl;
    }
  }

  return uploadedUrls;
}
