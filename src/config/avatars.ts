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
}

export const PRESET_AVATARS: AvatarConfig[] = [
  {
    id: "amy",
    name: "Amy",
    description: "Professional Woman",
    image: avatarAmy,
  },
  {
    id: "john",
    name: "John",
    description: "Business Man",
    image: avatarJohn,
  },
  {
    id: "sophia",
    name: "Sophia",
    description: "Young Professional",
    image: avatarSophia,
  },
  {
    id: "marcus",
    name: "Marcus",
    description: "Tech Expert",
    image: avatarMarcus,
  },
  {
    id: "clara",
    name: "Clara",
    description: "Default Avatar",
    image: claraAvatar,
  },
];

export const getAvatarById = (id: string): AvatarConfig | undefined => {
  return PRESET_AVATARS.find((avatar) => avatar.id === id);
};

export const getAvatarImage = (id: string): string => {
  const avatar = getAvatarById(id);
  return avatar?.image || claraAvatar;
};
