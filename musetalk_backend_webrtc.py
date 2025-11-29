#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify, send_file
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import logging
import os
import traceback
import uuid
import base64
import io
import wave
import json
from datetime import datetime
import asyncio

# -------------------------------------------------------------------
# Tentative d'import de aiortc / av pour WebRTC
# -------------------------------------------------------------------
try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
    import av
    AIORTC_AVAILABLE = True
except ImportError:
    AIORTC_AVAILABLE = False

# -------------------------------------------------------------------
# Configuration du logging
# -------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger("musetalk_backend")

# -------------------------------------------------------------------
# Création de l'application Flask
# -------------------------------------------------------------------
app = Flask(__name__)

# CORS
CORS(app, resources={r"/*": {"origins": "*"}})

# SocketIO
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    max_http_buffer_size=10**8,
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25
)

# -------------------------------------------------------------------
# Configuration de base
# -------------------------------------------------------------------
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Durée max d'un fichier audio en secondes (par exemple 60 s)
MAX_AUDIO_DURATION = 60

# On lit la variable d'env PUBLIC_URL ou on utilise une valeur par défaut :
PUBLIC_URL = os.getenv('PUBLIC_URL', 'https://magirl.fr').strip()
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

logger.info("PUBLIC_URL = %s", PUBLIC_URL)

# Dictionnaire pour suivre les PeerConnections WebRTC par client Socket.IO
webrtc_peers = {}

