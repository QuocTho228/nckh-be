/**
 * ============================================================
 * durian-ai.js  —  Widget Phân Loại Độ Chín Sầu Riêng
 * ============================================================
 *
 * CÁCH SỬ DỤNG:
 * ------------
 * Tất cả các trang muốn nhúng widget chỉ cần:
 *
 *   1. Thêm thẻ script vào cuối trang:
 *        <script src="../shared/js/durian-ai.js"></script>
 *
 *   2. Đặt một thẻ container HTML tại vị trí muốn hiển thị:
 *        <div id="durian-ai-widget"></div>
 *
 *   3. (Tuỳ chọn) Truyền cấu hình trước khi load script:
 *        <script>
 *          window.DurianAIConfig = {
 *            containerId: "durian-ai-widget",  // default
 *            defaultModel: "efficientnet_b4",  // default
 *            showModelSelector: true,           // default
 *            compact: false,                    // true = ẩn header lớn
 *          };
 *        </script>
 *        <script src="../shared/js/durian-ai.js"></script>
 *
 * VÍ DỤ TÍCH HỢP THEO TỪNG TRANG:
 *   - trangchu.html   : container ngay sau .sanpham, compact=false
 *   - quan-ly-cay     : container cuối trang, compact=true
 *   - tao-lo-hang     : container trong bước 3 (ảnh sản phẩm), compact=true
 *   - inspector/admin : container tuỳ vị trí, showModelSelector=false
 * ============================================================
 */

