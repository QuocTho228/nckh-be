# ============================================================
# DURIAN AI SERVER — FIXED TO MATCH TRAINING CODE 100%
# EfficientNet-B3 (384px) / EfficientNet-B4 (480px) / ResNet-50 (224px)
# ============================================================

# ── Cài đặt ──────────────────────────────────────────────────
import subprocess, sys
subprocess.run([sys.executable, "-m", "pip", "install",
                "fastapi", "uvicorn", "python-multipart",
                "pyngrok", "timm", "--quiet"], check=True)
print("Thư viện đã cài xong!")

# ── Mount Drive ───────────────────────────────────────────────
from google.colab import drive
drive.mount("/content/drive", force_remount=False)

# ── Import ────────────────────────────────────────────────────
import torch, timm, io, numpy as np
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
import cv2

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {DEVICE}")

# ── Config lớp ───────────────────────────────────────────────
CLASS_NAMES    = ["Unripe", "Semi-ripe", "Ripe", "Overripe"]
CLASS_NAMES_VI = ["Chưa chín", "Gần chín", "Đã chín", "Quá chín"]
CLASS_COLORS   = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444"]
CLASS_ICONS    = ["fas fa-seedling", "fas fa-leaf",
                  "fas fa-check-circle", "fas fa-exclamation-triangle"]
NUM_CLASSES    = len(CLASS_NAMES)

# ── Đường dẫn model ───────────────────────────────────────────
BASE = "/content/drive/MyDrive/CT551 - Luận văn tốt nghiệp - HTTT/TRAINING RESULTS V2"

MODEL_CONFIGS = {
    "efficientnet_b3": {
        "path": f"{BASE}/efficientnet_b3_run5✓/efficientnet_b3_run5_best.pth",
        "arch": "efficientnet_b3",
        "img_size": 384,       # Config.IMG_SIZE trong training B3
        "use_threshold": True, # preprocess_image threshold filter
        "wrapper": True,       # dùng DurianClassifier wrapper (backbone + classifier)
    },
    "efficientnet_b4": {
        "path": f"{BASE}/efficientnet_b4_run3/efficientnet_b4_run3_best.pth",
        "arch": "efficientnet_b4",
        "img_size": 480,       # Config.IMG_SIZE trong training B4
        "use_threshold": True,
        "wrapper": True,
    },
    "resnet50": {
        "path": f"{BASE}/resnet50_run2✓/resnet50_run2_best.pth",
        "arch": "resnet50",
        "img_size": 224,       # Config.IMG_SIZE trong training ResNet50
        "use_threshold": False, # ResNet50 KHÔNG dùng threshold filter
        "wrapper": False,      # dùng timm trực tiếp với drop_rate
    },
}

# ============================================================
# KIẾN TRÚC MODEL — KHỚP 100% VỚI TRAINING
# ============================================================

# ── DurianClassifier: dùng cho EfficientNet-B3 và B4 ─────────
# Khớp với class DurianClassifier trong file training B3/B4:
#   backbone = timm.create_model(arch, pretrained=False, num_classes=0, global_pool='')
#   classifier = Sequential(AdaptiveAvgPool2d(1), Flatten, Dropout,
#                            Linear(feature_dim→512), BN1d(512), ReLU, Dropout,
#                            Linear(512→num_classes))
class DurianClassifier(nn.Module):
    def __init__(self, model_name: str, num_classes: int = 4, dropout: float = 0.5):
        super().__init__()
        self.backbone = timm.create_model(
            model_name, pretrained=False, num_classes=0, global_pool=""
        )
        # Lấy feature_dim bằng forward pass dummy — khớp với training
        with torch.no_grad():
            img_size = 384 if "b3" in model_name else 480
            dummy = torch.randn(1, 3, img_size, img_size)
            feat = self.backbone(dummy)
            feature_dim = feat.shape[1]

        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Dropout(dropout),
            nn.Linear(feature_dim, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(512, num_classes),
        )

    def forward(self, x):
        features = self.backbone(x)
        return self.classifier(features)


# ── ResNet50Classifier: dùng cho ResNet-50 ───────────────────
# Khớp với class DurianClassifier trong file training ResNet50:
#   timm.create_model('resnet50', pretrained=True, num_classes=4, drop_rate=dropout)
# Không có wrapper thêm.
class ResNet50Classifier(nn.Module):
    def __init__(self, num_classes: int = 4, dropout: float = 0.3):
        super().__init__()
        self.backbone = timm.create_model(
            "resnet50", pretrained=False,
            num_classes=num_classes, drop_rate=dropout
        )

    def forward(self, x):
        return self.backbone(x)


