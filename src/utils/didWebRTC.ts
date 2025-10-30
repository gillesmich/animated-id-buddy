/**
 * Gestionnaire WebRTC pour D-ID Streaming API
 */

import { authenticatedFetch } from "./authenticatedFetch";

export class DIDWebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private streamId: string | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private onStatusChange: (status: string) => void;

  constructor(
    videoElement: HTMLVideoElement,
    onStatusChange: (status: string) => void
  ) {
    this.videoElement = videoElement;
    this.onStatusChange = onStatusChange;
  }

  /**
   * Créer une session de streaming WebRTC avec D-ID
   */
  async createSession(sourceImageUrl: string): Promise<void> {
    try {
      console.log("🎬 Création session WebRTC D-ID...");
      this.onStatusChange("Initialisation...");

      // 1. Créer la session
      const sessionResponse = await authenticatedFetch('did-webrtc-session', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create_session',
          data: {
            source_url: sourceImageUrl
          }
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error(`Session creation failed: ${sessionResponse.status}`);
      }

      const sessionData = await sessionResponse.json();
      this.sessionId = sessionData.id;
      this.streamId = sessionData.id;

      console.log("✅ Session créée:", this.sessionId);
      console.log("📡 Offer SDP:", sessionData.offer);

      // 2. Créer la peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: sessionData.ice_servers || [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      // 3. Gérer les événements de la peer connection
      this.setupPeerConnectionHandlers();

      // 4. Set remote description (offer from D-ID)
      const offer = new RTCSessionDescription({
        type: 'offer',
        sdp: sessionData.offer.sdp
      });
      await this.peerConnection.setRemoteDescription(offer);
      console.log("✅ Remote description set");

      // 5. Créer et envoyer la réponse (answer)
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log("✅ Answer créé:", answer.sdp);

      // 6. Envoyer l'answer à D-ID
      const sdpResponse = await authenticatedFetch('did-webrtc-session', {
        method: 'POST',
        body: JSON.stringify({
          action: 'start_stream',
          sessionId: this.sessionId,
          data: {
            sdp: answer.sdp,
            type: 'answer'
          }
        }),
      });

      if (!sdpResponse.ok) {
        throw new Error(`SDP submission failed: ${sdpResponse.status}`);
      }

      console.log("✅ SDP answer envoyé");
      
      // Attendre 500ms pour que D-ID valide la session
      console.log("⏳ Attente validation session D-ID...");
      await new Promise(resolve => setTimeout(resolve, 500));

      this.onStatusChange("Connecté");

    } catch (error) {
      console.error("❌ Erreur création session WebRTC:", error);
      this.onStatusChange("Erreur");
      throw error;
    }
  }

  /**
   * Configurer les gestionnaires d'événements de la peer connection
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Gérer les ICE candidates avec délai
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("🧊 ICE candidate:", event.candidate);
        
        // Attendre 200ms pour que le SDP soit validé
        await new Promise(resolve => setTimeout(resolve, 200));
        
        try {
          const response = await authenticatedFetch('did-webrtc-session', {
            method: 'POST',
            body: JSON.stringify({
              action: 'submit_network',
              sessionId: this.sessionId,
              data: {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex
              }
            }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ ICE candidate rejeté:", errorText);
            // Ne pas throw pour permettre aux autres candidates de passer
            return;
          }
          
          console.log("✅ ICE candidate accepté");
        } catch (error) {
          console.error("❌ Erreur envoi ICE candidate:", error);
          // Continue avec les autres candidates
        }
      }
    };

    // Gérer les tracks reçus (vidéo)
    this.peerConnection.ontrack = (event) => {
      console.log("📹 Track reçu:", event.track.kind);
      if (this.videoElement && event.streams[0]) {
        this.videoElement.srcObject = event.streams[0];
        this.videoElement.play().catch(e => {
          console.error("❌ Erreur lecture vidéo:", e);
        });
        this.onStatusChange("En cours");
      }
    };

    // Gérer les changements de statut de connexion
    this.peerConnection.onconnectionstatechange = () => {
      console.log("🔌 Connection state:", this.peerConnection?.connectionState);
      if (this.peerConnection?.connectionState === 'connected') {
        this.onStatusChange("Connecté");
      } else if (this.peerConnection?.connectionState === 'disconnected') {
        this.onStatusChange("Déconnecté");
      } else if (this.peerConnection?.connectionState === 'failed') {
        this.onStatusChange("Erreur");
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state:", this.peerConnection?.iceConnectionState);
    };
  }

  /**
   * Envoyer du texte à animer par l'avatar
   */
  async sendText(text: string, voiceId: string = 'fr-FR-DeniseNeural'): Promise<void> {
    if (!this.sessionId || !this.streamId) {
      throw new Error("Session non initialisée");
    }

    console.log("💬 Envoi texte à animer:", text);
    this.onStatusChange("Parle...");

    try {
      const response = await authenticatedFetch('did-webrtc-session', {
        method: 'POST',
        body: JSON.stringify({
          action: 'send_audio',
          streamId: this.streamId,
          sessionId: this.sessionId,
          data: {
            text,
            voice_id: voiceId
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Text submission failed: ${response.status}`);
      }

      console.log("✅ Texte envoyé");
    } catch (error) {
      console.error("❌ Erreur envoi texte:", error);
      this.onStatusChange("Erreur");
      throw error;
    }
  }

  /**
   * Nettoyer la connexion
   */
  cleanup(): void {
    console.log("🧹 Nettoyage WebRTC...");
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    
    this.sessionId = null;
    this.streamId = null;
    this.onStatusChange("Déconnecté");
  }

  /**
   * Vérifier si une session est active
   */
  isActive(): boolean {
    return this.peerConnection !== null && 
           this.peerConnection.connectionState === 'connected';
  }
}
