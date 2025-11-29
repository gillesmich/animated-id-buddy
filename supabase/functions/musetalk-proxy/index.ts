import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { io } from "npm:socket.io-client@4.8.1";

const MUSETALK_BACKEND = 'http://51.255.153.127:8000';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convertir base64 en chunks pour éviter les problèmes mémoire
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// Transcrire l'audio avec Whisper
async function transcribeAudio(audioBase64: string): Promise<string> {
  try {
    // Nettoyer la chaîne base64 (supprimer un éventuel préfixe data:...)
    const cleanedBase64 = audioBase64.includes(',')
      ? audioBase64.split(',').pop()!.trim()
      : audioBase64.trim();

    // Décoder l'audio en utilisant un traitement par chunks pour éviter les problèmes mémoire
    const binaryAudio = processBase64Chunks(cleanedBase64);

    const formData = new FormData();
    const blob = new Blob([binaryAudio.buffer as ArrayBuffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Whisper API error:', error);
      throw new Error(`Whisper API error: ${error}`);
    }

    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426, headers: corsHeaders });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  console.log("WebSocket client connected, connecting to MuseTalk backend...");
  
  // Connect to MuseTalk backend via Socket.IO
  const backendSocket = io(MUSETALK_BACKEND, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Backend to Frontend relay
  backendSocket.on('connect', () => {
    console.log("Connected to MuseTalk backend");
    socket.send(JSON.stringify({ event: 'backend_connected', data: { status: 'connected' } }));
  });

  backendSocket.on('connected', (data: any) => {
    console.log("Backend ready:", data);
    socket.send(JSON.stringify({ event: 'connected', data }));
  });

  backendSocket.on('status', (data: any) => {
    console.log("Status update:", data);
    socket.send(JSON.stringify({ event: 'status', data }));
  });

  backendSocket.on('transcription', (data: any) => {
    console.log("Transcription received:", data);
    socket.send(JSON.stringify({ event: 'transcription', data }));
  });

  backendSocket.on('ai_response', (data: any) => {
    console.log("AI response received:", data);
    socket.send(JSON.stringify({ event: 'ai_response', data }));
  });

  backendSocket.on('chat_result', (data: any) => {
    console.log("Chat result received:", data);
    // Convert relative URL to absolute
    if (data.download_url && data.download_url.startsWith('/')) {
      data.download_url = `${MUSETALK_BACKEND}${data.download_url}`;
    }
    socket.send(JSON.stringify({ event: 'chat_result', data }));
  });

  backendSocket.on('error', (data: any) => {
    console.error("Backend error:", data);
    socket.send(JSON.stringify({ event: 'error', data }));
  });

  backendSocket.on('pong', (data: any) => {
    socket.send(JSON.stringify({ event: 'pong', data }));
  });

  backendSocket.on('disconnect', (reason: string) => {
    console.log("Backend disconnected:", reason);
    socket.send(JSON.stringify({ event: 'backend_disconnected', data: { reason } }));
  });

  // Frontend to Backend relay
  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received from frontend:", message.event);
      
      if (message.event === 'chat_with_avatar') {
        const { audio_data, ...restData } = message.data;
        
        // Transcrire l'audio avec Whisper
        console.log("Transcribing audio with Whisper...");
        socket.send(JSON.stringify({ 
          event: 'status', 
          data: { stage: 'transcription', message: 'Transcription en cours...', progress: 10 } 
        }));
        
        try {
          const transcription = await transcribeAudio(audio_data);
          console.log("Transcription:", transcription);
          
          socket.send(JSON.stringify({ 
            event: 'transcription', 
            data: { text: transcription } 
          }));
          
          // Envoyer le texte transcrit au backend au lieu de l'audio
          backendSocket.emit('chat_with_avatar', {
            ...restData,
            user_text: transcription, // Envoyer le texte au lieu de l'audio
          });
        } catch (error) {
          console.error("Transcription failed:", error);
          socket.send(JSON.stringify({ 
            event: 'error', 
            data: { message: 'Échec de la transcription audio' } 
          }));
        }
      } else if (message.event === 'ping') {
        backendSocket.emit('ping', message.data);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  };

  socket.onclose = () => {
    console.log("WebSocket client disconnected");
    backendSocket.disconnect();
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    backendSocket.disconnect();
  };

  return response;
});