#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import requests
from pathlib import Path
import logging
from datetime import datetime
import json
import threading
import base64
from io import BytesIO
import openai
import subprocess
import shutil
from dotenv import load_dotenv
import sys
import glob
import yaml  # besoin de pyyaml

# ----------  init  ----------
load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'musetalk-secret-key-2024')
CORS(app, resources={r"/*": {"origins": "*"}})

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    max_http_buffer_size=10**8,
    logger=False,
    engineio_logger=False,
    ping_timeout=60,  # 60 seconds
    ping_interval=25  # 25 seconds
)

PUBLIC_URL      = os.getenv('PUBLIC_URL', 'https://magirl.fr').strip()
ELEVENLABS_KEY  = os.getenv('ELEVENLABS_API_KEY', '').strip()
OPENAI_API_KEY  = os.getenv('OPENAI_API_KEY', '').strip()

MUSETALK_DIR    = Path(os.getenv('MUSETALK_DIR', '/app'))
OUTPUT_DIR      = Path('outputs')
UPLOAD_DIR      = Path('uploads')
AVATARS_DIR     = Path('avatars')
AUDIO_DIR       = Path('audio_recordings')
MUSETALK_RESULTS = MUSETALK_DIR / 'results' / 'output' / 'v15'

for d in (OUTPUT_DIR, UPLOAD_DIR, AVATARS_DIR, AUDIO_DIR):
    d.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

active_connections = {}

AVAILABLE_VOICES = {
    'elevenlabs': [
        {'id': 'EXAVITQu4vr4xnSDxMaL', 'name': 'Sarah (Femme)', 'lang': 'fr'},
        {'id': '21m00Tcm4TlvDq8ikWAM', 'name': 'Rachel (Femme)', 'lang': 'en'},
        {'id': 'pNInz6obpgDQGcFmaJgB', 'name': 'Adam (Homme)', 'lang': 'en'},
        {'id': 'yoZ06aMxZJJ28mfd3POQ', 'name': 'Sam (Homme)', 'lang': 'en'},
    ],
    'openai': [
        {'id': 'alloy', 'name': 'Alloy', 'lang': 'multi'},
        {'id': 'echo', 'name': 'Echo', 'lang': 'multi'},
        {'id': 'fable', 'name': 'Fable', 'lang': 'multi'},
        {'id': 'onyx', 'name': 'Onyx', 'lang': 'multi'},
        {'id': 'nova', 'name': 'Nova', 'lang': 'multi'},
        {'id': 'shimmer', 'name': 'Shimmer', 'lang': 'multi'},
    ]
}

# ==================== WEBSOCKET HANDLERS ====================
@socketio.on('connect')
def handle_connect():
    client_id = request.sid
    logger.info("NOUVELLE CONNEXION %s", client_id)
    active_connections[client_id] = {
        'connected_at': datetime.now().isoformat(),
        'status': 'connected'
    }
    emit('connected', {
        'client_id': client_id,
        'message': 'Connexion établie',
        'timestamp': datetime.now().isoformat(),
        'available_voices': AVAILABLE_VOICES,
        'musetalk_local': True
    })

@socketio.on('disconnect')
def handle_disconnect():
    client_id = request.sid
    logger.info("DÉCONNEXION %s", client_id)
    active_connections.pop(client_id, None)

@socketio.on('chat_with_avatar')
def handle_chat_with_avatar(data):
    client_id = request.sid
    logger.info("CHAT_FROM %s", client_id)
    try:
        threading.Thread(
            target=process_chat_with_avatar_local,
            args=(
                client_id,
                data['audio_data'],
                data.get('avatar_data'),
                data.get('avatar_filename'),
                data.get('avatar_type'),
                data.get('avatar_url'),
                data.get('voice_provider', 'elevenlabs'),
                data.get('voice_id', 'EXAVITQu4vr4xnSDxMaL'),
                data.get('conversation_history', []),
                data.get('bbox_shift', 0)
            ),
            daemon=True
        ).start()
    except Exception as e:
        logger.exception("Erreur lors du traitement de chat_with_avatar")
        socketio.emit('error', {'message': f'{type(e).__name__}: {str(e)}'}, room=client_id)

