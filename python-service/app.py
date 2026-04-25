"""
外来物种哨兵 — Python 识别微服务

提供 HTTP API 供 Node.js 网关调用图片识别。
支持 mock 模式（默认）和可选的 PyTorch 深度模型。

启动方式:
  python app.py              # 开发模式 (Flask 内置 server, http://localhost:5100)
  gunicorn app:app           # 生产模式

Docker:
  docker build -t invasive-species-python .
  docker run -p 5100:5100 invasive-species-python
"""

import base64
import json
import os
import random
import sys
import traceback
from io import BytesIO

from flask import Flask, jsonify, request
from PIL import Image

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
USE_PYTORCH = os.getenv("USE_PYTORCH", "0") == "1"
PYTORCH_MODEL_PATH = os.getenv("PYTORCH_MODEL_PATH", "")
MAX_IMAGE_SIZE = (800, 800)

# ---------------------------------------------------------------------------
# Optional PyTorch model loader
# ---------------------------------------------------------------------------
_model = None
_class_names = []


def load_pytorch_model():
    """Load a PyTorch ResNet model for feature extraction / classification.
    Falls back silently if PyTorch is not installed or the model file is missing.
    """
    global _model, _class_names
    if not USE_PYTORCH or not PYTORCH_MODEL_PATH:
        return False

    try:
        import torch
        import torch.nn as nn
        import torchvision.models as models
        import torchvision.transforms as transforms

        device = "cuda" if torch.cuda.is_available() else "cpu"

        # Load a pretrained ResNet18, replace final layer for our species
        _model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        num_features = _model.fc.in_features
        # Default: 20 species classes; replace final FC layer
        _model.fc = nn.Linear(num_features, 20)
        _model = _model.to(device)
        _model.eval()

        _class_names = [f"species-{str(i+1).zfill(3)}" for i in range(20)]

        # If a fine-tuned checkpoint exists, load it
        if os.path.isfile(PYTORCH_MODEL_PATH):
            _model.load_state_dict(torch.load(PYTORCH_MODEL_PATH, map_location=device))
            print(f"[python-service] Loaded checkpoint from {PYTORCH_MODEL_PATH}")

        print(f"[python-service] PyTorch model loaded on {device}")
        return True
    except Exception as exc:
        print(f"[python-service] PyTorch load skipped: {exc}")
        return False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def build_species_map(species_list):
    """Convert species list ({id, chineseName, latinName, category, riskLevel})
    into a lookup dict."""
    return {s["id"]: s for s in species_list}


def preprocess_image(image_bytes, mime_type):
    """Open, validate, and resize image. Returns a PIL Image or None."""
    try:
        img = Image.open(BytesIO(image_bytes))
        img.thumbnail(MAX_IMAGE_SIZE, Image.LANCZOS)
        if img.mode != "RGB":
            img = img.convert("RGB")
        return img
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Mock recognizer (always available)
# ---------------------------------------------------------------------------

def recognize_mock(image_pil, species_map, species_list):
    """Fallback recognizer: picks random species with low confidence.
    Mirrors the Node.js mock provider logic."""
    if not species_list:
        return {
            "matchedSpeciesId": "",
            "matchedSpeciesName": "",
            "confidence": 0,
            "summary": "无法识别：物种列表为空",
            "topCandidates": []
        }

    shuffled = list(species_list)
    random.shuffle(shuffled)
    num_candidates = min(1 + random.randint(0, 2), len(shuffled))
    candidates = shuffled[:num_candidates]
    main_candidate = candidates[0]
    confidence = round(0.3 + random.random() * 0.3, 4)

    top_candidates = []
    for idx, sp in enumerate(candidates):
        top_candidates.append({
            "speciesId": sp["id"],
            "speciesName": sp["chineseName"],
            "confidence": round(confidence * (0.8 - idx * 0.2), 4)
        })

    return {
        "matchedSpeciesId": main_candidate["id"],
        "matchedSpeciesName": main_candidate["chineseName"],
        "confidence": confidence,
        "summary": f"模拟识别结果：可能为{main_candidate['chineseName']}，置信度较低，请人工审核。",
        "topCandidates": top_candidates
    }