(function () {
  "use strict";

  // ── Đọc config từ trang (hoặc dùng default) ──────────────
  const cfg = Object.assign(
    {
      containerId: "durian-ai-widget",
      apiUrl: "https://triphibious-precondyloid-norma.ngrok-free.dev", // ← THAY URL NGROK
      defaultModel: "efficientnet_b4",
      showModelSelector: true,
      compact: false, // true = chỉ hiện card, ẩn eyebrow + mô tả dài
    },
    window.DurianAIConfig || {},
  );

  // ── Roboflow ────────────────────────────────────────────────
  // const RF_API_KEY = "wxGFosaJU3sg7tw1zoQu";
  // const RF_MODEL = "durian-lq8ha";
  // const RF_VERSION = 1;
  // const RF_MIN_CONF = 30;

  // ── Trạng thái nội bộ ───────────────────────────────────────
  let stream = null;
  let isServerOnline = false;
  let selectedFile = null;
  let selectedModel = cfg.defaultModel;

  // ── Metadata model ─────────────────────────────────────────
  const MODELS = [
    {
      key: "efficientnet_b3",
      label: "EfficientNet-B3",
      badge: "Nhẹ · Nhanh",
      icon: "fas fa-bolt",
      color: "#0891b2",
      light: "#ecfeff",
      border: "#a5f3fc",
    },
    {
      key: "efficientnet_b4",
      label: "EfficientNet-B4",
      badge: "Cân bằng · Khuyến nghị",
      icon: "fas fa-star",
      color: "#15803d",
      light: "#f0fdf4",
      border: "#bbf7d0",
    },
    {
      key: "resnet50",
      label: "ResNet-50",
      badge: "Mạnh · Chính xác cao",
      icon: "fas fa-brain",
      color: "#7c3aed",
      light: "#faf5ff",
      border: "#ddd6fe",
    },
  ];

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
      vi: "Gần chín",
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
  // CSS — chỉ inject 1 lần dù nhiều widget trên cùng trang
  // ================================================================
  function injectCSS() {
    if (document.getElementById("durian-ai-style")) return;
    const style = document.createElement("style");
    style.id = "durian-ai-style";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');

      .dai-wrap {
        background: linear-gradient(135deg,#f8fff9 0%,#e8f5e9 100%);
        padding: 24px 0;
        border-radius: 20px;
        border-top: 1px solid #d1fae5;
        border-bottom: 1px solid #d1fae5;
      }
      .dai-wrap *:not(i):not([class*="fa"]){font-family:'Be Vietnam Pro',sans-serif}
      .dai-wrap *{box-sizing:border-box}

      /* Header (chế độ đầy đủ) */
      .dai-hd{text-align:center;margin-bottom:28px}
      .dai-eyebrow{
        display:inline-flex;align-items:center;gap:7px;
        background:#fff;border:1px solid #bbf7d0;
        color:#15803d;font-size:.72rem;font-weight:700;
        letter-spacing:.1em;text-transform:uppercase;
        padding:5px 16px;border-radius:999px;margin-bottom:14px;
      }
      .dai-eyebrow-dot{
        width:6px;height:6px;border-radius:50%;background:#22c55e;
        animation:daiPulse 1.5s ease-in-out infinite;
      }
      @keyframes daiPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.65)}}
      .dai-hd h2{font-size:clamp(1.4rem,3vw,2rem);font-weight:800;color:#14532d;margin:0 0 8px;line-height:1.2}
      .dai-hd h2 span{color:#16a34a}
      .dai-hd p{color:#6b7280;font-size:.9rem;margin:0 auto 18px;max-width:440px;line-height:1.6}

      /* Status pill */
      .dai-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 18px;border-radius:999px;font-size:.8rem;font-weight:600;border:1px solid transparent;transition:all .3s}
      .dai-pill-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
      .pill-c {background:#f9fafb;border-color:#e5e7eb;color:#9ca3af}
      .pill-c  .dai-pill-dot{background:#d1d5db;animation:daiPulse 1.2s infinite}
      .pill-ok{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}
      .pill-ok .dai-pill-dot{background:#22c55e;box-shadow:0 0 5px rgba(34,197,94,.5)}
      .pill-off{background:#fef2f2;border-color:#fecaca;color:#b91c1c}
      .pill-off .dai-pill-dot{background:#ef4444}

      /* Model selector */
      .dai-models{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:16px 0 0}
      .dai-mb{
        display:flex;flex-direction:column;align-items:center;gap:3px;
        padding:10px 14px;border-radius:12px;border:2px solid #e5e7eb;
        background:#fff;cursor:pointer;transition:all .2s;min-width:120px;text-align:center;
      }
      .dai-mb:hover{border-color:#a7f3d0;background:#f0fdf4}
      .dai-mb.active{border-color:var(--mc);background:var(--ml)}
      .dai-mb .mi{font-size:1.1rem;color:var(--mc,#9ca3af)}
      .dai-mb .ml{font-size:.8rem;font-weight:700;color:#374151}
      .dai-mb .mb{font-size:.67rem;color:#9ca3af}
      .dai-mb.active .ml{color:var(--mc)}
      .dai-mb.active .mb{color:var(--mc);opacity:.75}

      /* Card */
      .dai-card{background:#fff;border:1px solid #d1fae5;border-radius:18px;box-shadow:0 4px 24px rgba(0,0,0,.06);overflow:hidden}
      .dai-tabs{display:flex;border-bottom:1px solid #e5e7eb;background:#f9fafb}
      .dai-tab{flex:1;padding:13px 10px;background:transparent;border:none;color:#9ca3af;font-size:.83rem;font-weight:600;cursor:pointer;transition:all .2s;position:relative}
      .dai-tab i{margin-right:6px}
      .dai-tab.on{color:#15803d;background:#fff}
      .dai-tab.on::after{content:'';position:absolute;bottom:-1px;left:14px;right:14px;height:2px;background:#16a34a;border-radius:2px}
      .dai-tab:hover:not(.on){color:#374151;background:#f3f4f6}

      /* Body */
      .dai-body{display:grid;grid-template-columns:1fr 1fr}
      @media(max-width:767px){.dai-body{grid-template-columns:1fr}}
      .dai-col-l{padding:22px;border-right:1px solid #f0fdf4}
      .dai-col-r{padding:22px}
      @media(max-width:767px){.dai-col-l{border-right:none;border-bottom:1px solid #f0fdf4}}

      .dai-slbl{font-size:.67rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:12px;display:flex;align-items:center;gap:5px}
      .dai-active-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;font-size:.72rem;font-weight:700;margin-bottom:12px}

      /* Dropzone */
      .dai-dz{
        border:2px dashed #a7f3d0;border-radius:12px;min-height:220px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        cursor:pointer;transition:all .22s;
        background:linear-gradient(135deg,#f8fff9,#f0fdf4);padding:18px;text-align:center;
        position:relative;overflow:hidden;
      }
      .dai-dz:hover,.dai-dz.drag{border-color:#16a34a;background:#ecfdf5;transform:scale(1.006)}
      .dai-dz-icon i{font-size:2.3rem;color:#16a34a;margin-bottom:8px}
      .dai-dz p{color:#374151;font-size:.86rem;font-weight:700;margin:0 0 4px}
      .dai-dz small{color:#9ca3af;font-size:.73rem}
      .dai-dz-preview{max-width:100%;max-height:210px;border-radius:10px;object-fit:contain;display:none}

      /* Camera */
      .dai-cam-box{border-radius:12px;overflow:hidden;background:#111;min-height:200px;display:flex;align-items:center;justify-content:center;position:relative;border:1px solid #e5e7eb}
      .dai-cam-box video{width:100%;max-height:230px;display:block;object-fit:cover}
      .dai-cam-snap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}
      .dai-cam-snap img{max-height:200px;border-radius:8px}

      /* Buttons */
      .dai-btn{width:100%;padding:11px 16px;border-radius:9px;border:none;font-size:.86rem;font-weight:700;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px}
      .dai-btn:disabled{opacity:.38;cursor:not-allowed;transform:none!important}
      .dai-btn:not(:disabled):hover{transform:translateY(-1px);filter:brightness(1.05)}
      .dai-btn:not(:disabled):active{transform:translateY(0)}
      .dai-btn-go{background:#16a34a;color:#fff;box-shadow:0 2px 10px rgba(22,163,74,.28)}
      .dai-btn-ghost{background:#fff;color:#374151;border:1px solid #d1d5db}
      .dai-btn-ghost:hover:not(:disabled){border-color:#9ca3af;background:#f9fafb}
      .dai-btn-red{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;margin-top:7px}
      .dai-2col{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}

      /* Result */
      .dai-res{min-height:280px;display:flex;flex-direction:column;justify-content:center}
      .dai-r-empty{text-align:center;padding:32px 14px;color:#9ca3af}
      .dai-r-empty .ei{font-size:2.6rem;display:block;margin-bottom:10px;opacity:.5;color:#a7f3d0}
      .dai-r-empty p{font-size:.83rem;line-height:1.65;color:#9ca3af}
      .dai-spin-wrap{text-align:center;padding:40px 14px}
      .dai-spin{width:44px;height:44px;margin:0 auto 14px;border:3px solid #d1fae5;border-top-color:#16a34a;border-radius:50%;animation:daiRot .75s linear infinite}
      @keyframes daiRot{to{transform:rotate(360deg)}}
      .dai-spin-wrap p{font-size:.83rem;color:#6b7280}
      .dai-res-hero{border-radius:12px;padding:18px 16px 14px;text-align:center;margin-bottom:16px;border:1.5px solid transparent;position:relative}
      .dai-res-icon{font-size:2.6rem;display:block;margin-bottom:5px}
      .dai-res-icon i{font-size:2.6rem}
      .dai-res-name{font-size:1.3rem;font-weight:800;margin:0 0 3px}
      .dai-res-sub{font-size:.78rem;color:#6b7280}
      .dai-res-pct{font-size:1.5rem;font-weight:800;display:block;margin-top:1px}
      .dai-bars-lbl{font-size:.66rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:10px;display:flex;align-items:center;gap:5px}
      .dai-bar-row{margin-bottom:10px}
      .dai-bar-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}
      .dai-bar-name{font-size:.8rem;font-weight:600;color:#374151;display:flex;align-items:center;gap:5px}
      .dai-bar-name i{font-size:.75rem}
      .dai-bar-val{font-size:.78rem;font-weight:700}
      .dai-bar-bg{height:7px;border-radius:999px;background:#f3f4f6;overflow:hidden}
      .dai-bar-fill{height:100%;border-radius:999px;transition:width .65s cubic-bezier(.4,0,.2,1)}
      .dai-err{text-align:center;padding:28px 14px}
      .dai-err .ei{font-size:2.2rem;display:block;margin-bottom:8px;color:#b91c1c}
      .dai-err p{font-size:.82rem;color:#b91c1c;white-space:pre-line;line-height:1.55}
      .dai-reset{width:100%;margin-top:12px;padding:9px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;color:#6b7280;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:5px}
      .dai-reset:hover{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}
      .dai-hide{display:none!important}
    `;
    document.head.appendChild(style);
  }

  // ================================================================
  // HTML — render vào container được chỉ định
  // ================================================================
  function renderHTML(container) {
    const id = container.id || "dai-" + Math.random().toString(36).slice(2);
    // Đảm bảo container có id để các helper dùng được
    if (!container.id) container.id = id;

    // Prefix mọi id nội bộ bằng id container → hỗ trợ nhiều widget cùng trang
    const p = id + "-"; // prefix

    const modelBtns = cfg.showModelSelector
      ? MODELS.map(
          (m) => `
        <button
          class="dai-mb${m.key === selectedModel ? " active" : ""}"
          id="${p}mb-${m.key}"
          onclick="window.__DurianAI_instances['${id}'].selectModel('${m.key}')"
          style="--mc:${m.color};--ml:${m.light};--mb:${m.border}"
        >
          <span class="mi"><i class="${m.icon}"></i></span>
          <span class="ml">${m.label}</span>
          <span class="mb">${m.badge}</span>
        </button>`,
        ).join("")
      : "";

    const headerHTML = cfg.compact
      ? `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
           <div id="${p}pill" class="dai-pill pill-c">
             <span class="dai-pill-dot"></span>
             <span id="${p}pill-txt">Đang kiểm tra kết nối...</span>
           </div>
           ${cfg.showModelSelector ? `<div class="dai-models" id="${p}models" style="margin:0">${modelBtns}</div>` : ""}
         </div>`
      : `<div class="dai-hd">
           <div class="dai-eyebrow"><span class="dai-eyebrow-dot"></span>AI · Deep Learning</div>
           <h2>Phân loại độ chín sầu riêng</h2>
           <p>Upload ảnh hoặc dùng camera · Chọn model AI phù hợp</p>
           <div id="${p}pill" class="dai-pill pill-c">
             <span class="dai-pill-dot"></span>
             <span id="${p}pill-txt">Đang kiểm tra kết nối...</span>
           </div>
           ${cfg.showModelSelector ? `<div class="dai-models" id="${p}models">${modelBtns}</div>` : ""}
         </div>`;

    container.innerHTML = `
      <div class="dai-wrap">
        <div style="position:relative;z-index:1" class="${cfg.compact ? "px-2" : "container"}">
          ${headerHTML}

          <div class="${cfg.compact ? "" : "row justify-content-center"}">
            <div class="${cfg.compact ? "" : "col-xl-10 col-lg-11"}">
              <div class="dai-card">

                <div class="dai-tabs">
                  <button class="dai-tab on" id="${p}t-up"
                    onclick="window.__DurianAI_instances['${id}'].tab('up')">
                    <i class="fas fa-cloud-upload-alt"></i>Upload ảnh
                  </button>
                  <button class="dai-tab" id="${p}t-cam"
                    onclick="window.__DurianAI_instances['${id}'].tab('cam')">
                    <i class="fas fa-camera"></i>Camera
                  </button>
                </div>

                <div class="dai-body">
                  <!-- LEFT -->
                  <div class="dai-col-l">
                    <div id="${p}active-tag" class="dai-active-tag"></div>
                    <div class="dai-slbl"><i class="fas fa-file-image"></i> Ảnh đầu vào</div>

                    <!-- Upload panel -->
                    <div id="${p}p-up">
                      <div id="${p}dz" class="dai-dz"
                        onclick="document.getElementById('${p}fi').click()"
                        ondragover="window.__DurianAI_instances['${id}'].dov(event)"
                        ondragleave="window.__DurianAI_instances['${id}'].dlv()"
                        ondrop="window.__DurianAI_instances['${id}'].drp(event)">
                        <div id="${p}dz-ph">
                          <div class="dai-dz-icon"><i class="fas fa-image"></i></div>
                          <p>Kéo &amp; thả ảnh vào đây</p>
                          <small><i class="fas fa-mouse-pointer"></i> hoặc click để chọn &nbsp;·&nbsp; JPG / PNG / WEBP &nbsp;·&nbsp; tối đa 10 MB</small>
                        </div>
                        <img id="${p}prev" class="dai-dz-preview" alt="preview" />
                      </div>
                      <input type="file" id="${p}fi" accept="image/*" style="display:none"
                        onchange="window.__DurianAI_instances['${id}'].fsel(event)" />
                      <button id="${p}b-go" class="dai-btn dai-btn-go"
                        onclick="window.__DurianAI_instances['${id}'].predict()" disabled>
                        <i class="fas fa-brain"></i> Phân tích ngay
                      </button>
                    </div>

                    <!-- Camera panel -->
                    <div id="${p}p-cam" class="dai-hide">
                      <div class="dai-cam-box">
                        <video id="${p}vid" autoplay playsinline muted></video>
                        <canvas id="${p}cv" style="display:none"></canvas>
                        <div id="${p}snov" class="dai-cam-snap" style="display:none">
                          <img id="${p}sn" alt="snapshot" />
                        </div>
                      </div>
                      <div class="dai-2col">
                        <button id="${p}b-start" class="dai-btn dai-btn-ghost"
                          onclick="window.__DurianAI_instances['${id}'].startCam()">
                          <i class="fas fa-video"></i> Bật camera
                        </button>
                        <button id="${p}b-cap" class="dai-btn dai-btn-go"
                          onclick="window.__DurianAI_instances['${id}'].capture()" disabled>
                          <i class="fas fa-camera"></i> Chụp &amp; phân tích
                        </button>
                      </div>
                      <button id="${p}b-stop" class="dai-btn dai-btn-red dai-hide"
                        onclick="window.__DurianAI_instances['${id}'].stopCam()">
                        <i class="fas fa-stop-circle"></i> Tắt camera
                      </button>
                    </div>
                  </div>

                  <!-- RIGHT -->
                  <div class="dai-col-r">
                    <div class="dai-slbl"><i class="fas fa-chart-bar"></i> Kết quả phân tích</div>
                    <div class="dai-res" id="${p}res">
                      <div id="${p}r-empty" class="dai-r-empty">
                        <span class="ei"><i class="fas fa-leaf"></i></span>
                        <p>Chưa có kết quả.<br>Upload ảnh hoặc chụp từ camera<br>để AI phân tích độ chín.</p>
                      </div>
                      <div id="${p}r-load" class="dai-spin-wrap dai-hide">
                        <div class="dai-spin"></div>
                        <p id="${p}r-load-txt"><i class="fas fa-cog fa-spin"></i> AI đang phân tích...</p>
                      </div>
                      <div id="${p}r-ok" class="dai-hide"></div>
                      <div id="${p}r-err" class="dai-err dai-hide">
                        <span class="ei"><i class="fas fa-exclamation-triangle"></i></span>
                        <p id="${p}r-errtxt"></p>
                        <button class="dai-reset"
                          onclick="window.__DurianAI_instances['${id}'].reset()">
                          <i class="fas fa-undo"></i> Thử lại
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    return p; // trả về prefix để instance dùng
  }

  // ================================================================
  // INSTANCE CLASS — mỗi container có 1 instance độc lập
  // ================================================================
  class DurianAIInstance {
    constructor(containerId, instanceCfg) {
      this.containerId = containerId;
      this.cfg = instanceCfg;
      this.stream = null;
      this.isServerOnline = false;
      this.selectedFile = null;
      this.selectedModel = instanceCfg.defaultModel;

      const container = document.getElementById(containerId);
      this.p = renderHTML(container); // prefix của các id nội bộ

      this._updateActiveModelTag();
      this._checkServer();
      this._serverTimer = setInterval(() => this._checkServer(), 30000);
    }

    // ── Helpers ─────────────────────────────────────────────
    _el(suffix) {
      return document.getElementById(this.p + suffix);
    }
    _hide(...suffixes) {
      suffixes.forEach((s) => this._el(s)?.classList.add("dai-hide"));
    }
    _show(suffix) {
      this._el(suffix)?.classList.remove("dai-hide");
    }

    _updateActiveModelTag() {
      const tag = this._el("active-tag");
      if (!tag) return;
      const m = MODELS.find((x) => x.key === this.selectedModel) || MODELS[1];
      tag.style.cssText = `background:${m.light};border:1px solid ${m.border};color:${m.color}`;
      tag.innerHTML = `<i class="${m.icon}"></i>&nbsp;Đang dùng: ${m.label}`;
    }

    // ── Server check ────────────────────────────────────────
    async _checkServer() {
      const pill = this._el("pill");
      const txt = this._el("pill-txt");
      if (!pill) return;
      try {
        const r = await fetch(`${this.cfg.apiUrl}/health`, {
          signal: AbortSignal.timeout(5000),
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (r.ok) {
          this.isServerOnline = true;
          pill.className = "dai-pill pill-ok";
          txt.textContent = "AI Server đang hoạt động ✓";
          return;
        }
      } catch {}
      this.isServerOnline = false;
      pill.className = "dai-pill pill-off";
      txt.textContent = "Server offline — Hãy chạy Colab notebook";
    }

    // ── Model select ────────────────────────────────────────
    selectModel(key) {
      this.selectedModel = key;
      MODELS.forEach((m) => {
        const btn = this._el("mb-" + m.key);
        if (btn) btn.classList.toggle("active", m.key === key);
      });
      this._updateActiveModelTag();
      this.reset();
    }

    // ── Tab ─────────────────────────────────────────────────
    tab(t) {
      this._el("t-up")?.classList.toggle("on", t === "up");
      this._el("t-cam")?.classList.toggle("on", t === "cam");
      this._el("p-up")?.classList.toggle("dai-hide", t !== "up");
      this._el("p-cam")?.classList.toggle("dai-hide", t !== "cam");
      if (t !== "cam" && this.stream) this.stopCam();
      this.reset();
    }

    // ── Upload ──────────────────────────────────────────────
    fsel(e) {
      const f = e.target.files[0];
      if (f) this._loadPreview(f);
    }
    dov(e) {
      e.preventDefault();
      this._el("dz")?.classList.add("drag");
    }
    dlv() {
      this._el("dz")?.classList.remove("drag");
    }
    drp(e) {
      e.preventDefault();
      this.dlv();
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) this._loadPreview(f);
    }
    _loadPreview(file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File quá lớn! Tối đa 10MB.");
        return;
      }
      this.selectedFile = file;
      const rd = new FileReader();
      rd.onload = (e) => {
        const ph = this._el("dz-ph");
        const img = this._el("prev");
        if (ph) ph.style.display = "none";
        if (img) {
          img.src = e.target.result;
          img.style.display = "block";
        }
      };
      rd.readAsDataURL(file);
      const btn = this._el("b-go");
      if (btn) btn.disabled = false;
      this.reset();
    }
    predict() {
      if (this.selectedFile) this._runPredict(this.selectedFile);
    }

    // ── Camera ──────────────────────────────────────────────
    async startCam() {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
        });
        const vid = this._el("vid");
        if (vid) vid.srcObject = this.stream;
        const bStart = this._el("b-start");
        const bCap = this._el("b-cap");
        const bStop = this._el("b-stop");
        if (bStart) bStart.disabled = true;
        if (bCap) bCap.disabled = false;
        if (bStop) bStop.classList.remove("dai-hide");
        const snov = this._el("snov");
        if (snov) snov.style.display = "none";
      } catch (e) {
        alert("Không thể truy cập camera: " + e.message);
      }
    }
    stopCam() {
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
      const vid = this._el("vid");
      if (vid) vid.srcObject = null;
      const bStart = this._el("b-start");
      const bCap = this._el("b-cap");
      const bStop = this._el("b-stop");
      if (bStart) bStart.disabled = false;
      if (bCap) bCap.disabled = true;
      if (bStop) bStop.classList.add("dai-hide");
    }
    capture() {
      const v = this._el("vid");
      const c = this._el("cv");
      if (!v || !c) return;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      const sn = this._el("sn");
      const snov = this._el("snov");
      if (sn) sn.src = c.toDataURL("image/jpeg", 0.9);
      if (snov) snov.style.display = "flex";
      c.toBlob(
        (blob) => this._runPredict(blob, "capture.jpg"),
        "image/jpeg",
        0.9,
      );
    }

    // ── Predict pipeline ────────────────────────────────────
    _fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const rd = new FileReader();
        rd.onload = () => resolve(rd.result.split(",")[1]);
        rd.onerror = reject;
        rd.readAsDataURL(file);
      });
    }

    // ── Roboflow detect (đã tắt) ────────────────────────────
    // async _detectDurian(file) {
    //   const b64 = await this._fileToBase64(file);
    //   const url = `https://serverless.roboflow.com/${RF_MODEL}/${RF_VERSION}?api_key=${RF_API_KEY}&confidence=${RF_MIN_CONF}`;
    //   const r = await fetch(url, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/x-www-form-urlencoded" },
    //     body: b64,
    //     signal: AbortSignal.timeout(15000),
    //   });
    //   if (!r.ok) throw new Error(`Roboflow HTTP ${r.status}`);
    //   const data = await r.json();
    //   const preds = data.predictions || [];
    //   if (!preds.length) return null;
    //   return preds.reduce(
    //     (best, p) => (p.confidence > best.confidence ? p : best),
    //     preds[0],
    //   );
    // }

    async _classifyRipeness(file, name) {
      const fd = new FormData();
      fd.append("file", file, name);
      const url = `${this.cfg.apiUrl}/predict?model=${encodeURIComponent(this.selectedModel)}`;
      const r = await fetch(url, {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(30000),
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || `HTTP ${r.status}`);
      }
      return r.json();
    }

    async _runPredict(file, name = "image.jpg") {
      if (!this.isServerOnline) {
        this._showErr(
          "AI Server chưa hoạt động.\nVui lòng chạy Colab notebook trước!",
        );
        return;
      }
      const mLabel =
        MODELS.find((m) => m.key === this.selectedModel)?.label ||
        this.selectedModel;
      this._showLoad("Đang kiểm tra đối tượng...");
      try {
        // ── Roboflow detect (đã tắt) ──────────────────────────
        // let detection = null;
        // try {
        //   detection = await this._detectDurian(file);
        // } catch (e) {
        //   console.warn("Roboflow detect lỗi, bỏ qua:", e.message);
        // }
        // if (detection === null && RF_API_KEY !== "THAY_API_KEY_CUA_BAN") {
        //   this._showNotDurian();
        //   return;
        // }

        this._showLoad(`${mLabel} đang phân tích...`);
        const result = await this._classifyRipeness(file, name);
        // if (detection) result._detection = detection;
        this._showOk(result);
      } catch (e) {
        this._showErr(
          e.name === "TimeoutError"
            ? "Timeout — server phản hồi quá chậm."
            : e.message,
        );
      }
    }

    // ── Render kết quả ──────────────────────────────────────
    _showLoad(msg) {
      this._hide("r-empty", "r-ok", "r-err");
      const txt = this._el("r-load-txt");
      if (txt) txt.innerHTML = `<i class="fas fa-cog fa-spin"></i> ${msg}`;
      this._show("r-load");
    }
    _showNotDurian() {
      this._hide("r-empty", "r-load", "r-ok");
      const errtxt = this._el("r-errtxt");
      if (errtxt)
        errtxt.innerHTML =
          'Không phát hiện sầu riêng trong ảnh này.<br><small style="color:#6b7280">Vui lòng upload ảnh có chứa trái sầu riêng.</small>';
      this._show("r-err");
    }
    _showErr(msg) {
      this._hide("r-empty", "r-load", "r-ok");
      const errtxt = this._el("r-errtxt");
      if (errtxt) errtxt.textContent = msg;
      this._show("r-err");
    }
    reset() {
      this._hide("r-load", "r-ok", "r-err");
      this._show("r-empty");
    }

    _showOk(data) {
      this._hide("r-load", "r-empty", "r-err");
      const cls = CLASSES[data.predicted_class] || CLASSES["Ripe"];
      const mUsed = MODELS.find((m) => m.key === data.model_used) || {};

      const bars = data.all_probabilities
        .map((prob) => {
          const c = CLASSES[prob.class_en] || {};
          const top = prob.class_en === data.predicted_class;
          return `
          <div class="dai-bar-row">
            <div class="dai-bar-top">
              <span class="dai-bar-name">
                <i class="${c.icon || "fas fa-circle"}" style="color:${c.bar}"></i>
                ${prob.class_vi}${top ? '&nbsp;<i class="fas fa-caret-up" style="font-size:.6rem;color:#16a34a"></i>' : ""}
              </span>
              <span class="dai-bar-val" style="color:${c.bar}">${prob.probability}%</span>
            </div>
            <div class="dai-bar-bg">
              <div class="dai-bar-fill" style="width:${prob.probability}%;background:${c.bar}"></div>
            </div>
          </div>`;
        })
        .join("");

      const modelTag = data.model_used
        ? `<div style="font-size:.7rem;font-weight:700;color:${mUsed.color || "#15803d"};margin-bottom:5px">
             <i class="${mUsed.icon || "fas fa-brain"}"></i> ${mUsed.label || data.model_used}
           </div>`
        : "";

      const okEl = this._el("r-ok");
      if (!okEl) return;
      okEl.innerHTML = `
        <div class="dai-res-hero" style="background:${cls.light};border-color:${cls.border};color:${cls.color}">
          ${modelTag}
          ${data._detection ? `<div style="font-size:.7rem;font-weight:700;color:#15803d;margin-bottom:5px"><i class="fas fa-check-circle"></i> Phát hiện sầu riêng · ${Math.round(data._detection.confidence * 100)}% tin cậy</div>` : ""}
          <span class="dai-res-icon"><i class="${cls.icon}" style="color:${cls.color}"></i></span>
          <div class="dai-res-name" style="color:${cls.color}">${data.predicted_class_vi}</div>
          <div class="dai-res-sub">Độ chính xác<span class="dai-res-pct" style="color:${cls.color}">${data.confidence}%</span></div>
        </div>
        <div class="dai-bars-lbl"><i class="fas fa-chart-pie"></i> Phân phối xác suất 4 lớp</div>
        ${bars}
        <button class="dai-reset" onclick="
          window.__DurianAI_instances['${this.containerId}'].reset();
          document.getElementById('${this.p}fi').value='';
          document.getElementById('${this.p}dz-ph').style.display='';
          document.getElementById('${this.p}prev').style.display='none';
          document.getElementById('${this.p}b-go').disabled=true;
        "><i class='fas fa-undo'></i> Phân tích ảnh khác</button>
      `;
      this._show("r-ok");
    }

    // ── Cleanup ─────────────────────────────────────────────
    destroy() {
      if (this.stream) this.stopCam();
      clearInterval(this._serverTimer);
      delete window.__DurianAI_instances[this.containerId];
    }
  }

  // ================================================================
  // PUBLIC API
  // ================================================================

  // Registry chứa tất cả instances
  window.__DurianAI_instances = window.__DurianAI_instances || {};

  /**
   * DurianAI.mount(containerId, overrideConfig?)
   *
   * Mount widget vào container có id=containerId.
   * Trả về instance để có thể tương tác hoặc gọi destroy() sau.
   *
   * @param {string} containerId  - id của thẻ HTML chứa widget
   * @param {object} overrideConfig - ghi đè config mặc định (tuỳ chọn)
   */
  function mount(containerId, overrideConfig = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[DurianAI] Không tìm thấy container #${containerId}`);
      return null;
    }
    // Nếu đã mount rồi thì destroy trước
    if (window.__DurianAI_instances[containerId]) {
      window.__DurianAI_instances[containerId].destroy();
    }
    const instanceCfg = Object.assign({}, cfg, overrideConfig);
    const instance = new DurianAIInstance(containerId, instanceCfg);
    window.__DurianAI_instances[containerId] = instance;
    return instance;
  }

  /**
   * Auto-mount: nếu trang có khai báo window.DurianAIConfig.containerId
   * hoặc trang có thẻ <div id="durian-ai-widget">, tự mount khi DOM ready.
   */
  function autoMount() {
    injectCSS();

    // Mount tất cả thẻ có data-durian-ai
    document.querySelectorAll("[data-durian-ai]").forEach((el) => {
      if (!el.id) el.id = "dai-auto-" + Math.random().toString(36).slice(2);
      const overrides = {};
      if (el.dataset.durianModel)
        overrides.defaultModel = el.dataset.durianModel;
      if (el.dataset.durianCompact !== undefined)
        overrides.compact = el.dataset.durianCompact !== "false";
      if (el.dataset.durianNoModelSelector !== undefined)
        overrides.showModelSelector = false;
      mount(el.id, overrides);
    });

    // Mount theo DurianAIConfig.containerId nếu có
    if (window.DurianAIConfig?.containerId) {
      mount(window.DurianAIConfig.containerId);
    }
  }

  window.DurianAI = { mount, injectCSS };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }
})();