def process_chat_with_avatar_local(
    client_id,
    audio_data,
    avatar_data,
    avatar_filename,
    avatar_type,
    avatar_url,
    voice_provider,
    voice_id,
    conversation_history,
    bbox_shift
):
    try:
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')

        # 1. audio utilisateur (webm/base64 -> wav)
        socketio.emit(
            'status',
            {'stage': 'saving_audio', 'message': 'Sauvegarde audio…', 'progress': 5},
            room=client_id
        )

        if audio_data.startswith('data:'):
            audio_data = audio_data.split(',')[1]
        raw = base64.b64decode(audio_data)
        audio_input_path = AUDIO_DIR / f"user_{ts}.webm"
        audio_input_path.write_bytes(raw)

        user_wav = AUDIO_DIR / f"user_{ts}.wav"
        subprocess.run(
            ['ffmpeg', '-y', '-i', str(audio_input_path), '-ar', '16000', '-ac', '1', str(user_wav)],
            check=True,
            capture_output=True,
            text=True
        )

        # 2. avatar
        socketio.emit(
            'status',
            {'stage': 'saving_avatar', 'message': 'Sauvegarde avatar…', 'progress': 10},
            room=client_id
        )

        if avatar_data:
            if avatar_data.startswith('data:'):
                avatar_data = avatar_data.split(',')[1]
            ext = avatar_filename.rsplit('.', 1)[-1] if avatar_filename and '.' in avatar_filename else 'mp4'
            avatar_path = AVATARS_DIR / f"avatar_{ts}.{ext}"
            avatar_path.write_bytes(base64.b64decode(avatar_data))
        elif avatar_url:
            avatar_path = AVATARS_DIR / f"avatar_{ts}.mp4"
            avatar_path.write_bytes(requests.get(avatar_url).content)
        else:
            raise FileNotFoundError("Aucun avatar fourni")

        # 3. Transcription
        socketio.emit(
            'status',
            {'stage': 'transcription', 'message': 'Transcription…', 'progress': 20},
            room=client_id
        )

        user_text = openai.audio.transcriptions.create(
            model="whisper-1",
            file=open(user_wav, "rb"),
            language="fr"
        ).text

        socketio.emit('transcription', {'text': user_text}, room=client_id)

        # 4. Réponse GPT
        socketio.emit(
            'status',
            {'stage': 'ai_response', 'message': 'Génération réponse…', 'progress': 35},
            room=client_id
        )

        messages = [{
            "role": "system",
            "content": (
                "Tu es un assistant virtuel sympathique et serviable. "
                "Réponds de manière naturelle et conversationnelle en français. "
                "Sois concis (2-3 phrases maximum)."
            )
        }]
        messages.extend(conversation_history[-10:])
        messages.append({"role": "user", "content": user_text})

        ai_response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=100,  # ⚡️ Optimisé: 150 → 100 pour réponses plus courtes
            temperature=0.7
        ).choices[0].message.content

        socketio.emit('ai_response', {'text': ai_response}, room=client_id)

        # 5. TTS
        socketio.emit(
            'status',
            {'stage': 'tts', 'message': 'Synthèse vocale…', 'progress': 50},
            room=client_id
        )

        tts_path = generate_tts(ai_response, voice_provider, voice_id, ts)

        tts_wav = OUTPUT_DIR / f"tts_{ts}.wav"
        # ⚡️ Conversion audio optimisée
        subprocess.run(
            [
                'ffmpeg', '-y', '-i', str(tts_path),
                '-ar', '16000',
                '-ac', '1',              # mono
                '-acodec', 'pcm_s16le',  # codec direct
                '-threads', '2',          # parallélisation
                str(tts_wav)
            ],
            check=True,
            capture_output=True,
            text=True
        )

        # 6. MuseTalk – fichiers « latest »
        socketio.emit(
            'status',
            {
                'stage': 'avatar_generation',
                'message': 'Génération vidéo avatar…',
                'progress': 65
            },
            room=client_id
        )

        latest_avatar = AVATARS_DIR / 'video_latest.mp4'
        latest_audio = OUTPUT_DIR / 'audio_latest.wav'
        shutil.copy2(avatar_path, latest_avatar)
        shutil.copy2(tts_wav, latest_audio)

        # Appel MuseTalk avec mesure de performance
        import time
        musetalk_start = time.time()
        video_url = run_musetalk_local(latest_avatar, latest_audio, bbox_shift)
        musetalk_duration = time.time() - musetalk_start
        logger.info("⏱️ Temps total génération avatar: %.2f secondes", musetalk_duration)

        # 7. renvoi au FRONT

        # On récupère le nom du fichier à partir de l'URL retournée
        out_name = Path(video_url).name

        # On reconstitue le chemin local de la vidéo dans le conteneur
        try:
            # On cherche d'abord la vidéo dans le dossier de résultats de MuseTalk
            candidates = list(MUSETALK_RESULTS.rglob(out_name))
            if candidates:
                result_video_path = candidates[-1]
            else:
                # fallback raisonnable si pas trouvé en rglob
                result_video_path = MUSETALK_RESULTS / "v15" / out_name
        except Exception:
            result_video_path = MUSETALK_RESULTS / "v15" / out_name

        # Tentative d'envoi direct vers le FRONT via SCP
        public_video_url = None
        try:
            scp_cmd = [
                "/usr/bin/scp",
                "-i", "/root/.ssh/id_rsa",
                "-o", "StrictHostKeyChecking=no",
                str(result_video_path),
                f"ubuntu@51.75.125.105:/home/ubuntu/soulmate-creator-ai/public/exports/{out_name}",
            ]
            logger.info("SCP → FRONT : %s", " ".join(scp_cmd))
            subprocess.run(scp_cmd, check=True, capture_output=True, text=True)
            public_video_url = f"https://magirl.fr/exports/{out_name}"
            logger.info("Vidéo copiée sur FRONT : %s", public_video_url)
        except Exception as scp_err:
            logger.warning("Échec SCP vers FRONT, fallback URL backend : %s", scp_err)

        # Si SCP échoue, on retombe sur l’URL servie par le back
        if not public_video_url:
            public_video_url = f"/results/output/v15/{out_name}"

        # (optionnel) copie dans OUTPUT_DIR si tu utilises encore /api/download/<filename>
        out_path = OUTPUT_DIR / out_name
        try:
            shutil.copy2(result_video_path, out_path)
        except Exception as copy_err:
            logger.warning("Impossible de copier la vidéo dans OUTPUT_DIR : %s", copy_err)
        # Statut final
        socketio.emit(
            'status',
            {
                'stage': 'complete',
                'message': 'Réponse générée !',
                'progress': 100
            },
            room=client_id
        )

        # ⚡️ ÉVÉNEMENT PRINCIPAL : on pousse la vidéo au front
        socketio.emit(
            'chat_result',
            {
                'success': True,
                'user_text': user_text,
                'ai_response': ai_response,
                'audio_url': f"/api/audio/{tts_path.name}",
                # URL utilisée pour <video src="..."> côté front
                'video_url': public_video_url,
                # Infos supplémentaires
                'local_video_path': str(result_video_path),
                'filename': out_name,
                'download_url': f"/api/download/{out_name}",
                'timestamp': datetime.now().isoformat()
            },
            room=client_id
        )
        logger.info("TRAITEMENT TERMINÉ %s", client_id)
        # 6. MuseTalk – fichiers "latest"
        # 👉 Envoi de l’URL de la vidéo au front

    except Exception as e:
        logger.exception("ERREUR TRAITEMENT")
        socketio.emit('error', {'message': f'{type(e).__name__}: {str(e)}'}, room=client_id)


