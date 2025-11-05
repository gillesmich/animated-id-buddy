import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fal } from "npm:@fal-ai/client@1.7.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for WebSocket upgrade
  const upgradeHeader = req.headers.get("upgrade");
  if (upgradeHeader?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const falApiKey = Deno.env.get('FAL_API_KEY');
  if (!falApiKey) {
    return new Response(JSON.stringify({ error: 'FAL_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Configure FAL client
  fal.config({ credentials: falApiKey });

  const { socket, response } = Deno.upgradeWebSocket(req);
  let falConnection: any = null;

  socket.onopen = () => {
    console.log("✅ WebSocket client connected");
    socket.send(JSON.stringify({ 
      type: 'connected',
      message: 'WebSocket connected successfully' 
    }));
  };

  socket.onmessage = async (event) => {
    try {
      const { action, data } = JSON.parse(event.data);
      console.log("📥 Received action:", action);

      if (action === 'start_realtime') {
        console.log("🚀 Starting FAL realtime connection");
        console.log("📋 Input data:", JSON.stringify(data, null, 2));

        // Create realtime connection to FAL
        falConnection = fal.realtime.connect("fal-ai/musetalk", {
          onResult: (result) => {
            console.log("✅ Received result from FAL:", result);
            socket.send(JSON.stringify({ 
              type: 'result', 
              data: result 
            }));
          },
          onError: (error) => {
            console.error("❌ FAL error:", error);
            socket.send(JSON.stringify({ 
              type: 'error', 
              error: error.message || 'Unknown error from FAL' 
            }));
          }
        });

        // Send input to FAL
        falConnection.send({
          source_video_url: data.source_url,
          audio_url: data.audio_url,
          bbox_shift: data.bbox_shift || 0
        });

        socket.send(JSON.stringify({ 
          type: 'status',
          message: 'Request sent to FAL AI' 
        }));

      } else if (action === 'disconnect') {
        console.log("🔌 Disconnecting FAL connection");
        if (falConnection) {
          falConnection.close?.();
        }
        socket.send(JSON.stringify({ 
          type: 'disconnected',
          message: 'FAL connection closed' 
        }));
      }
    } catch (error) {
      console.error("❌ Error processing message:", error);
      socket.send(JSON.stringify({ 
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  };

  socket.onclose = () => {
    console.log("🔌 WebSocket client disconnected");
    if (falConnection) {
      falConnection.close?.();
    }
  };

  socket.onerror = (error) => {
    console.error("❌ WebSocket error:", error);
  };

  return response;
});