# ============================================================
# LOAD MODEL — XỬ LÝ CHECKPOINT
# ============================================================

def remove_compile_prefix(state_dict: dict) -> dict:
    """Xóa prefix '_orig_mod.' từ torch.compile (ResNet50 trainer dùng torch.compile)"""
    return {k.replace("_orig_mod.", ""): v for k, v in state_dict.items()}


def load_efficientnet(arch: str, path: str) -> nn.Module:
    """
    Load EfficientNet-B3 / B4.
    Checkpoint lưu bởi: torch.save({'model_state_dict': model.state_dict(), ...})
    model là DurianClassifier → keys: backbone.*, classifier.*
    """
    raw = torch.load(path, map_location=DEVICE)

    # Unwrap checkpoint wrapper
    if isinstance(raw, dict) and "model_state_dict" in raw:
        state_dict = raw["model_state_dict"]
    elif isinstance(raw, dict) and "state_dict" in raw:
        state_dict = raw["state_dict"]
    else:
        state_dict = raw

    model = DurianClassifier(model_name=arch, num_classes=NUM_CLASSES, dropout=0.5)

    missing, unexpected = model.load_state_dict(state_dict, strict=False)

    critical_missing = [k for k in missing if "num_batches_tracked" not in k]
    if critical_missing:
        print(f"   {arch}: {len(critical_missing)} keys thiếu: {critical_missing[:3]}")
    if unexpected:
        print(f"   {arch}: {len(unexpected)} keys thừa: {unexpected[:3]}")

    model.to(DEVICE).eval()
    return model


def load_resnet50(path: str) -> nn.Module:
    """
    Load ResNet-50.
    Checkpoint lưu bởi: torch.save({'model_state_dict': state_dict_to_save, ...})
    state_dict_to_save đã được clean qua remove_compile_prefix() khi save.
    model là ResNet50Classifier (timm trực tiếp, không wrapper backbone/classifier).
    """
    raw = torch.load(path, map_location=DEVICE)

    if isinstance(raw, dict) and "model_state_dict" in raw:
        state_dict = raw["model_state_dict"]
    elif isinstance(raw, dict) and "state_dict" in raw:
        state_dict = raw["state_dict"]
    else:
        state_dict = raw

    # Phòng trường hợp prefix _orig_mod. chưa được clean
    state_dict = remove_compile_prefix(state_dict)

    model = ResNet50Classifier(num_classes=NUM_CLASSES, dropout=0.3)

    missing, unexpected = model.load_state_dict(state_dict, strict=False)

    critical_missing = [k for k in missing if "num_batches_tracked" not in k]
    if critical_missing:
        print(f"   resnet50: {len(critical_missing)} keys thiếu: {critical_missing[:3]}")

    model.to(DEVICE).eval()
    return model


MODELS = {}
for key, cfg in MODEL_CONFIGS.items():
    print(f"⏳ Đang load {key} ...")
    try:
        if cfg["wrapper"]:
            MODELS[key] = load_efficientnet(cfg["arch"], cfg["path"])
        else:
            MODELS[key] = load_resnet50(cfg["path"])
        print(f"   {key} — OK")
    except Exception as e:
        print(f"   {key} — LỖI: {e}")

DEFAULT_MODEL = "efficientnet_b4"
print(f"\nĐã load {len(MODELS)}/{len(MODEL_CONFIGS)} model!")


# ============================================================
# PREPROCESSING — KHỚP 100% VỚI TRAINING
# ============================================================

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

# Threshold filter — chỉ dùng cho EfficientNet (training B3/B4):
#   gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
#   _, mask = cv2.threshold(gray, 120, 255, cv2.THRESH_TOZERO)
#   result[mask == 0] = 0
def threshold_based_filter(image_np: np.ndarray,
                            lower: int = 120,
                            upper: int = 255) -> np.ndarray:
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    _, mask = cv2.threshold(gray, lower, upper, cv2.THRESH_TOZERO)
    result = image_np.copy()
    result[mask == 0] = 0
    return result