# ----------  MuseTalk shell call  ----------
def run_musetalk_local(avatar_path: str, audio_path: str, bbox_shift: int = 0) -> str:
    """
    Appelle MuseTalk via scripts.inference en utilisant un fichier YAML temporaire,
    comme l'exige inference.py (aucun argument positionnel accepté).
    Retourne une URL HTTP exploitable directement par le front.
    """
    # 1. Préparer le dossier résultats
    result_dir = MUSETALK_RESULTS
    result_dir.mkdir(parents=True, exist_ok=True)
    # ⚡️ Nettoyage optimisé: supprime seulement les vidéos > 1h
    import time
    current_time = time.time()
    for old in result_dir.glob("*.mp4"):
        if (current_time - old.stat().st_mtime) > 3600:  # 1 heure
            old.unlink()
            logger.info("🗑️ Nettoyage: %s supprimé", old.name)

    # 2. Créer fichier YAML dynamique
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    cfg_path = MUSETALK_DIR / "configs" / "inference" / f"generated_{ts}.yaml"
    cfg_path.parent.mkdir(parents=True, exist_ok=True)

    config = {
        "task_0": {
            "video_path": str(Path(avatar_path)),
            "audio_path": str(Path(audio_path)),
            "bbox_shift": int(bbox_shift)
        }
    }

    with open(cfg_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(config, f)

    # 3. Commande optimisée pour inference.py
    # ⚡️ FPS 25→15 et batch_size 4→2 pour gain ~50% de vitesse
    cmd = [
        "python3",
        "-m", "scripts.inference",
        "--inference_config", str(cfg_path),
        "--result_dir", str(result_dir),
        "--unet_model_path", "models/musetalkV15/unet.pth",
        "--unet_config", "models/musetalkV15/musetalk.json",
        "--version", "v15",
        "--fps", "15",           # ⚡️ Optimisé: 25 → 15
        "--batch_size", "2",     # ⚡️ Optimisé: 4 → 2
        "--use_float16",
        "--ffmpeg_path", "/usr/bin/ffmpeg"
    ]

    logger.info("⚡️ MuseTalk cmd (optimisé): %s", " ".join(cmd))
    
    # ⏱️ Mesure du temps de génération
    import time
    start_time = time.time()

    completed = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=str(MUSETALK_DIR),
        timeout=120  # ⚡️ Timeout de 2 minutes max
    )
    
    generation_time = time.time() - start_time
    logger.info("⏱️ Temps de génération MuseTalk: %.2f secondes", generation_time)

    if completed.returncode != 0:
        logger.error("MuseTalk Error:\n%s", completed.stderr)
        raise RuntimeError(f"MuseTalk failed: {completed.stderr}")

    # 5. Chercher la vidéo générée
    mp4_files = sorted(result_dir.rglob("*.mp4"), key=lambda p: p.stat().st_mtime)
    if not mp4_files:
        raise FileNotFoundError("Aucune vidéo produite par MuseTalk")

    final_video = mp4_files[-1]

    # 🔥 On construit une URL HTTP publique vers la vidéo
    # Chemin de la vidéo vu depuis /app : /app/results/output/v15/xxx.mp4
    # On expose /results via une route Flask (voir plus bas).
    rel_path = f"output/v15/{final_video.name}"   # relatif à /results
    base = PUBLIC_URL.rstrip("/")
    public_url = f"{base}/results/{rel_path}"
    logger.info("MuseTalk vidéo générée : %s (URL: %s)", final_video, public_url)

    return public_url


