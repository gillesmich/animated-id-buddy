/**
 * Utilitaires pour gérer les transitions fluides entre vidéos d'avatar
 */

export class VideoTransitionManager {
  private primaryVideo: HTMLVideoElement | null = null;
  private secondaryVideo: HTMLVideoElement | null = null;
  private isTransitioning = false;
  private idleVideoUrl: string = "";
  
  constructor(
    primaryVideo: HTMLVideoElement,
    secondaryVideo: HTMLVideoElement,
    idleVideoUrl: string
  ) {
    this.primaryVideo = primaryVideo;
    this.secondaryVideo = secondaryVideo;
    this.idleVideoUrl = idleVideoUrl;
  }

  /**
   * Joue la vidéo d'idle (sourire/attente) en boucle
   */
  async playIdle() {
    if (!this.primaryVideo) return;

    console.log("😊 Lecture vidéo idle (sourire)");
    
    // Si on a une URL de vidéo idle, l'utiliser
    if (this.idleVideoUrl) {
      this.primaryVideo.src = this.idleVideoUrl;
      this.primaryVideo.loop = true;
    }
    
    // Fondu en entrée
    this.primaryVideo.style.opacity = "0";
    await this.primaryVideo.play();
    
    await this.fadeIn(this.primaryVideo, 500);
  }

  /**
   * Transition avec fondu enchaîné vers une nouvelle vidéo
   */
  async transitionToVideo(videoUrl: string, shouldLoop: boolean = false): Promise<void> {
    if (!this.primaryVideo || !this.secondaryVideo) return;
    if (this.isTransitioning) return;

    this.isTransitioning = true;
    console.log("🎬 Transition vers nouvelle vidéo");

    try {
      // Préparer la vidéo secondaire
      this.secondaryVideo.src = videoUrl;
      this.secondaryVideo.loop = shouldLoop;
      this.secondaryVideo.style.opacity = "0";
      this.secondaryVideo.style.display = "block";
      
      // Précharger
      await this.secondaryVideo.load();
      
      // Démarrer la lecture de la vidéo secondaire
      await this.secondaryVideo.play();

      // Fondu croisé
      await Promise.all([
        this.fadeOut(this.primaryVideo, 300),
        this.fadeIn(this.secondaryVideo, 300)
      ]);

      // Échanger les vidéos
      const tempVideo = this.primaryVideo;
      this.primaryVideo = this.secondaryVideo;
      this.secondaryVideo = tempVideo;

      // Masquer l'ancienne vidéo
      this.secondaryVideo.pause();
      this.secondaryVideo.style.display = "none";

    } catch (error) {
      console.error("❌ Erreur transition:", error);
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Fondu en entrée
   */
  private fadeIn(element: HTMLVideoElement, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        element.style.opacity = progress.toString();
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      
      requestAnimationFrame(animate);
    });
  }

  /**
   * Fondu en sortie
   */
  private fadeOut(element: HTMLVideoElement, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const startOpacity = parseFloat(element.style.opacity || "1");
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        element.style.opacity = (startOpacity * (1 - progress)).toString();
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      
      requestAnimationFrame(animate);
    });
  }

  /**
   * Retour à l'idle après la fin d'une vidéo
   */
  async returnToIdle() {
    if (!this.primaryVideo) return;

    console.log("🔄 Retour à l'idle");
    
    // Attendre que la vidéo actuelle se termine
    await new Promise<void>((resolve) => {
      if (!this.primaryVideo) {
        resolve();
        return;
      }

      const handleEnded = () => {
        this.primaryVideo?.removeEventListener('ended', handleEnded);
        resolve();
      };

      if (this.primaryVideo.ended || this.primaryVideo.paused) {
        resolve();
      } else {
        this.primaryVideo.addEventListener('ended', handleEnded);
      }
    });

    // Transition vers l'idle
    if (this.idleVideoUrl) {
      await this.transitionToVideo(this.idleVideoUrl, true);
    }
  }

  /**
   * Nettoyer les ressources
   */
  cleanup() {
    if (this.primaryVideo) {
      this.primaryVideo.pause();
      this.primaryVideo.src = "";
    }
    if (this.secondaryVideo) {
      this.secondaryVideo.pause();
      this.secondaryVideo.src = "";
    }
  }
}