def preprocess(image_bytes: bytes, img_size: int, use_threshold: bool) -> torch.Tensor:
    """
    Khớp với get_valid_transforms trong training:
      - EfficientNet: Resize → [threshold filter] → Normalize(ImageNet)
      - ResNet50: Resize → Normalize(ImageNet)  (không threshold)
    Training dùng albumentations + INTER_LANCZOS4 (B3/B4) / INTER_LINEAR (ResNet50).
    Ở đây dùng PIL LANCZOS/BILINEAR — kết quả tương đương khi inference.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Resize
    resample = Image.LANCZOS if use_threshold else Image.BILINEAR
    img = img.resize((img_size, img_size), resample)

    # Threshold filter (chỉ EfficientNet)
    if use_threshold:
        img_np = np.array(img)
        img_np = threshold_based_filter(img_np)
        img = Image.fromarray(img_np)

    # Normalize → Tensor
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])
    return transform(img).unsqueeze(0).to(DEVICE)


# ============================================================
# FASTAPI
# ============================================================
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

app = FastAPI(title="Durian Ripeness API — Multi-Model")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


class NgrokBypassMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        if request.method == "OPTIONS":
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "ngrok-skip-browser-warning": "true",
                },
            )
        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["ngrok-skip-browser-warning"] = "true"
        return response


app.add_middleware(NgrokBypassMiddleware)


@app.get("/")
def root():
    return {"status": "ok", "models_loaded": list(MODELS.keys())}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "device": DEVICE,
        "models": list(MODELS.keys()),
    }


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    model: str = Query(
        default=DEFAULT_MODEL,
        description="Model: efficientnet_b3 | efficientnet_b4 | resnet50",
    ),
):
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp", "image/bmp"}
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, detail="Chỉ hỗ trợ JPG, PNG, WEBP, BMP")

    if model not in MODELS:
        raise HTTPException(
            400,
            detail=f"Model '{model}' không tồn tại. Chọn: {list(MODELS.keys())}",
        )

    try:
        cfg = MODEL_CONFIGS[model]
        image_bytes = await file.read()

        tensor = preprocess(
            image_bytes,
            img_size=cfg["img_size"],
            use_threshold=cfg["use_threshold"],
        )

        net = MODELS[model]
        with torch.no_grad():
            logits = net(tensor)
            probs = F.softmax(logits, dim=1).squeeze().cpu().numpy()

        pred_idx   = int(np.argmax(probs))
        confidence = float(probs[pred_idx])

        all_probs = [
            {
                "class_en":    CLASS_NAMES[i],
                "class_vi":    CLASS_NAMES_VI[i],
                "probability": round(float(probs[i]) * 100, 2),
                "color":       CLASS_COLORS[i],
                "icon":        CLASS_ICONS[i],
            }
            for i in range(NUM_CLASSES)
        ]
        all_probs.sort(key=lambda x: x["probability"], reverse=True)

        return JSONResponse({
            "success":            True,
            "model_used":         model,
            "predicted_class":    CLASS_NAMES[pred_idx],
            "predicted_class_vi": CLASS_NAMES_VI[pred_idx],
            "confidence":         round(confidence * 100, 2),
            "color":              CLASS_COLORS[pred_idx],
            "icon":               CLASS_ICONS[pred_idx],
            "all_probabilities":  all_probs,
        })

    except Exception as e:
        raise HTTPException(500, detail=f"Lỗi xử lý ảnh: {str(e)}")


# ── Khởi động server + ngrok ──────────────────────────────────
import asyncio, threading, time, requests
from pyngrok import ngrok
import uvicorn

NGROK_AUTH_TOKEN = "34YhGU8di5QWPnBDQSovq0SeRMO_2EfQTz4oQRcFFRXbA8xKE"
PORT = 8000

ngrok.set_auth_token(NGROK_AUTH_TOKEN)


def run_server():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    config = uvicorn.Config(
        app, host="0.0.0.0", port=PORT, log_level="error", loop="asyncio"
    )
    server = uvicorn.Server(config)
    loop.run_until_complete(server.serve())


thread = threading.Thread(target=run_server, daemon=True)
thread.start()
time.sleep(2)

ngrok.kill()
tunnel = ngrok.connect(PORT, bind_tls=True)
public_url = tunnel.public_url

print("=" * 60)
print("SERVER ĐÃ CHẠY THÀNH CÔNG!")
print("=" * 60)
print(f"🌐 Public URL: {public_url}")
print()
print("HƯỚNG DẪN:")
print(f"   Mở file durian-ai.js trong project của bạn")
print(f"   Tìm dòng: const COLAB_API_URL = ...")
print(f'   Thay bằng: const COLAB_API_URL = "{public_url}";')
print("=" * 60)
print("Giữ tab Colab này mở. URL hết hạn khi đóng Colab.")
print("=" * 60)

# Health check
time.sleep(1)
try:
    r = requests.get(f"{public_url}/health", timeout=10)
    print(f"\nHealth check OK: {r.json()}")
except Exception as e:
    print(f"\nHealth check lỗi: {e}")
    print("   Thử chạy lại cell này một lần nữa.")