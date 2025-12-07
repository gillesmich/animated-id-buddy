import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const videoPath = url.searchParams.get('path') || 'video_latest.mp4';
  
  const MUSETALK_BACKEND = Deno.env.get('MUSETALK_BACKEND') || 'http://51.255.153.127:5000';
  const videoUrl = `${MUSETALK_BACKEND}/exports/${videoPath}`;
  
  console.log(`[VideoProxy] Fetching: ${videoUrl}`);
  
  try {
    // Forward range header if present (for video seeking)
    const headers: Record<string, string> = {};
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }
    
    const response = await fetch(videoUrl, { headers });
    
    if (!response.ok) {
      console.error(`[VideoProxy] Backend error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Video not found', status: response.status }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Get the video content
    const videoData = await response.arrayBuffer();
    console.log(`[VideoProxy] Video size: ${videoData.byteLength} bytes`);
    
    // Build response headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': 'video/mp4',
      'Content-Length': videoData.byteLength.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };
    
    // Forward content-range if present
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }
    
    return new Response(videoData, {
      status: response.status,
      headers: responseHeaders,
    });
    
  } catch (error: unknown) {
    console.error(`[VideoProxy] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to fetch video', details: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
