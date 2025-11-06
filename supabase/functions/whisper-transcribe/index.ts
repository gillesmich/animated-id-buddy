import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
      audioBase64: z.string().min(1, 'Audio data cannot be empty').max(10000000, 'Audio file too large')
    });

    const body = await req.json();
    const validatedData = requestSchema.parse(body);
    const { audioBase64 } = validatedData;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('🎤 Whisper transcription request');

    // Handle both data URL format and raw base64
    let base64Data = audioBase64;
    if (audioBase64.includes(',')) {
      base64Data = audioBase64.split(',')[1];
    }

    // Convert base64 to binary in chunks to handle large files
    const binaryString = atob(base64Data);
    const audioData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioData[i] = binaryString.charCodeAt(i);
    }
    
    const formData = new FormData();
    formData.append('file', new Blob([audioData], { type: 'audio/webm' }), 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    // Créer un AbortController avec timeout de 60 secondes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
        signal: controller.signal,
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('⏱️ Whisper API timeout après 60 secondes');
        throw new Error('La transcription a pris trop de temps (timeout 60s). Essayez avec un audio plus court.');
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // Essayer de lire la réponse comme JSON, sinon comme texte
      let errorMessage = `Whisper API error: ${response.status}`;
      try {
        const error = await response.json();
        console.error('Whisper API error (JSON):', error);
        errorMessage = error.error?.message || JSON.stringify(error);
      } catch (jsonError) {
        const textError = await response.text();
        console.error('Whisper API error (text):', textError);
        errorMessage = textError || errorMessage;
      }
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse Whisper response as JSON:', jsonError);
      const textResponse = await response.text();
      console.error('Raw response:', textResponse);
      throw new Error(`Invalid JSON response from Whisper API: ${textResponse.substring(0, 100)}`);
    }
    
    // Filtrer les sous-titres automatiques indésirables et références Amara
    let cleanedText = data.text;
    
    // 1. Patterns de sous-titres et crédits
    const subtitlePatterns = [
      /sous[-\s]?titres?\s+réalisés?\s+(par|para|por)\s+(la\s+)?communauté\s+(d'?|de\s+)?amara\.org/gi,
      /subtítulos?\s+realizados?\s+(por|para)\s+(la\s+)?comunidad\s+de\s+amara\.org/gi,
      /subtitles?\s+(by|from|made\s+by)\s+(the\s+)?amara\.org\s+community/gi,
      /.*amara\.org.*/gi,
      /.*communauté\s+(d'?|de\s+)?amara.*/gi,
      /.*community.*amara.*/gi,
      /.*sous[-\s]?titr.*/gi,
      /.*subtítulo.*/gi,
      /.*subtitle.*/gi,
      /merci\s+(à\s+tous|beaucoup)(\s+et\s+à\s+bientôt)?[\s!.]*$/gi,
      /à\s+bientôt[\s!.]*$/gi,
    ];
    
    for (const pattern of subtitlePatterns) {
      cleanedText = cleanedText.replace(pattern, '').trim();
    }
    
    // 2. Détecter et éliminer les répétitions (phrases qui se répètent 2+ fois)
    const sentences = cleanedText.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
    const uniqueSentences: string[] = [];
    const seenSentences = new Set<string>();
    
    for (const sentence of sentences) {
      const normalized = sentence.trim().toLowerCase();
      if (!seenSentences.has(normalized)) {
        seenSentences.add(normalized);
        uniqueSentences.push(sentence.trim());
      }
    }
    
    cleanedText = uniqueSentences.join('. ');
    if (cleanedText && !cleanedText.endsWith('.') && !cleanedText.endsWith('!') && !cleanedText.endsWith('?')) {
      cleanedText += '.';
    }
    
    // 3. Nettoyer les espaces multiples
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    // 4. Filtrer les transcriptions trop courtes ou vides
    if (cleanedText.length < 3 || cleanedText === '.' || cleanedText === '!') {
      cleanedText = '';
    }
    
    console.log('✅ Whisper transcription success:', cleanedText);

    return new Response(JSON.stringify({ ...data, text: cleanedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
