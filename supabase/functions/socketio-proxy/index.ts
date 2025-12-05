import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { io as SocketIOClient } from "https://esm.sh/socket.io-client@4.8.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Backend URL par défaut
const DEFAULT_BACKEND = 'http://51.255.153.127:5000';

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for WebSocket upgrade
  const upgradeHeader = req.headers.get("upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response(JSON.stringify({ 
      status: "Socket.IO Proxy ready",
      usage: "Connect via WebSocket. Add ?backend=URL to specify backend",
      defaultBackend: DEFAULT_BACKEND
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get backend URL from query param or use default
  const backendUrl = url.searchParams.get('backend') || DEFAULT_BACKEND;
  console.log(`[Proxy] Backend target: ${backendUrl}`);

  try {
    // Upgrade client connection to WebSocket
    const { socket: clientWs, response } = Deno.upgradeWebSocket(req);

    let backendSocket: any = null;

    clientWs.onopen = () => {
      console.log("[Proxy] Client WebSocket connected, connecting to backend Socket.IO...");
      
      // Connect to backend via Socket.IO client
      // Use polling first (more reliable through proxies), then upgrade to websocket
      backendSocket = SocketIOClient(backendUrl, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 30000,
        forceNew: true,
      });

      // Socket.IO events to relay - tous les événements du backend MuseTalk
      const eventsToRelay = [
        'connect', 'connected', 'disconnect', 'error',
        'status', 'transcription', 'ai_response', 'chat_result',
        'webrtc_answer', 'webrtc_ice_candidate',
        'video_frame', 'audio_chunk', 'pong',
        'avatar_set', 'voice_set', 'listening_started',
        'video_ready', 'video_url', 'video_done', 'result', 'complete', 'finished'
      ];

      backendSocket.on('connect', () => {
        console.log("[Proxy] ✅ Connected to backend Socket.IO");
        clientWs.send(JSON.stringify({ 
          type: 'socketio_event', 
          event: 'connect',
          data: { sid: backendSocket.id }
        }));
      });

      // Relay all events from backend to client
      eventsToRelay.forEach(eventName => {
        if (eventName !== 'connect') {
          backendSocket.on(eventName, (data: any) => {
            console.log(`[Proxy] Backend → Client: ${eventName}`, JSON.stringify(data).substring(0, 500));
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'socketio_event',
                event: eventName,
                data: data
              }));
            }
          });
        }
      });

      // Catch-all for any other events
      backendSocket.onAny((eventName: string, data: any) => {
        if (!eventsToRelay.includes(eventName)) {
          console.log(`[Proxy] UNKNOWN Event: ${eventName}`, JSON.stringify(data).substring(0, 500));
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'socketio_event',
              event: eventName,
              data: data
            }));
          }
        }
      });

      backendSocket.on('connect_error', (err: Error) => {
        console.error("[Proxy] Backend connection error:", err.message);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            type: 'socketio_event',
            event: 'connect_error',
            data: { message: err.message }
          }));
        }
      });
    };

    clientWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`[Proxy] Client → Backend: ${message.event || message.type}`);
        
        if (message.type === 'emit' && backendSocket?.connected) {
          // Relay Socket.IO emit from client to backend
          backendSocket.emit(message.event, message.data);
        } else if (message.event && backendSocket?.connected) {
          // Alternative format
          backendSocket.emit(message.event, message.data);
        }
      } catch (err) {
        console.error("[Proxy] Error parsing client message:", err);
      }
    };

    clientWs.onerror = (error) => {
      console.error("[Proxy] Client WebSocket error:", error);
    };

    clientWs.onclose = () => {
      console.log("[Proxy] Client disconnected");
      if (backendSocket) {
        backendSocket.disconnect();
        backendSocket = null;
      }
    };

    return response;
  } catch (error) {
    console.error("[Proxy] Error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
