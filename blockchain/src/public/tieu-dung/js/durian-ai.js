/**
 * durian-ai.js  —  Phân loại độ chín sầu riêng bằng AI
 * Theme: Light & Clean — nền trắng xanh nhạt, viền mỏng, chữ tối
 */

const COLAB_API_URL = "https://triphibious-precondyloid-norma.ngrok-free.dev"; // ← THAY URL NGROK

(function () {
  "use strict";

  let stream = null;
  let isServerOnline = false;
  let selectedFile = null;

  const CLASSES = {
    Unripe: {
      vi: "Chưa chín",
      icon: "fas fa-seedling",
      color: "#1d4ed8",
      bar: "#3b82f6",
      light: "#eff6ff",
      border: "#bfdbfe",
    },
    "Semi-ripe": {
      vi: "Sắp chín",
      icon: "fas fa-leaf",
      color: "#b45309",
      bar: "#f59e0b",
      light: "#fffbeb",
      border: "#fde68a",
    },
    Ripe: {
      vi: "Đã chín",
      icon: "fas fa-check-circle",
      color: "#15803d",
      bar: "#22c55e",
      light: "#f0fdf4",
      border: "#bbf7d0",
    },
    Overripe: {
      vi: "Quá chín",
      icon: "fas fa-exclamation-triangle",
      color: "#b91c1c",
      bar: "#ef4444",
      light: "#fef2f2",
      border: "#fecaca",
    },
  };

  // ================================================================
  // CSS
  // ================================================================
  function injectCSS() {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');

      /* ── Wrapper section ── */
      #ai-phan-loai {
        background: linear-gradient(135deg, #f8fff9 0%, #e8f5e9 100%);
        padding: 64px 0 72px;
        border-top: 1px solid #d1fae5;
        border-bottom: 1px solid #d1fae5;
        border-radius: 20px;
      }

      #ai-phan-loai *:not(i):not([class*="fa"]) { font-family: 'Be Vietnam Pro', sans-serif; }
      #ai-phan-loai * { box-sizing: border-box; }

      /* ── Header ── */
      .ai-hd { text-align: center; margin-bottom: 44px; }

      .ai-hd-eyebrow {
        display: inline-flex; align-items: center; gap: 7px;
        background: #fff; border: 1px solid #bbf7d0;
        color: #15803d; font-size: .72rem; font-weight: 700;
        letter-spacing: .1em; text-transform: uppercase;
        padding: 5px 16px; border-radius: 999px; margin-bottom: 18px;
      }
      .ai-hd-eyebrow-dot {
        width: 6px; height: 6px; border-radius: 50%; background: #22c55e;
        animation: aiPulse 1.5s ease-in-out infinite;
      }
      @keyframes aiPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.65)} }

      .ai-hd h2 {
        font-size: clamp(1.6rem, 3.5vw, 2.4rem);
        font-weight: 800; color: #14532d; margin: 0 0 10px; line-height: 1.2;
      }
      .ai-hd h2 span { color: #16a34a; }
      .ai-hd p { color: #6b7280; font-size: .95rem; margin: 0 auto 22px; max-width: 440px; line-height: 1.65; }

      /* Status */
      .ai-pill {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 6px 18px; border-radius: 999px; font-size: .8rem; font-weight: 600;
        border: 1px solid transparent; transition: all .3s;
      }
      .ai-pill-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      .pill-c { background: #f9fafb; border-color: #e5e7eb; color: #9ca3af; }
      .pill-c .ai-pill-dot { background: #d1d5db; animation: aiPulse 1.2s infinite; }
      .pill-ok { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
      .pill-ok .ai-pill-dot { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,.5); }
      .pill-off { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
      .pill-off .ai-pill-dot { background: #ef4444; }

      /* ── Main card ── */
      .ai-card {
        background: #fff;
        border: 1px solid #d1fae5;
        border-radius: 20px;
        box-shadow: 0 4px 24px rgba(0,0,0,.06), 0 1px 4px rgba(0,0,0,.04);
        overflow: hidden;
      }

      /* ── Tabs ── */
      .ai-tabs { display: flex; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
      .ai-tab {
        flex: 1; padding: 15px 10px; background: transparent; border: none;
        color: #9ca3af; font-size: .85rem; font-weight: 600; cursor: pointer;
        transition: all .2s; position: relative;
      }
      .ai-tab i { margin-right: 7px; }
      .ai-tab.on { color: #15803d; background: #fff; }
      .ai-tab.on::after {
        content: ''; position: absolute; bottom: -1px; left: 16px; right: 16px;
        height: 2px; background: #16a34a; border-radius: 2px;
      }
      .ai-tab:hover:not(.on) { color: #374151; background: #f3f4f6; }

      /* ── 2-col inner ── */
      .ai-body { display: grid; grid-template-columns: 1fr 1fr; }
      @media (max-width: 767px) { .ai-body { grid-template-columns: 1fr; } }

      .ai-col-l { padding: 28px 28px 28px 28px; border-right: 1px solid #f0fdf4; }
      .ai-col-r { padding: 28px; }
      @media (max-width: 767px) {
        .ai-col-l { border-right: none; border-bottom: 1px solid #f0fdf4; }
      }

      .ai-section-label {
        font-size: .68rem; font-weight: 700; letter-spacing: .1em;
        text-transform: uppercase; color: #9ca3af; margin-bottom: 14px;
        display: flex; align-items: center; gap: 6px;
      }
      .ai-section-label i { font-size: .75rem; }

      /* ── Dropzone ── */
      .ai-dz {
        border: 2px dashed #a7f3d0; border-radius: 14px; min-height: 248px;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; cursor: pointer; transition: all .22s;
        background: linear-gradient(135deg,#f8fff9,#f0fdf4); padding: 20px; text-align: center;
        position: relative; overflow: hidden;
      }
      .ai-dz:hover, .ai-dz.drag { border-color: #16a34a; background: #ecfdf5; transform: scale(1.008); }
      .ai-dz-icon { font-size: 2.6rem; margin-bottom: 10px; color: #a7f3d0; }
      .ai-dz-icon i { font-size: 2.6rem; color: #16a34a; }
      .ai-dz p { color: #374151; font-size: .88rem; font-weight: 700; margin: 0 0 4px; }
      .ai-dz small { color: #9ca3af; font-size: .75rem; }
      .ai-dz-preview { max-width: 100%; max-height: 230px; border-radius: 10px; object-fit: contain; display: none; }

      /* ── Camera ── */
      .ai-cam-box {
        border-radius: 14px; overflow: hidden; background: #111;
        min-height: 220px; display: flex; align-items: center;
        justify-content: center; position: relative; border: 1px solid #e5e7eb;
      }
      .ai-cam-box video { width: 100%; max-height: 250px; display: block; object-fit: cover; }
      .ai-cam-snap {
        position: absolute; inset: 0; display: flex; align-items: center;
        justify-content: center; background: rgba(0,0,0,.45);
      }
      .ai-cam-snap img { max-height: 210px; border-radius: 8px; }

      /* ── Buttons ── */
      .ai-btn {
        width: 100%; padding: 13px 18px; border-radius: 10px; border: none;
        font-size: .88rem; font-weight: 700; cursor: pointer; transition: all .18s;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        margin-top: 12px;
      }
      .ai-btn:disabled { opacity: .38; cursor: not-allowed; transform: none !important; }
      .ai-btn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); }
      .ai-btn:not(:disabled):active { transform: translateY(0); }

      .ai-btn-go {
        background: #16a34a; color: #fff;
        box-shadow: 0 2px 12px rgba(22,163,74,.28);
      }
      .ai-btn-ghost {
        background: #fff; color: #374151;
        border: 1px solid #d1d5db;
      }
      .ai-btn-ghost:hover:not(:disabled) { border-color: #9ca3af; background: #f9fafb; }
      .ai-btn-red {
        background: #fef2f2; color: #b91c1c;
        border: 1px solid #fecaca; margin-top: 8px;
      }
      .ai-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }

      /* ── Result panel ── */
      .ai-res { min-height: 320px; display: flex; flex-direction: column; justify-content: center; }

      .ai-res-empty {
        text-align: center; padding: 36px 16px;
        color: #9ca3af;
      }
      .ai-res-empty .ei { font-size: 3rem; display: block; margin-bottom: 12px; opacity: .5; color: #a7f3d0; }
      .ai-res-empty .ei i { font-size: 3rem; }
      .ai-res-empty p { font-size: .85rem; line-height: 1.65; color: #9ca3af; }

      /* Loading */
      .ai-spin-wrap { text-align: center; padding: 48px 16px; }
      .ai-spin {
        width: 48px; height: 48px; margin: 0 auto 16px;
        border: 3px solid #d1fae5; border-top-color: #16a34a;
        border-radius: 50%; animation: aiRot .75s linear infinite;
      }
      @keyframes aiRot { to { transform: rotate(360deg); } }
      .ai-spin-wrap p { font-size: .85rem; color: #6b7280; }

      /* Hero result */
      .ai-res-hero {
        border-radius: 14px; padding: 22px 18px 18px; text-align: center;
        margin-bottom: 18px; border: 1.5px solid transparent; position: relative;
      }
      .ai-res-icon { font-size: 3rem; display: block; margin-bottom: 6px; }
      .ai-res-icon i { font-size: 3rem; }
      .ai-res-name  { font-size: 1.45rem; font-weight: 800; margin: 0 0 4px; }
      .ai-res-sub   { font-size: .8rem; color: #6b7280; }
      .ai-res-pct   { font-size: 1.65rem; font-weight: 800; display: block; margin-top: 1px; }

      /* Bars */
      .ai-bars-lbl {
        font-size: .67rem; font-weight: 700; letter-spacing: .1em;
        text-transform: uppercase; color: #9ca3af; margin-bottom: 12px;
        display: flex; align-items: center; gap: 6px;
      }
      .ai-bars-lbl i { font-size: .75rem; }
      .ai-bar-row { margin-bottom: 11px; }
      .ai-bar-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
      .ai-bar-name { font-size: .82rem; font-weight: 600; color: #374151; display: flex; align-items: center; gap: 6px; }
      .ai-bar-name i { font-size: .78rem; }
      .ai-bar-val  { font-size: .8rem; font-weight: 700; }
      .ai-bar-bg   { height: 8px; border-radius: 999px; background: #f3f4f6; overflow: hidden; }
      .ai-bar-fill { height: 100%; border-radius: 999px; transition: width .65s cubic-bezier(.4,0,.2,1); }

      /* Error */
      .ai-err { text-align: center; padding: 32px 16px; }
      .ai-err .ei { font-size: 2.4rem; display: block; margin-bottom: 10px; color: #b91c1c; }
      .ai-err .ei i { font-size: 2.4rem; }
      .ai-err p { font-size: .84rem; color: #b91c1c; white-space: pre-line; line-height: 1.55; }

      /* Reset */
      .ai-reset {
        width: 100%; margin-top: 14px; padding: 10px;
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 9px;
        color: #6b7280; font-size: .8rem; font-weight: 600; cursor: pointer; transition: all .18s;
        display: flex; align-items: center; justify-content: center; gap: 6px;
      }
      .ai-reset:hover { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }

      .ai-hide { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  // ================================================================
  // HTML
  // ================================================================
  function injectHTML() {
    const sec = document.createElement("section");
    sec.id = "ai-phan-loai";
    sec.innerHTML = `
      <div class="container" style="position:relative;z-index:1">

        <!-- Header -->
        <div class="ai-hd">
          <div class="ai-hd-eyebrow">
            <span class="ai-hd-eyebrow-dot"></span>AI · EfficientNet-B4
          </div>
          <h2>Phân loại <span>độ chín</span> sầu riêng</h2>
          <p>Upload ảnh hoặc dùng camera nhận ngay kết quả</p>
          <div id="ai-pill" class="ai-pill pill-c">
            <span class="ai-pill-dot"></span>
            <span id="ai-pill-txt">Đang kiểm tra kết nối...</span>
          </div>
        </div>

        <!-- Card -->
        <div class="row justify-content-center">
          <div class="col-xl-10 col-lg-11">
            <div class="ai-card">

              <!-- Tabs -->
              <div class="ai-tabs">
                <button class="ai-tab on" id="ai-t-up" onclick="DurianAI.tab('up')">
                  <i class="fas fa-cloud-upload-alt"></i>Upload ảnh
                </button>
                <button class="ai-tab" id="ai-t-cam" onclick="DurianAI.tab('cam')">
                  <i class="fas fa-camera"></i>Camera trực tiếp
                </button>
              </div>

              <div class="ai-body">

                <!-- LEFT -->
                <div class="ai-col-l">
                  <div class="ai-section-label">
                    <i class="fas fa-file-image"></i> Ảnh đầu vào
                  </div>

                  <!-- Upload -->
                  <div id="ai-p-up">
                    <div id="ai-dz" class="ai-dz"
                         onclick="document.getElementById('ai-fi').click()"
                         ondragover="DurianAI.dov(event)"
                         ondragleave="DurianAI.dlv()"
                         ondrop="DurianAI.drp(event)">
                      <div id="ai-dz-ph">
                        <div class="ai-dz-icon"><i class="fas fa-image"></i></div>
                        <p>Kéo &amp; thả ảnh vào đây</p>
                        <small><i class="fas fa-mouse-pointer"></i> hoặc click để chọn &nbsp;·&nbsp; JPG / PNG / WEBP &nbsp;·&nbsp; tối đa 10 MB</small>
                      </div>
                      <img id="ai-prev" class="ai-dz-preview" alt="preview" />
                    </div>
                    <input type="file" id="ai-fi" accept="image/*" style="display:none"
                           onchange="DurianAI.fsel(event)" />
                    <button id="ai-b-go" class="ai-btn ai-btn-go" onclick="DurianAI.predict()" disabled>
                      <i class="fas fa-brain"></i> Phân tích ngay
                    </button>
                  </div>

                  <!-- Camera -->
                  <div id="ai-p-cam" class="ai-hide">
                    <div class="ai-cam-box">
                      <video id="ai-vid" autoplay playsinline muted></video>
                      <canvas id="ai-cv" style="display:none"></canvas>
                      <div id="ai-snov" class="ai-cam-snap" style="display:none">
                        <img id="ai-sn" alt="snapshot" />
                      </div>
                    </div>
                    <div class="ai-2col">
                      <button id="ai-b-start" class="ai-btn ai-btn-ghost" onclick="DurianAI.startCam()">
                        <i class="fas fa-video"></i> Bật camera
                      </button>
                      <button id="ai-b-cap" class="ai-btn ai-btn-go" onclick="DurianAI.capture()" disabled>
                        <i class="fas fa-camera"></i> Chụp &amp; phân tích
                      </button>
                    </div>
                    <button id="ai-b-stop" class="ai-btn ai-btn-red ai-hide" onclick="DurianAI.stopCam()">
                      <i class="fas fa-stop-circle"></i> Tắt camera
                    </button>
                  </div>
                </div>

                <!-- RIGHT -->
                <div class="ai-col-r">
                  <div class="ai-section-label">
                    <i class="fas fa-chart-bar"></i> Kết quả phân tích
                  </div>
                  <div class="ai-res" id="ai-res">

                    <div id="ai-r-empty" class="ai-res-empty">
                      <span class="ei"><i class="fas fa-leaf"></i></span>
                      <p>Chưa có kết quả.<br>Upload ảnh hoặc chụp từ camera<br>để AI phân tích độ chín.</p>
                    </div>

                    <div id="ai-r-load" class="ai-spin-wrap ai-hide">
                      <div class="ai-spin"></div>
                      <p><i class="fas fa-cog fa-spin"></i> AI đang phân tích...</p>
                    </div>

                    <div id="ai-r-ok" class="ai-hide"></div>

                    <div id="ai-r-err" class="ai-err ai-hide">
                      <span class="ei"><i class="fas fa-exclamation-triangle"></i></span>
                      <p id="ai-r-errtxt"></p>
                      <button class="ai-reset" onclick="DurianAI.reset()">
                        <i class="fas fa-undo"></i> Thử lại
                      </button>
                    </div>

                  </div>
                </div>

              </div><!-- /ai-body -->
            </div><!-- /ai-card -->
          </div>
        </div>

      </div>
    `;

    const anchor = document.querySelector(".sanpham");
    if (anchor) anchor.parentNode.insertBefore(sec, anchor);
    else document.querySelector(".container").prepend(sec);
  }

  // ================================================================
  // SERVER
  // ================================================================
  async function checkServer() {
    const pill = document.getElementById("ai-pill");
    const txt = document.getElementById("ai-pill-txt");
    if (!pill) return;
    try {
      const r = await fetch(`${COLAB_API_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        isServerOnline = true;
        pill.className = "ai-pill pill-ok";
        txt.textContent = "AI Server đang hoạt động ✓";
        return;
      }
    } catch {}
    isServerOnline = false;
    pill.className = "ai-pill pill-off";
    txt.textContent = "Server offline — Hãy chạy Colab notebook";
  }

  // ================================================================
  // UPLOAD
  // ================================================================
  function fsel(e) {
    const f = e.target.files[0];
    if (f) loadPrev(f);
  }
  function dov(e) {
    e.preventDefault();
    document.getElementById("ai-dz").classList.add("drag");
  }
  function dlv() {
    document.getElementById("ai-dz").classList.remove("drag");
  }
  function drp(e) {
    e.preventDefault();
    dlv();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) loadPrev(f);
  }
  function loadPrev(file) {
    if (file.size > 10 * 1024 * 1024) {
      alert("File quá lớn! Tối đa 10MB.");
      return;
    }
    selectedFile = file;
    const rd = new FileReader();
    rd.onload = (e) => {
      document.getElementById("ai-dz-ph").style.display = "none";
      const img = document.getElementById("ai-prev");
      img.src = e.target.result;
      img.style.display = "block";
    };
    rd.readAsDataURL(file);
    document.getElementById("ai-b-go").disabled = false;
    reset();
  }
  function predict() {
    if (selectedFile) runPredict(selectedFile);
  }

  // ================================================================
  // CAMERA
  // ================================================================
  async function startCam() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      document.getElementById("ai-vid").srcObject = stream;
      document.getElementById("ai-b-start").disabled = true;
      document.getElementById("ai-b-cap").disabled = false;
      document.getElementById("ai-b-stop").classList.remove("ai-hide");
      document.getElementById("ai-snov").style.display = "none";
    } catch (e) {
      alert("Không thể truy cập camera: " + e.message);
    }
  }
  function stopCam() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    document.getElementById("ai-vid").srcObject = null;
    document.getElementById("ai-b-start").disabled = false;
    document.getElementById("ai-b-cap").disabled = true;
    document.getElementById("ai-b-stop").classList.add("ai-hide");
  }
  function capture() {
    const v = document.getElementById("ai-vid");
    const c = document.getElementById("ai-cv");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const sn = document.getElementById("ai-sn");
    sn.src = c.toDataURL("image/jpeg", 0.9);
    document.getElementById("ai-snov").style.display = "flex";
    c.toBlob((blob) => runPredict(blob, "capture.jpg"), "image/jpeg", 0.9);
  }

  // ================================================================
  // PREDICT
  // ================================================================
  async function runPredict(file, name = "image.jpg") {
    if (!isServerOnline) {
      showErr("AI Server chưa hoạt động.\nVui lòng chạy Colab notebook trước!");
      return;
    }
    showLoad();
    try {
      const fd = new FormData();
      fd.append("file", file, name);
      const r = await fetch(`${COLAB_API_URL}/predict`, {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || `HTTP ${r.status}`);
      }
      showOk(await r.json());
    } catch (e) {
      showErr(
        e.name === "TimeoutError"
          ? "Timeout — server phản hồi quá chậm."
          : e.message,
      );
    }
  }

  function hide(...ids) {
    ids.forEach((id) => document.getElementById(id).classList.add("ai-hide"));
  }
  function show(id) {
    document.getElementById(id).classList.remove("ai-hide");
  }

  function showLoad() {
    hide("ai-r-empty", "ai-r-ok", "ai-r-err");
    show("ai-r-load");
  }
  function showErr(msg) {
    hide("ai-r-empty", "ai-r-load", "ai-r-ok");
    document.getElementById("ai-r-errtxt").textContent = msg;
    show("ai-r-err");
  }
  function reset() {
    hide("ai-r-load", "ai-r-ok", "ai-r-err");
    show("ai-r-empty");
  }

  function showOk(data) {
    hide("ai-r-load", "ai-r-empty", "ai-r-err");
    const cls = CLASSES[data.predicted_class] || CLASSES["Ripe"];

    const bars = data.all_probabilities
      .map((p) => {
        const c = CLASSES[p.class_en] || {};
        const top = p.class_en === data.predicted_class;
        return `
        <div class="ai-bar-row">
          <div class="ai-bar-top">
            <span class="ai-bar-name">
              <i class="${c.icon || "fas fa-circle"}" style="color:${c.bar}"></i>
              ${p.class_vi}${top ? '&nbsp;<i class="fas fa-caret-up" style="font-size:.65rem;color:#16a34a"></i>' : ""}
            </span>
            <span class="ai-bar-val" style="color:${c.bar}">${p.probability}%</span>
          </div>
          <div class="ai-bar-bg">
            <div class="ai-bar-fill" style="width:${p.probability}%;background:${c.bar}"></div>
          </div>
        </div>`;
      })
      .join("");

    document.getElementById("ai-r-ok").innerHTML = `
      <div class="ai-res-hero" style="background:${cls.light};border-color:${cls.border};color:${cls.color}">
        <span class="ai-res-icon"><i class="${cls.icon}" style="color:${cls.color}"></i></span>
        <div class="ai-res-name" style="color:${cls.color}">${data.predicted_class_vi}</div>
        <div class="ai-res-sub">
          Độ chính xác
          <span class="ai-res-pct" style="color:${cls.color}">${data.confidence}%</span>
        </div>
      </div>
      <div class="ai-bars-lbl">
        <i class="fas fa-chart-pie"></i> Phân phối xác suất 4 lớp
      </div>
      ${bars}
      <button class="ai-reset" onclick="
        DurianAI.reset();
        selectedFile=null;
        document.getElementById('ai-fi').value='';
        document.getElementById('ai-dz-ph').style.display='';
        document.getElementById('ai-prev').style.display='none';
        document.getElementById('ai-b-go').disabled=true;
      "><i class='fas fa-undo'></i> Phân tích ảnh khác</button>
    `;
    show("ai-r-ok");
  }

  // ================================================================
  // TABS
  // ================================================================
  function tab(t) {
    document.getElementById("ai-t-up").classList.toggle("on", t === "up");
    document.getElementById("ai-t-cam").classList.toggle("on", t === "cam");
    document.getElementById("ai-p-up").classList.toggle("ai-hide", t !== "up");
    document
      .getElementById("ai-p-cam")
      .classList.toggle("ai-hide", t !== "cam");
    if (t !== "cam" && stream) stopCam();
    reset();
  }

  // ================================================================
  // INIT
  // ================================================================
  function init() {
    injectCSS();
    injectHTML();
    checkServer();
    setInterval(checkServer, 30000);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();

  window.DurianAI = {
    tab,
    fsel,
    dov,
    dlv,
    drp,
    predict,
    startCam,
    stopCam,
    capture,
    reset,
  };
  // expose selectedFile scope fix
  window._durianSetFile = (f) => {
    selectedFile = f;
  };
})();
