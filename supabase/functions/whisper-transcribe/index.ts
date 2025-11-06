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
    
    // 1. Patterns de sous-titres, crédits et appels à l'action YouTube
    const subtitlePatterns = [
      // Sous-titres Amara
      /sous[-\s]?titres?\s+réalisés?\s+(par|para|por)\s+(la\s+)?communauté\s+(d'?|de\s+)?amara\.org/gi,
      /subtítulos?\s+realizados?\s+(por|para)\s+(la\s+)?comunidad\s+de\s+amara\.org/gi,
      /subtitles?\s+(by|from|made\s+by)\s+(the\s+)?amara\.org\s+community/gi,
      /.*amara\.org.*/gi,
      
      // Phrases de remerciement génériques
      /merci\s+(à\s+tous|beaucoup|pour\s+cette\s+vidéo)(\s+et\s+à\s+bientôt)?[\s!.]*$/gi,
      /à\s+bientôt[\s!.]*$/gi,
      /merci\s+d['']avoir\s+regardé[\s!.]*$/gi,
      
      // Appels à l'action YouTube/réseaux sociaux
      /n['']oubliez\s+pas\s+de\s+(vous\s+)?abonner[\s!.]*$/gi,
      /abonnez[-\s]?vous[\s!.]*$/gi,
      /like(z)?\s+(la\s+)?vidéo[\s!.]*$/gi,
      /cliquez\s+sur\s+(la\s+)?cloche[\s!.]*$/gi,
      /partagez\s+(la\s+|cette\s+)?vidéo[\s!.]*$/gi,
      /commentez\s+(en\s+)?dessous[\s!.]*$/gi,
      /suivez[-\s]?moi\s+sur[\s!.]*$/gi,
      
      // Génériques de fin
      /à\s+la\s+prochaine[\s!.]*$/gi,
      /on\s+se\s+retrouve\s+(bientôt|prochainement)[\s!.]*$/gi,
      /rendez[-\s]?vous\s+(dans\s+)?(la\s+)?prochaine\s+vidéo[\s!.]*$/gi,
    ];
    
    // 2. Filtrer les patterns
    let filteredText = cleanedText;
    for (const pattern of subtitlePatterns) {
      filteredText = filteredText.replace(pattern, '');
    }
    
    // 3. Supprimer les répétitions de phrases (détecte "voir ... voir ... voir")
    const segments = filteredText.split(/\s*\.\.\.\s*/);
    const uniqueSegments: string[] = [];
    const seenSegments = new Set<string>();
    
    for (const segment of segments) {
      const normalized = segment.trim().toLowerCase();
      // Si on a déjà vu ce segment et qu'il est court (< 20 caractères), c'est probablement une répétition
      if (normalized && normalized.length < 20 && seenSegments.has(normalized)) {
        // Arrêter dès qu'on détecte une répétition
        break;
      }
      if (normalized) {
        seenSegments.add(normalized);
        uniqueSegments.push(segment.trim());
      }
    }
    
    filteredText = uniqueSegments.join(' ').trim();
    
    // 4. Nettoyer les espaces multiples
    filteredText = filteredText.replace(/\s+/g, ' ').trim();
    
    console.log('📝 Texte nettoyé:', filteredText);
    
    // 4. Ne retourner que si le texte est significatif (> 5 caractères et pas que de la ponctuation)
    if (!filteredText || filteredText.length < 5 || /^[.,!?\s]+$/.test(filteredText)) {
      filteredText = '';
    }

    return new Response(JSON.stringify({ ...data, text: filteredText }), {
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
