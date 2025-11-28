import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { io } from "npm:socket.io-client@4.8.1";

const MUSETALK_BACKEND = 'http://51.255.153.127:8000';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received from frontend:", message.event);
      
      if (message.event === 'chat_with_avatar') {
        backendSocket.emit('chat_with_avatar', message.data);
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