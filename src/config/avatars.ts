import claraAvatar from '@/assets/clara-avatar.png';
import avatarAmy from '@/assets/avatar-amy.jpg';
import avatarJohn from '@/assets/avatar-john.jpg';
import avatarMarcus from '@/assets/avatar-marcus.jpg';
import avatarSophia from '@/assets/avatar-sophia.jpg';

export interface AvatarConfig {
  id: string;
  name: string;
  description: string;
  image: string;
  didPresenterId?: string; // D-ID presenter ID (preferred over URL)
  didApiUrl?: string; // URL publique pour D-ID API (doit finir par .jpg/.jpeg/.png)
}

export const PRESET_AVATARS: AvatarConfig[] = [];

export const getAvatarById = (id: string): AvatarConfig | undefined => {
  return PRESET_AVATARS.find((avatar) => avatar.id === id);
};

export const getAvatarImage = (id: string): string => {
  const avatar = getAvatarById(id);
  return avatar?.image || '';
};

/**
 * Obtenir le presenter ID ou l'URL pour l'API D-ID
 * Préfère le presenter ID si disponible, sinon utilise l'URL
 */
export const getAvatarForDID = (id: string): { presenterId?: string; url?: string } => {
  const avatar = getAvatarById(id);
  if (!avatar) {
    return {};
  }
  return {
    presenterId: avatar.didPresenterId,
    url: avatar.didApiUrl,
  };
};
