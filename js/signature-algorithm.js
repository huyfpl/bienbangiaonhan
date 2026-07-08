(function () {
  let signatureCounter = 0;
  const signatureStore = new Map();
  const DEFAULT_SIGNATURE_FONT_SIZE = 26;
  const SIGNATURE_INK_COLORS = ["#34383d", "#3c444b", "#293a45", "#46494d", "#2f3940"];
  const defaultFontFamilies = ["SignatureMotherland", "SignatureNiceMemory", "SignatureHarbour"];
  let signatureFontFamilies = [...defaultFontFamilies];
  const loadedFontKeys = new Set(defaultFontFamilies);
  const loadedFontMeta = [];
  let baseFontSize = DEFAULT_SIGNATURE_FONT_SIZE;
  let fontBag = [];
  const knownFontFiles = [
    "14TH Nice Memory.otf",
    "14TH Nice Memory.ttf",
    "Fz-Harbour-Light.ttf",
    "NVN-Motherland-Signature.ttf"
  ];

  function randomBetween(min, max, decimals = 2) {
    const value = min + Math.random() * (max - min);
    return Number(value.toFixed(decimals));
  }

  function normalizeFontSize(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_SIGNATURE_FONT_SIZE;
    return Math.max(1, Math.min(50, Math.round(parsed)));
  }

  function setBaseFontSize(value) {
    baseFontSize = normalizeFontSize(value);
    return baseFontSize;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function quoteFontFamily(family) {
    return `"${String(family || "SignatureNiceMemory").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }

  function fontStack(family) {
    return `${quoteFontFamily(family)}, "SignatureMotherland", "SignatureNiceMemory", "SignatureHarbour", cursive`;
  }

  function shuffledFonts(fonts) {
    const next = [...fonts];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }

  function pickSignatureFont(avoidFonts = []) {
    const avoid = new Set(Array.isArray(avoidFonts) ? avoidFonts.filter(Boolean) : [avoidFonts].filter(Boolean));
    let candidates = signatureFontFamilies.filter((family) => !avoid.has(family));
    if (!candidates.length) candidates = [...signatureFontFamilies];
    if (!fontBag.length || !fontBag.some((family) => candidates.includes(family))) {
      fontBag = shuffledFonts(signatureFontFamilies);
    }
    const bagIndex = fontBag.findIndex((family) => candidates.includes(family));
    if (bagIndex >= 0) return fontBag.splice(bagIndex, 1)[0];
    return candidates[Math.floor(Math.random() * candidates.length)] || "SignatureNiceMemory";
  }

  function fontFamilyFromFile(fileName) {
    return `SignatureAuto_${String(fileName).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "_")}`;
  }

  function fontUrlFromName(folderPath, fileName) {
    const base = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
    return `${base}${encodeURIComponent(fileName).replaceAll("%2F", "/")}`;
  }

  function normalizeFontFileName(value) {
    const raw = String(value || "").trim().replaceAll("\\", "/").split("?")[0].split("#")[0];
    const name = decodeURIComponent(raw.split("/").pop() || "");
    return /\.(ttf|otf|woff2?)$/i.test(name) ? name : "";
  }

  async function readDirectoryFontList(folderPath) {
    if (!window.fetch || !window.DOMParser) return [];
    try {
      const base = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
      const response = await fetch(base, { cache: "no-store" });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("text/html")) return [];
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const fromLinks = Array.from(doc.querySelectorAll("a[href]"))
        .map((link) => normalizeFontFileName(link.getAttribute("href")))
        .filter(Boolean);
      const fromText = Array.from(html.matchAll(/(?:href=["'])?([^"'<>]+?\.(?:ttf|otf|woff2?))(?:["'<>])/gi))
        .map((match) => normalizeFontFileName(match[1]))
        .filter(Boolean);
      return Array.from(new Set([...fromLinks, ...fromText])).sort((a, b) => a.localeCompare(b, "vi"));
    } catch (err) {
      return [];
    }
  }

  async function loadFontsFromFolder(folderPath = "fonts", fallbackFolderPath = "font") {
    const directoryFiles = await readDirectoryFontList(folderPath);
    const fontFiles = Array.from(new Set([...(directoryFiles.length ? directoryFiles : knownFontFiles)].map(normalizeFontFileName).filter(Boolean)));
    const loadedFamilies = [];

    for (const fileName of fontFiles) {
      const family = fontFamilyFromFile(fileName);
      if (loadedFontKeys.has(family)) continue;

      try {
        let loadedFace = null;
        for (const folder of [folderPath, fallbackFolderPath].filter(Boolean)) {
          try {
            const face = new FontFace(family, `url("${fontUrlFromName(folder, fileName)}")`);
            await face.load();
            loadedFace = face;
            break;
          } catch (err) {
            if (folder === fallbackFolderPath) throw err;
          }
        }
        if (loadedFace) {
          document.fonts.add(loadedFace);
          loadedFontKeys.add(family);
          loadedFontMeta.push({ family, fileName });
          loadedFamilies.push(family);
        }
      } catch (err) {
        console.warn("Cannot load signature font:", fileName, err);
      }
    }

    const loadedAutoFamilies = Array.from(loadedFontKeys).filter((family) => !defaultFontFamilies.includes(family));
    signatureFontFamilies = loadedAutoFamilies.length ? loadedAutoFamilies : [...defaultFontFamilies];
    fontBag = shuffledFonts(signatureFontFamilies);
    console.info("Signature fonts loaded from fonts/:", loadedFontMeta.map((font) => font.fileName));
    return { loaded: loadedFamilies.length, total: fontFiles.length, files: loadedFontMeta.map((font) => font.fileName) };
  }

  function pickInkColor() {
    const color = SIGNATURE_INK_COLORS[Math.floor(Math.random() * SIGNATURE_INK_COLORS.length)];
    return shiftHexColor(color, randomBetween(-10, 12, 0));
  }

  function makeNoisePoints(count) {
    return Array.from({ length: count }, () => ({
      x: randomBetween(18, 242, 1),
      y: randomBetween(10, 55, 1),
      r: randomBetween(0.16, 0.58, 2),
      a: randomBetween(0.015, 0.055, 2)
    }));
  }

  function makeSignatureState(kind = "normal", role = "handover", avoidFonts = []) {
    const isCompact = kind === "compact";
    const direction = role === "receiver" ? -1 : 1;
    const fontSize = baseFontSize;

    return {
      role,
      fontFamily: pickSignatureFont(avoidFonts),
      fontSize,
      rotate: randomBetween(-2.2, 2.4, 1),
      skew: randomBetween(-3.2, 3.2, 1),
      scaleX: randomBetween(0.98, 1.08, 2),
      x: randomBetween(-8, 8, 1),
      y: randomBetween(-1.4, 1.6, 1),
      fullNameX: randomBetween(-2.2, 2.2, 1),
      fullNameColorShift: randomBetween(-4, 5, 0),
      nameGap: role === "receiver" ? randomBetween(7, 11, 1) : randomBetween(9, 14, 1),
      lineIndent: role === "receiver" ? randomBetween(-2.2, 2.8, 1) : randomBetween(-1.4, 1.4, 1),
      lineShift: role === "receiver" ? randomBetween(-0.6, 0.7, 1) : 0,
      letterSpacing: 0.05,
      color: pickInkColor(),
      opacity: randomBetween(0.78, 0.9, 2),
      roughOffsetX: randomBetween(-0.35, 0.35, 2),
      roughOffsetY: randomBetween(-0.28, 0.28, 2),
      lightOffsetX: direction * randomBetween(0.18, 0.38, 2),
      tail: null,
      noise: makeNoisePoints(isCompact ? 32 : 38)
    };
  }

  function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function rgbToHex({ r, g, b }) {
    return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
  }

  function shiftHexColor(hex, amount) {
    const rgb = hexToRgb(hex);
    return rgbToHex({ r: rgb.r + amount, g: rgb.g + amount, b: rgb.b + amount });
  }

  function mixHexColor(hex, targetHex, amount) {
    const from = hexToRgb(hex);
    const to = hexToRgb(targetHex);
    return rgbToHex({
      r: from.r + (to.r - from.r) * amount,
      g: from.g + (to.g - from.g) * amount,
      b: from.b + (to.b - from.b) * amount
    });
  }

  function rgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function textWidth(ctx, text, spacing) {
    if (!spacing) return ctx.measureText(text).width;
    return Array.from(text).reduce((total, char) => total + ctx.measureText(char).width + spacing, -spacing);
  }

  function drawTextWithSpacing(ctx, text, x, y, spacing) {
    if (!spacing) {
      ctx.fillText(text, x, y);
      return;
    }

    let cursor = x;
    Array.from(text).forEach((char) => {
      ctx.fillText(char, cursor, y);
      cursor += ctx.measureText(char).width + spacing;
    });
  }

  function strokeTextWithSpacing(ctx, text, x, y, spacing) {
    if (!spacing) {
      ctx.strokeText(text, x, y);
      return;
    }

    let cursor = x;
    Array.from(text).forEach((char) => {
      ctx.strokeText(char, cursor, y);
      cursor += ctx.measureText(char).width + spacing;
    });
  }

  function drawLine(ctx, text, options) {
    const {
      x,
      y,
      fontSize,
      fontFamily,
      boxWidth,
      scaleX,
      rotate,
      skew,
      color,
      opacity,
      letterSpacing,
      lightOffsetX,
      roughOffsetX,
      roughOffsetY,
      noise,
      sidePadding = 12,
      lineWidthBoost = 1
    } = options;

    ctx.font = `${fontSize}px ${fontStack(fontFamily)}`;
    const width = textWidth(ctx, text, letterSpacing);
    const maxWidth = boxWidth - sidePadding * 2;
    const fitScaleX = Math.min(scaleX, maxWidth / Math.max(width, 1));
    const dark = color;
    const mid = mixHexColor(color, "#6f7479", 0.34);
    const pale = mixHexColor(color, "#f2f1ec", 0.58);

    ctx.save();
    ctx.translate(boxWidth / 2 + x, y);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.transform(1, 0, Math.tan((skew * Math.PI) / 180), 1, 0, 0);
    ctx.scale(fitScaleX, 1);
    ctx.translate(-width / 2, 0);

    const gradient = ctx.createLinearGradient(0, -fontSize, width, 5);
    gradient.addColorStop(0, rgba(dark, 0.86));
    gradient.addColorStop(0.28, rgba(mid, 0.64));
    gradient.addColorStop(0.54, rgba(pale, 0.22));
    gradient.addColorStop(0.78, rgba(dark, 0.78));
    gradient.addColorStop(1, rgba(mid, 0.58));

    ctx.globalAlpha = 0.07;
    ctx.filter = "none";
    ctx.fillStyle = rgba(pale, 0.38);
    drawTextWithSpacing(ctx, text, lightOffsetX, -0.4, letterSpacing);

    ctx.globalAlpha = opacity;
    ctx.fillStyle = gradient;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(0.28, fontSize / 72) * lineWidthBoost;
    ctx.strokeStyle = rgba(dark, 0.2);
    strokeTextWithSpacing(ctx, text, 0, 0, letterSpacing);
    drawTextWithSpacing(ctx, text, 0, 0, letterSpacing);

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = rgba(dark, 0.7);
    drawTextWithSpacing(ctx, text, roughOffsetX, roughOffsetY, letterSpacing);

    ctx.globalCompositeOperation = "destination-out";
    noise.slice(0, Math.max(8, Math.round(noise.length * 0.55))).forEach((point) => {
      ctx.globalAlpha = Math.min(0.11, point.a * 1.35);
      ctx.beginPath();
      ctx.arc(point.x % Math.max(width, 1), point.y - 34, point.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function drawSignatureCanvas(canvas, record) {
    const { signatureText, fullName, showFullName, state, boxWidth, boxHeight } = record;
    const logicalWidth = boxWidth;
    const logicalHeight = boxHeight;
    const dpr = window.devicePixelRatio || 1;
    const ratio = Math.max(4, Math.min(8, Math.ceil(dpr * 4)));

    canvas.width = logicalWidth * ratio;
    canvas.height = logicalHeight * ratio;
    canvas.style.width = `${boxWidth}px`;
    canvas.style.height = `${boxHeight}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    const fontSize = state.fontSize;
    const nameFontSize = Math.max(1, fontSize * 0.72);
    const topY = showFullName === false
      ? Math.max(fontSize + 4, logicalHeight * 0.68 + state.y)
      : Math.max(fontSize + 4, logicalHeight * 0.38 + state.y);
    const nameY = Math.min(logicalHeight - 7, topY + fontSize * 0.82 + (state.nameGap || 9));

    drawLine(ctx, signatureText, {
      x: state.x,
      y: topY,
      fontSize,
      fontFamily: state.fontFamily,
      boxWidth: logicalWidth,
      scaleX: state.scaleX,
      rotate: state.rotate,
      skew: state.skew,
      color: state.color,
      opacity: state.opacity,
      letterSpacing: state.letterSpacing,
      lightOffsetX: state.lightOffsetX,
      roughOffsetX: state.roughOffsetX,
      roughOffsetY: state.roughOffsetY,
      noise: state.noise,
      sidePadding: showFullName === false ? 7 : 12,
      lineWidthBoost: showFullName === false ? 1.32 : 1
    });

    if (showFullName !== false) {
      drawLine(ctx, fullName, {
        x: state.x * 0.45 + state.fullNameX,
        y: nameY,
        fontSize: nameFontSize,
        fontFamily: state.fontFamily,
        boxWidth: logicalWidth,
        scaleX: Math.min(1.02, state.scaleX),
        rotate: state.rotate * 0.35,
        skew: state.skew * 0.45,
        color: shiftHexColor(state.color, state.fullNameColorShift),
        opacity: Math.min(0.94, state.opacity + 0.03),
        letterSpacing: 0,
        lightOffsetX: state.lightOffsetX * 0.45,
        roughOffsetX: state.roughOffsetX * 0.7,
        roughOffsetY: state.roughOffsetY * 0.6,
        noise: state.noise.slice().reverse()
      });
    }
  }

  async function paintSignatures(root = document) {
    if (document.fonts && document.fonts.load) {
      await Promise.allSettled(signatureFontFamilies.map((family) => document.fonts.load(`32px ${quoteFontFamily(family)}`)));
      if (document.fonts.ready) {
        await document.fonts.ready.catch(() => {});
      }
    }

    root.querySelectorAll(".signature-canvas").forEach((canvas) => {
      const record = signatureStore.get(canvas.dataset.signatureId);
      if (record) drawSignatureCanvas(canvas, record);
    });
  }

  function normalizeSigner(signer) {
    if (typeof signer === "string") {
      return { signatureText: signer, fullName: signer };
    }
    return {
      signatureText: signer && (signer.signatureText || signer.signName || signer.fullName || signer.name),
      fullName: signer && (signer.fullName || signer.name || signer.signatureText || signer.signName),
      showFullName: signer && signer.showFullName
    };
  }

  function estimateTextWidth(text, fontSize, factor = 0.48) {
    return Array.from(String(text || "")).length * Math.max(7, fontSize * factor);
  }

  function signatureItemHtml(signer, state, index = 0, mode = "row") {
    const normalized = normalizeSigner(signer);
    if (!normalized.signatureText || !normalized.fullName || !state) return "";

    const id = `sig-${Date.now()}-${signatureCounter++}`;
    const showFullName = normalized.showFullName !== false;
    const staggerPattern = mode === "cloud" ? [0, 1, -1, 1, -1, 0, 1, -1] : [0, 3, -2, 2, -1, 3, -2, 1];
    const stagger = staggerPattern[index % staggerPattern.length] + (mode === "cloud" ? (state.lineIndent || 0) * 0.35 : (state.lineIndent || 0));
    const itemStyle = mode === "cloud"
      ? `transform:translate(${stagger}px, ${state.lineShift || 0}px);z-index:${(index % 5) + 1};`
      : "";
    const receiverSingleLine = state.role === "receiver" && !showFullName;
    const estimatedSignWidth = estimateTextWidth(normalized.signatureText, state.fontSize, receiverSingleLine ? 0.58 : 0.5) + (receiverSingleLine ? 24 : 42);
    const estimatedNameWidth = showFullName ? estimateTextWidth(normalized.fullName, state.fontSize * 0.72, 0.5) + 42 : 0;
    const estimatedWidth = Math.max(estimatedSignWidth, estimatedNameWidth);
    const boxWidth = state.role === "receiver"
      ? Math.max(66, Math.min(156, estimatedWidth))
      : Math.max(170, Math.min(290, estimatedWidth));
    const boxHeight = showFullName
      ? Math.max(62, Math.round(state.fontSize * 2.45 + (state.nameGap || 9)))
      : Math.max(48, Math.round(state.fontSize * 1.78));

    signatureStore.set(id, { ...normalized, showFullName, state, boxWidth, boxHeight });

    return `
      <div class="signature-item" style="${itemStyle}">
        <canvas class="signature-canvas" data-signature-id="${escapeHtml(id)}" aria-label="${escapeHtml(normalized.fullName)}" style="width:${boxWidth}px;height:${boxHeight}px"></canvas>
      </div>
    `;
  }

  function renderSignatureGroup(names, states, ready = true) {
    if (!ready || !names.length) return '<div class="signature-empty"></div>';

    const mode = states.some((state) => state && state.role === "receiver") ? "cloud" : "row";
    const compactClass = names.length > 2 ? " compact" : "";
    const itemsHtml = names.map((name, index) => {
      const item = signatureItemHtml(name, states[index], index, mode);
      return item;
    }).join("");

    return `
      <div class="signature-list${compactClass}${mode === "cloud" ? " receiver-cloud" : ""}">
        ${itemsHtml}
      </div>
    `;
  }

  window.SignatureAlgorithm = {
    loadFontsFromFolder,
    makeSignatureState,
    paintSignatures,
    renderSignatureGroup,
    setBaseFontSize,
    getLoadedFonts: () => [...loadedFontMeta]
  };
})();
