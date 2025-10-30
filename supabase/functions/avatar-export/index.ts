import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestSchema = z.object({
      avatarUrl: z.string().url('Invalid avatar URL').max(2000),
      voiceId: z.string().optional(),
      model: z.string().optional(),
      systemPrompt: z.string().max(2000, 'System prompt too long').optional(),
      workflows: z.array(z.any()).optional()
    });

    const body = await req.json();
    const validatedData = requestSchema.parse(body);
    const { 
      avatarUrl, 
      voiceId = "21m00Tcm4TlvDq8ikWAM",
      model = "gpt-4o-2025-04-16",
      systemPrompt = "Vous êtes un assistant virtuel sympathique et professionnel.",
      workflows = []
    } = validatedData;


    const embedCode = generateEmbedCode({
      avatarUrl,
      voiceId,
      model,
      systemPrompt,
      workflows,
      apiUrl: Deno.env.get('SUPABASE_URL') || '',
    });

    console.log("Export d'avatar généré avec succès");

    return new Response(
      JSON.stringify({ 
        embedCode,
        message: "Code d'intégration généré avec succès" 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error("Erreur lors de la génération de l'export:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function generateEmbedCode(config: {
  avatarUrl: string;
  voiceId: string;
  model: string;
  systemPrompt: string;
  workflows: any[];
  apiUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Avatar Interactif</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #avatar-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      height: 400px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      background: #fff;
      z-index: 9999;
    }
    #avatar-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    #avatar-controls {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 16px;
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
      display: flex;
      gap: 8px;
    }
    .avatar-btn {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 8px;
      background: rgba(255,255,255,0.9);
      color: #333;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .avatar-btn:hover {
      background: #fff;
      transform: translateY(-2px);
    }
    .avatar-btn:active {
      transform: translateY(0);
    }
    .avatar-btn.recording {
      background: #ef4444;
      color: white;
    }
  </style>
</head>
<body>
  <div id="avatar-container">
    <video id="avatar-video" autoplay playsinline></video>
    <div id="avatar-controls">
      <button class="avatar-btn" id="start-btn">Démarrer</button>
      <button class="avatar-btn" id="record-btn" style="display:none">Parler</button>
    </div>
  </div>

  <script>
    (function() {
      const config = ${JSON.stringify(config, null, 2)};
      
      const AvatarAI = {
        sessionId: null,
        streamId: null,
        peerConnection: null,
        isRecording: false,
        mediaRecorder: null,
        audioChunks: [],

        async init() {
          const startBtn = document.getElementById('start-btn');
          const recordBtn = document.getElementById('record-btn');
          
          startBtn.addEventListener('click', () => this.startSession());
          recordBtn.addEventListener('click', () => this.toggleRecording());
        },

        async startSession() {
          try {
            const response = await fetch(config.apiUrl + '/functions/v1/did-avatar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_url: config.avatarUrl,
                driver_url: 'bank://lively'
              })
            });

            const data = await response.json();
            this.sessionId = data.session_id;
            this.streamId = data.id;

            await this.setupWebRTC(data);

            document.getElementById('start-btn').style.display = 'none';
            document.getElementById('record-btn').style.display = 'block';
          } catch (error) {
            console.error('Erreur initialisation:', error);
            alert('Erreur lors du démarrage de l\'avatar');
          }
        },

        async setupWebRTC(streamData) {
          this.peerConnection = new RTCPeerConnection({
            iceServers: streamData.ice_servers
          });

          this.peerConnection.ontrack = (event) => {
            const video = document.getElementById('avatar-video');
            video.srcObject = event.streams[0];
          };

          const offer = new RTCSessionDescription(streamData.offer);
          await this.peerConnection.setRemoteDescription(offer);

          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);

          await fetch(config.apiUrl + '/functions/v1/did-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'sdp',
              session_id: this.sessionId,
              answer: answer
            })
          });
        },

        async toggleRecording() {
          const btn = document.getElementById('record-btn');
          
          if (!this.isRecording) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
              this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => this.processAudio();

            this.mediaRecorder.start();
            this.isRecording = true;
            btn.classList.add('recording');
            btn.textContent = 'Arrêter';
          } else {
            this.mediaRecorder.stop();
            this.isRecording = false;
            btn.classList.remove('recording');
            btn.textContent = 'Parler';
          }
        },

        async processAudio() {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          
          // Transcription
          const transcriptFormData = new FormData();
          transcriptFormData.append('audio', audioBlob);
          
          const transcriptResponse = await fetch(config.apiUrl + '/functions/v1/whisper-transcribe', {
            method: 'POST',
            body: transcriptFormData
          });
          
          const { text } = await transcriptResponse.json();
          
          // Chat
          const chatResponse = await fetch(config.apiUrl + '/functions/v1/openai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text,
              systemPrompt: config.systemPrompt,
              model: config.model
            })
          });
          
          const { response: aiResponse } = await chatResponse.json();
          
          // TTS
          const ttsResponse = await fetch(config.apiUrl + '/functions/v1/elevenlabs-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: aiResponse,
              voiceId: config.voiceId
            })
          });
          
          const { audioBase64 } = await ttsResponse.json();
          
          // Envoi à l'avatar
          await fetch(config.apiUrl + '/functions/v1/did-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'talk',
              session_id: this.sessionId,
              stream_id: this.streamId,
              audio: audioBase64
            })
          });
        }
      };

      AvatarAI.init();
    })();
  </script>
</body>
</html>`;
}
