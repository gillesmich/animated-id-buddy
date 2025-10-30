import avatarAmy from "@/assets/avatar-amy.jpg";
import avatarJohn from "@/assets/avatar-john.jpg";
import avatarSophia from "@/assets/avatar-sophia.jpg";
import avatarMarcus from "@/assets/avatar-marcus.jpg";
import claraAvatar from "@/assets/clara-avatar.png";

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
    id: "amy",
    name: "Amy",
    description: "Professional Woman",
    image: avatarAmy,
    didPresenterId: "amy-jcwCkr1grs", // D-ID default female presenter
  },
  {
    id: "john",
    name: "John",
    description: "Business Man",
    image: avatarJohn,
    didPresenterId: "amy-jcwCkr1grs", // Using D-ID presenter
  },
  {
    id: "sophia",
    name: "Sophia",
    description: "Young Professional",
    image: avatarSophia,
    didPresenterId: "amy-jcwCkr1grs", // Using D-ID presenter
  },
  {
    id: "marcus",
    name: "Marcus",
    description: "Tech Expert",
    image: avatarMarcus,
    didPresenterId: "amy-jcwCkr1grs", // Using D-ID presenter
  },
  {
    id: "clara",
    name: "Clara",
    description: "Default Avatar",
    image: claraAvatar,
    didPresenterId: "amy-jcwCkr1grs", // Using D-ID presenter
  },
];

export const getAvatarById = (id: string): AvatarConfig | undefined => {
  return PRESET_AVATARS.find((avatar) => avatar.id === id);
};

export const getAvatarImage = (id: string): string => {
  const avatar = getAvatarById(id);
  return avatar?.image || claraAvatar;
};

/**
 * Obtenir le presenter ID ou l'URL pour l'API D-ID
 * Préfère le presenter ID si disponible, sinon utilise l'URL
 */
export const getAvatarForDID = (id: string): { presenterId?: string; url?: string } => {
  const avatar = getAvatarById(id);
  if (!avatar) {
    return { presenterId: PRESET_AVATARS[0].didPresenterId };
  }
  return {
    presenterId: avatar.didPresenterId,
    url: avatar.didApiUrl,
  };
};
