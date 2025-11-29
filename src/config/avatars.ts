export interface AvatarConfig {
  id: string;
  name: string;
  description: string;
  image: string;
  didPresenterId?: string; // D-ID presenter ID (preferred over URL)
  didApiUrl?: string; // URL publique pour D-ID API (doit finir par .jpg/.jpeg/.png)
}

export const PRESET_AVATARS: AvatarConfig[] = [
  {
    id: 'clara',
    name: 'Clara',
    description: 'Avatar assistant virtuel',
    image: '/src/assets/clara-avatar.png',
  },
  {
    id: 'amy',
    name: 'Amy',
    description: 'Avatar professionnel',
    image: '/src/assets/avatar-amy.jpg',
  },
  {
    id: 'john',
    name: 'John',
    description: 'Avatar masculin',
    image: '/src/assets/avatar-john.jpg',
  },
  {
    id: 'marcus',
    name: 'Marcus',
    description: 'Avatar expert',
    image: '/src/assets/avatar-marcus.jpg',
  },
  {
    id: 'sophia',
    name: 'Sophia',
    description: 'Avatar consultant',
    image: '/src/assets/avatar-sophia.jpg',
  },
];

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
