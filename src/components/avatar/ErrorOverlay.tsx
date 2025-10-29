import { X, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorOverlayProps {
  error: {
    title: string;
    message: string;
    timestamp: Date;
  } | null;
  onClose: () => void;
}

const ErrorOverlay = ({ error, onClose }: ErrorOverlayProps) => {
  if (!error) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-md mx-4 p-6 bg-destructive/10 border-destructive">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">
              {error.title}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-foreground/80">
            {error.message}
          </p>
          
          <div className="text-xs text-muted-foreground">
            {error.timestamp.toLocaleTimeString()}
          </div>

          <div className="pt-4 flex gap-2">
            <Button 
              variant="destructive" 
              onClick={onClose}
              className="flex-1"
            >
              Fermer
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ErrorOverlay;