# ---------------------------------------------------------------------------
# PyTorch-based recognizer (optional)
# ---------------------------------------------------------------------------

def recognize_pytorch(image_pil, species_map, species_list):
    """Use PyTorch ResNet to classify the image."""
    import torch
    import torchvision.transforms as transforms

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225])
    ])

    input_tensor = transform(image_pil).unsqueeze(0)
    device = next(_model.parameters()).device
    input_tensor = input_tensor.to(device)

    with torch.no_grad():
        outputs = _model(input_tensor)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)

    top_probs, top_indices = torch.topk(probabilities, min(3, len(probabilities)))
    top_probs = top_probs.tolist()
    top_indices = top_indices.tolist()

    top_candidates = []
    for i in range(len(top_probs)):
        idx = top_indices[i]
        if idx < len(_class_names) and idx < len(species_list):
            sp = species_list[idx]
            top_candidates.append({
                "speciesId": sp["id"],
                "speciesName": sp["chineseName"],
                "confidence": round(top_probs[i], 4)
            })

    if top_candidates:
        main = top_candidates[0]
        return {
            "matchedSpeciesId": main["speciesId"],
            "matchedSpeciesName": main["speciesName"],
            "confidence": main["confidence"],
            "summary": f"PyTorch 识别结果：{main['speciesName']}（置信度 {main['confidence']:.1%}）",
            "topCandidates": top_candidates[:3]
        }

    return recognize_mock(image_pil, species_map, species_list)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "invasive-species-python",
        "pytorch_available": _model is not None
    })


@app.route("/recognize", methods=["POST"])
def recognize():
    """Main recognition endpoint.

    Accepts two formats:
      1. JSON: { "image_base64": "...", "mime_type": "image/jpeg", "species_list": [...] }
      2. multipart/form-data: image file + species_list JSON string

    Returns: JSON with { matchedSpeciesId, matchedSpeciesName, confidence, summary, topCandidates }
    """
    image_bytes = None
    mime_type = "image/jpeg"
    species_list = []

    # --- Try JSON body first (Node.js provider) ---
    data = request.get_json(force=True, silent=True) or {}
    if data.get("image_base64"):
        b64 = data["image_base64"]
        if b64:
            try:
                image_bytes = base64.b64decode(b64)
            except Exception:
                return jsonify({"error": "Invalid image_base64"}), 400
        mime_type = data.get("mime_type", "image/jpeg")
        species_list = data.get("species_list", [])
        if not isinstance(species_list, list):
            return jsonify({"error": "species_list must be an array"}), 400

    # --- Try multipart form (direct upload) ---
    if image_bytes is None and "image" in request.files:
        file = request.files["image"]
        image_bytes = file.read()
        mime_type = file.content_type or "image/jpeg"
        species_list_raw = request.form.get("species_list", "[]")
        try:
            species_list = json.loads(species_list_raw)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid species_list JSON"}), 400
        if not isinstance(species_list, list):
            return jsonify({"error": "species_list must be an array"}), 400

    # --- No image found ---
    if not image_bytes:
        return jsonify({"error": "Missing image (send as image_base64 in JSON or image file in multipart)"}), 400

    species_map = build_species_map(species_list)

    # 3. Preprocess image
    mime_type = file.content_type or "image/jpeg"
    image_pil = preprocess_image(image_bytes, mime_type)
    if image_pil is None:
        return jsonify({"error": "Cannot decode image"}), 400

    # 4. Run recognition
    try:
        if _model is not None:
            result = recognize_pytorch(image_pil, species_map, species_list)
        else:
            result = recognize_mock(image_pil, species_map, species_list)

        return jsonify(result)
    except Exception as exc:
        traceback.print_exc()
        return jsonify({"error": f"Recognition failed: {str(exc)}"}), 500


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    load_pytorch_model()
    port = int(os.getenv("PORT", "5100"))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