# ----------  helpers  ----------
def generate_tts(text, provider, voice_id, timestamp):
    """Génère l'audio TTS avec ElevenLabs ou OpenAI"""
    if provider == 'elevenlabs' and ELEVENLABS_KEY:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        hdr = {"xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json"}
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        }
        resp = requests.post(url, json=payload, headers=hdr)
        resp.raise_for_status()
        out = OUTPUT_DIR / f"tts_elevenlabs_{timestamp}.mp3"
        out.write_bytes(resp.content)
        return out

    elif provider == 'openai' and OPENAI_API_KEY:
        out = OUTPUT_DIR / f"tts_openai_{timestamp}.mp3"
        openai.audio.speech.create(
            model="tts-1",
            voice=voice_id,
            input=text
        ).stream_to_file(out)
        return out

    else:
        raise RuntimeError("Clé / provider TTS manquant")


# ----------  routes  ----------
@app.route('/health', methods=['GET'])
def health():
    """Endpoint de santé avec diagnostics"""
    inference_script = MUSETALK_DIR / 'scripts' / 'inference.py'
    config_dir = MUSETALK_DIR / 'configs' / 'inference'

    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'connections': len(active_connections),
        'musetalk': {
            'directory': str(MUSETALK_DIR),
            'results': str(MUSETALK_RESULTS),
            'inference_script': str(inference_script),
            'inference_exists': inference_script.exists(),
            'config_dir': str(config_dir),
            'config_dir_exists': config_dir.exists()
        },
        'directories': {
            'outputs': str(OUTPUT_DIR),
            'avatars': str(AVATARS_DIR),
            'audio': str(AUDIO_DIR)
        },
        'api_keys': {
            'openai': bool(OPENAI_API_KEY),
            'elevenlabs': bool(ELEVENLABS_KEY)
        }
    })


