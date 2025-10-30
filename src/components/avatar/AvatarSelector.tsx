import { PRESET_AVATARS } from "@/config/avatars";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AvatarSelectorProps {
  selectedAvatar: string;
  onSelectAvatar: (avatarId: string) => void;
}

const AvatarSelector = ({ selectedAvatar, onSelectAvatar }: AvatarSelectorProps) => {
  return (
    <Card className="p-4 glass border-primary/20">
      <h3 className="text-sm font-medium mb-3">Sélectionner un avatar</h3>
      <div className="grid grid-cols-5 gap-3">
        {PRESET_AVATARS.map((avatar) => (
          <button
            key={avatar.id}
            onClick={() => onSelectAvatar(avatar.id)}
            className={cn(
              "relative rounded-lg overflow-hidden transition-all hover:scale-105",
              "border-2",
              selectedAvatar === avatar.id
                ? "border-primary shadow-lg shadow-primary/20"
                : "border-transparent hover:border-primary/50"
            )}
            title={avatar.name}
          >
            <img
              src={avatar.image}
              alt={avatar.name}
              className="w-full aspect-square object-cover"
            />
            {selectedAvatar === avatar.id && (
              <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </Card>
  );
};

export default AvatarSelector;