# -------------------------------------------------------------------
# Fonctions utilitaires
# -------------------------------------------------------------------
def allowed_file(filename, allowed_extensions=None):
    """
    Vérifie si un fichier a une extension autorisée.
    """
    if allowed_extensions is None:
        allowed_extensions = {"wav", "mp3", "ogg", "m4a"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions


def generate_unique_filename(extension=".wav"):
    """
    Génère un nom de fichier unique.
    """
    return f"{uuid.uuid4().hex}{extension}"


def base64_to_wav_file(b64_data, output_path):
    """
    Décode une chaîne Base64 en WAV et l'enregistre dans un fichier.
    """
    try:
        audio_bytes = base64.b64decode(b64_data)
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav_in:
            with wave.open(output_path, "wb") as wav_out:
                wav_out.setparams(wav_in.getparams())
                wav_out.writeframes(wav_in.readframes(wav_in.getnframes()))
        return True
    except Exception as e:
        logger.error("Erreur lors de l'écriture du fichier WAV depuis le Base64 : %s", e)
        return False


def wav_duration_seconds(filepath):
    """
    Retourne la durée d'un fichier WAV en secondes.
    """
    try:
        with wave.open(filepath, "rb") as wav_file:
            frames = wav_file.getnframes()
            rate = wav_file.getframerate()
            duration = frames / float(rate)
            return duration
    except Exception as e:
        logger.error("Erreur lors du calcul de la durée du WAV : %s", e)
        return None


# -------------------------------------------------------------------
# Tracks WebRTC (audio / vidéo) côté serveur
# -------------------------------------------------------------------
if AIORTC_AVAILABLE:

    class VideoStreamTrack(MediaStreamTrack):
        """
        Track vidéo de démonstration : génère des frames vides.
        À remplacer par ta vraie source vidéo (OpenCV, ffmpeg, etc.).
        """
        kind = "video"

        def __init__(self):
            super().__init__()
            self.width = 640
            self.height = 480

        async def recv(self):
            # Petite temporisation pour respecter un framerate (~25 fps)
            await asyncio.sleep(1 / 25)

            frame = av.VideoFrame(self.width, self.height, 'rgb24')
            # Optionnel : remplir l'image avec du noir (par défaut elle est vide)
            for plane in frame.planes:
                plane.update(b'\x00' * len(plane))
            return frame


    class AudioStreamTrack(MediaStreamTrack):
        """
        Track audio de démonstration : génère du silence.
        À remplacer par ta vraie source audio (TTS, fichier, pipeline IA, etc.).
        """
        kind = "audio"

        def __init__(self):
            super().__init__()
            self.sample_rate = 48000
            self.samples_per_frame = 960  # 20 ms @ 48 kHz

        async def recv(self):
            await asyncio.sleep(self.samples_per_frame / self.sample_rate)

            frame = av.AudioFrame(format='s16', layout='mono', samples=self.samples_per_frame)
            for plane in frame.planes:
                plane.update(b'\x00' * len(plane))
            frame.sample_rate = self.sample_rate
            return frame

# -------------------------------------------------------------------
# Routes Flask
# -------------------------------------------------------------------
@app.route("/", methods=["GET"])
def index():
    """
    Route racine.
    """
    logger.info("Requête GET sur /")
    return jsonify({"status": "ok", "message": "Musetalk backend is running"}), 200


@app.route("/health", methods=["GET"])
def health():
    """
    Route de health-check.
    """
    logger.info("Requête GET sur /health")
    return jsonify({"status": "ok"}), 200


@app.route("/upload_audio", methods=["POST"])
def upload_audio():
    """
    Endpoint classique pour uploader un fichier audio (multipart/form-data).
    Non utilisé pour WebRTC, mais peut servir de test.
    """
    logger.info("Requête POST sur /upload_audio")
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier envoyé"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Aucun fichier sélectionné"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Type de fichier non supporté"}), 400

    unique_name = generate_unique_filename(".wav")
    filepath = os.path.join(UPLOAD_FOLDER, unique_name)

    try:
        file.save(filepath)
        duration = wav_duration_seconds(filepath)
        if duration is None:
            return jsonify({"error": "Impossible de calculer la durée du fichier"}), 500

        if duration > MAX_AUDIO_DURATION:
            os.remove(filepath)
            return jsonify({"error": "Fichier trop long"}), 400

        logger.info("Fichier audio %s uploadé avec succès, durée=%.2fs", unique_name, duration)
        return jsonify({"status": "ok", "filename": unique_name, "duration": duration}), 200
    except Exception as e:
        logger.error("Erreur lors de l'upload : %s", e)
        traceback.print_exc()
        return jsonify({"error": "Erreur interne lors de l'upload"}), 500


@app.route("/get_output/<filename>", methods=["GET"])
def get_output(filename):
    """
    Permet de récupérer un fichier (audio/vidéo) généré dans OUTPUT_FOLDER.
    """
    logger.info("Requête GET sur /get_output/%s", filename)
    filepath = os.path.join(OUTPUT_FOLDER, filename)
    if not os.path.isfile(filepath):
        return jsonify({"error": "Fichier introuvable"}), 404

    try:
        return send_file(filepath, as_attachment=True)
    except Exception as e:
        logger.error("Erreur lors de l'envoi du fichier : %s", e)
        return jsonify({"error": "Erreur interne lors de l'envoi du fichier"}), 500


# -------------------------------------------------------------------
# Gestion Socket.IO
# -------------------------------------------------------------------
@socketio.on("connect")
def handle_connect():
    """
    Événement Socket.IO: un client se connecte.
    """
    client_id = request.sid
    logger.info("Client connecté: %s", client_id)
    emit("server_message", {"message": "Connecté au serveur Socket.IO", "client_id": client_id})


@socketio.on("disconnect")
def handle_disconnect():
    """
    Événement Socket.IO: un client se déconnecte.
    """
    client_id = request.sid
    logger.info("Client déconnecté: %s", client_id)

    # Si une PeerConnection WebRTC existe pour ce client, on la ferme proprement
    pc = webrtc_peers.pop(client_id, None)
    if pc and AIORTC_AVAILABLE:
        logger.info("Fermeture de la PeerConnection WebRTC pour le client %s", client_id)
        try:
            asyncio.run(pc.close())
        except Exception as e:
            logger.error("Erreur lors de la fermeture de la PeerConnection: %s", e)


@socketio.on("ping_server")
def handle_ping(data):
    """
    Événement de test pour ping le serveur.
    """
    logger.info("Ping reçu: %s", data)
    emit("pong_client", {"message": "Pong depuis le serveur", "data": data})


@socketio.on("upload_audio_b64")
def handle_upload_audio_b64(data):
    """
    Événement Socket.IO pour recevoir un audio en Base64 (WAV),
    le sauvegarder, vérifier la durée, etc.
    """
    client_id = request.sid
    logger.info("Réception upload_audio_b64 de %s", client_id)

    try:
        audio_b64 = data.get("audio_base64")
        if not audio_b64:
            emit("upload_error", {"error": "Aucun audio_base64 fourni"}, room=client_id)
            return

        unique_name = generate_unique_filename(".wav")
        filepath = os.path.join(UPLOAD_FOLDER, unique_name)

        # Décodage du base64 en WAV
        success = base64_to_wav_file(audio_b64, filepath)
        if not success:
            emit("upload_error", {"error": "Impossible de décoder le fichier audio"}, room=client_id)
            return

        # Vérification de la durée
        duration = wav_duration_seconds(filepath)
        if duration is None:
            emit("upload_error", {"error": "Impossible de calculer la durée du fichier"}, room=client_id)
            return

        if duration > MAX_AUDIO_DURATION:
            os.remove(filepath)
            emit("upload_error", {"error": "Fichier trop long"}, room=client_id)
            return

        logger.info("Fichier audio %s reçu via Socket.IO (durée=%.2fs)", unique_name, duration)

        # On renvoie un événement de succès
        emit("upload_success", {
            "status": "ok",
            "filename": unique_name,
            "duration": duration
        }, room=client_id)

    except Exception as e:
        logger.error("Erreur lors de handle_upload_audio_b64: %s", e)
        traceback.print_exc()
        emit("upload_error", {"error": "Erreur interne lors du traitement de l'audio"}, room=client_id)


# -------------------------------------------------------------------
# Exemple: Chat avec avatar (placeholder)
# -------------------------------------------------------------------
@socketio.on("chat_with_avatar")
def handle_chat_with_avatar(data):
    """
    Exemple d'événement pour discuter avec un avatar.
    Cette fonction est un placeholder.
    Dans ton projet, tu pourras y intégrer la logique
    d'IA (LLM, TTS, etc.) et éventuellement la génération
    de vidéo.
    """
    client_id = request.sid
    logger.info("chat_with_avatar reçu de %s avec data=%s", client_id, data)

    try:
        user_message = data.get("message", "")
        # Placeholder : on renvoie simplement une réponse "echo".
        response_text = f"Avatar: j'ai bien reçu ton message -> {user_message}"

        # Si tu as un système de TTS (text-to-speech) ou de génération audio,
        # tu peux ici :
        #  1) Générer un fichier audio
        #  2) Le stocker dans OUTPUT_FOLDER
        #  3) Retourner l'URL publique ou un identifiant au client

        # Exemple de nom de fichier audio généré (placeholder)
        fake_audio_name = generate_unique_filename(".wav")
        fake_audio_path = os.path.join(OUTPUT_FOLDER, fake_audio_name)
        # Ici, tu pourrais écrire un vrai WAV à partir d'un TTS.
        # Par exemple, avec un TTS d'ElevenLabs ou autre.

        # Construction d'une URL publique (si PUBLIC_URL est configuré)
        # Par ex: https://magirl.fr/outputs/<fake_audio_name>
        # À adapter selon ta config Nginx / Apache / etc.
        audio_url = f"{PUBLIC_URL}/outputs/{fake_audio_name}"

        payload = {
            "text": response_text,
            "audio_file": fake_audio_name,
            "audio_url": audio_url,
        }

        emit("avatar_response", payload, room=client_id)
    except Exception as e:
        logger.error("Erreur dans chat_with_avatar: %s", e)
        traceback.print_exc()
        emit("avatar_error", {"error": "Erreur interne dans le chat avec l'avatar"}, room=client_id)


# -------------------------------------------------------------------
# Intégration potentielle avec ElevenLabs (placeholder)
# -------------------------------------------------------------------
def synthesize_speech_elevenlabs(text, voice_id="pNInz6obpgDQGcFmaJgB"):
    """
    Exemple simplifié de fonction pour synthétiser du texte en audio via ElevenLabs.
    Ici, c'est seulement un placeholder ; il faudra adapter avec la vraie API.
    """
    if not ELEVENLABS_API_KEY:
        logger.warning("Aucune ELEVENLABS_API_KEY définie, synthèse vocale désactivée.")
        return None

    # TODO: Appeler la vraie API ElevenLabs.
    # Pour le moment, cette fonction ne fait rien et renvoie None.
    logger.info("Appel synthèse vocale ElevenLabs simulé pour le texte: %s", text)
    return None


# -------------------------------------------------------------------
# Gestion WebRTC via Socket.IO
# -------------------------------------------------------------------
@socketio.on("webrtc_offer")
def handle_webrtc_offer(data):
    """
    Reçoit une offre WebRTC (SDP) du client via Socket.IO,
    crée une PeerConnection aiortc côté serveur, y attache
    des tracks audio/vidéo, et renvoie une answer.
    """
    client_id = request.sid
    logger.info("webrtc_offer reçu de %s", client_id)

    if not AIORTC_AVAILABLE:
        emit("webrtc_error", {
            "error": "aiortc/av non installés côté serveur. "
                     "Installe-les avec: pip install aiortc av"
        }, room=client_id)
        return

    offer = data.get("offer")
    if not offer:
        emit("webrtc_error", {"error": "Aucune 'offer' fournie"}, room=client_id)
        return

    async def process_offer():
        # Nouvelle PeerConnection pour ce client
        pc = RTCPeerConnection()
        webrtc_peers[client_id] = pc
        logger.info("PeerConnection créée pour le client %s", client_id)

        # Ajout des pistes vidéo / audio (démonstration)
        pc.addTrack(VideoStreamTrack())
        pc.addTrack(AudioStreamTrack())

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info("WebRTC state pour %s: %s", client_id, pc.connectionState)
            if pc.connectionState in ("failed", "closed", "disconnected"):
                logger.info("Fermeture de la PeerConnection pour %s", client_id)
                await pc.close()
                webrtc_peers.pop(client_id, None)

        # Application de l'offre du client
        desc = RTCSessionDescription(sdp=offer["sdp"], type=offer["type"])
        await pc.setRemoteDescription(desc)

        # Création de l'answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        # Retourner l'answer à envoyer au client
        return {
            "type": pc.localDescription.type,
            "sdp": pc.localDescription.sdp,
        }

    try:
        answer = asyncio.run(process_offer())
        emit("webrtc_answer", {"answer": answer}, room=client_id)
        logger.info("webrtc_answer envoyée à %s", client_id)
    except Exception as e:
        logger.error("Erreur lors du traitement de l'offre WebRTC: %s", e, exc_info=True)
        emit("webrtc_error", {"error": "Erreur interne lors du traitement de l'offre WebRTC"}, room=client_id)


@socketio.on("webrtc_close")
def handle_webrtc_close():
    """
    Permet au client de demander explicitement la fermeture
    de la PeerConnection côté serveur.
    """
    client_id = request.sid
    logger.info("webrtc_close demandé par %s", client_id)

    pc = webrtc_peers.pop(client_id, None)
    if pc and AIORTC_AVAILABLE:
        try:
            asyncio.run(pc.close())
            emit("webrtc_closed", {"status": "ok"}, room=client_id)
            logger.info("PeerConnection WebRTC fermée pour %s", client_id)
        except Exception as e:
            logger.error("Erreur lors de la fermeture de la PeerConnection: %s", e)
            emit("webrtc_error", {"error": "Erreur lors de la fermeture de la PeerConnection"}, room=client_id)
    else:
        emit("webrtc_closed", {"status": "no_peer"}, room=client_id)


# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------
if __name__ == "__main__":
    logger.info("Démarrage du serveur Flask+Socket.IO sur 0.0.0.0:8000")
    socketio.run(app, host="0.0.0.0", port=8000, debug=False, allow_unsafe_werkzeug=True)