@app.route('/api/voices', methods=['GET'])
def get_voices():
    """Liste des voix disponibles"""
    return jsonify({'success': True, 'voices': AVAILABLE_VOICES})


@app.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    """Télécharge un fichier généré"""
    file_path = OUTPUT_DIR / filename
    return send_file(file_path, as_attachment=True) if file_path.exists() else (jsonify({'error': 'File not found'}), 404)


@app.route('/api/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    """Sert un fichier audio"""
    file_path = OUTPUT_DIR / filename
    return send_file(file_path) if file_path.exists() else (jsonify({'error': 'File not found'}), 404)


@app.route("/results/<path:filename>", methods=['GET'])
def serve_results(filename):
    """
    Sert les fichiers de /app/results/
    Exemple : /results/output/v15/xxx.mp4
    """
    root = MUSETALK_DIR / "results"
    return send_from_directory(root, filename)


@app.route('/', methods=['GET'])
def root():
    """Endpoint racine"""
    return jsonify({
        "status": "ok",
        "message": "MuseTalk backend is running",
        "health_url": "/health",
        "version": "2.0-fixed"
    })


# ----------  start  ----------
if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("DÉMARRAGE MUSETALK BACKEND v2.0")
    logger.info("=" * 60)
    logger.info("OPENAI_API_KEY : %s", "✅ OK" if OPENAI_API_KEY else "❌ MANQUANTE")
    logger.info("ELEVENLABS_KEY : %s", "✅ OK" if ELEVENLABS_KEY else "❌ MANQUANTE")
    logger.info("MuseTalk DIR   : %s", MUSETALK_DIR)
    logger.info("Results DIR    : %s", MUSETALK_RESULTS)

    inference_script = MUSETALK_DIR / 'scripts' / 'inference.py'
    logger.info("inference.py   : %s", "✅ Existe" if inference_script.exists() else "❌ Manquant")

    (MUSETALK_DIR / 'configs' / 'inference').mkdir(parents=True, exist_ok=True)
    logger.info("Config DIR     : ✅ Créé")

    logger.info("=" * 60)
    logger.info("🚀 Serveur démarré sur http://0.0.0.0:8000")
    logger.info("=" * 60)

    socketio.run(app, host="0.0.0.0", port=8000, debug=False, allow_unsafe_werkzeug=True)