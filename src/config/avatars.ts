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
  didApiUrl: string; // URL publique pour D-ID API (doit être accessible via HTTP)
}

export const PRESET_AVATARS: AvatarConfig[] = [
  {
    id: "amy",
    name: "Amy",
    description: "Professional Woman",
    image: avatarAmy,
    // URL temporaire D-ID - utilisateur peut uploader sa propre image
    didApiUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face",
  },
  {
    id: "john",
    name: "John",
    description: "Business Man",
    image: avatarJohn,
    didApiUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
  },
  {
    id: "sophia",
    name: "Sophia",
    description: "Young Professional",
    image: avatarSophia,
    didApiUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
  },
  {
    id: "marcus",
    name: "Marcus",
    description: "Tech Expert",
    image: avatarMarcus,
    didApiUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face",
  },
  {
    id: "clara",
    name: "Clara",
    description: "Default Avatar",
    image: claraAvatar,
    didApiUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face",
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
 * Obtenir l'URL publique pour l'API D-ID
 * Retourne une URL HTTP accessible publiquement
 */
export const getAvatarPublicUrl = (id: string): string => {
  const avatar = getAvatarById(id);
  return avatar?.didApiUrl || PRESET_AVATARS[0].didApiUrl;
};
