(function () {
  let signatureCounter = 0;
  const signatureStore = new Map();
  const SIGNATURE_FONT_SIZE = 22;
  const defaultFontFamilies = ["SignatureNiceMemory", "SignatureHarbour"];
  let signatureFontFamilies = [...defaultFontFamilies];
  const loadedFontKeys = new Set(defaultFontFamilies);
  const fallbackFontFiles = [
    "14TH Nice Memory.otf",
    "14TH Nice Memory.ttf",
    "Fz-Harbour-Light.ttf"
  ];

  function randomBetween(min, max, decimals = 2) {
    const value = min + Math.random() * (max - min);
    return Number(value.toFixed(decimals));
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
    return `${quoteFontFamily(family)}, "SignatureNiceMemory", "SignatureHarbour", cursive`;
  }

  function pickSignatureFont() {
    return signatureFontFamilies[Math.floor(Math.random() * signatureFontFamilies.length)] || "SignatureNiceMemory";
  }

  function fontFamilyFromFile(fileName) {
    return `SignatureAuto_${String(fileName).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "_")}`;
  }

  function fontUrlFromName(folderPath, fileName) {
    const base = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
    return `${base}${encodeURIComponent(fileName).replaceAll("%2F", "/")}`;
  }

  async function loadFontsFromFolder(folderPath = "font") {
    const fontFiles = Array.from(new Set(fallbackFontFiles));
    const loadedFamilies = [];

    for (const fileName of fontFiles) {
      const family = fontFamilyFromFile(fileName);
      if (loadedFontKeys.has(family)) continue;

      try {
        const face = new FontFace(family, `url("${fontUrlFromName(folderPath, fileName)}")`);
        await face.load();
        document.fonts.add(face);
        loadedFontKeys.add(family);
        loadedFamilies.push(family);
      } catch (err) {
        console.warn("Cannot load signature font:", fileName, err);
      }
    }

    signatureFontFamilies = [...defaultFontFamilies, ...Array.from(loadedFontKeys).filter((family) => !defaultFontFamilies.includes(family))];
    return { loaded: loadedFamilies.length, total: fontFiles.length };
  }

  function pickInkColor(role) {
    const handoverPalette = ["#083f95", "#0b4aa2", "#0d55b4", "#174f9f"];
    const receiverPalette = ["#0d51b5", "#135cc8", "#1b66d1", "#246fd7"];
    const palette = role === "receiver" ? receiverPalette : handoverPalette;
    return palette[Math.floor(Math.random() * palette.length)];
  }

  function makeNoisePoints(count) {
    return Array.from({ length: count }, () => ({
      x: randomBetween(18, 242, 1),
      y: randomBetween(10, 55, 1),
      r: randomBetween(0.16, 0.58, 2),
      a: randomBetween(0.015, 0.055, 2)
    }));
  }

  function makeSignatureState(kind = "normal", role = "handover") {
    const isCompact = kind === "compact";
    const direction = role === "receiver" ? -1 : 1;

    return {
      role,
      fontFamily: pickSignatureFont(),
      fontSize: SIGNATURE_FONT_SIZE,
      rotate: randomBetween(role === "receiver" ? -3.2 : -1.5, role === "receiver" ? 1.1 : 4.2, 1),
      skew: randomBetween(role === "receiver" ? -5.5 : -3, role === "receiver" ? 1.5 : 5.5, 1),
      scaleX: 1,
      y: randomBetween(-1.4, 1.6, 1),
      lineIndent: role === "receiver" ? randomBetween(-2.2, 2.8, 1) : 0,
      lineShift: role === "receiver" ? randomBetween(-0.6, 0.7, 1) : 0,
      letterSpacing: 0.12,
      color: pickInkColor(role),
      opacity: randomBetween(role === "receiver" ? 0.68 : 0.72, role === "receiver" ? 0.82 : 0.86, 2),
      roughOffsetX: randomBetween(-0.35, 0.35, 2),
      roughOffsetY: randomBetween(-0.28, 0.28, 2),
      lightOffsetX: direction * randomBetween(0.18, 0.38, 2),
      noise: makeNoisePoints(isCompact ? 30 : 38)
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

  function drawSignatureCanvas(canvas, record) {
    const { name, state, boxWidth, boxHeight } = record;
    const logicalWidth = boxWidth;
    const logicalHeight = boxHeight;
    const ratio = 2;

    canvas.width = logicalWidth * ratio;
    canvas.height = logicalHeight * ratio;
    canvas.style.width = `${boxWidth}px`;
    canvas.style.height = `${boxHeight}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    const fontSize = state.fontSize;
    ctx.font = `${fontSize}px ${fontStack(state.fontFamily)}`;
    const width = textWidth(ctx, name, state.letterSpacing);
    const sidePadding = state.role === "receiver" ? 12 : 22;
    const maxWidth = logicalWidth - sidePadding * 2;
    const fitScaleX = Math.min(1, maxWidth / Math.max(width, 1));

    const baseY = logicalHeight * 0.58 + state.y;
    const dark = state.color;
    const mid = state.role === "receiver" ? "#1f73db" : "#155fc4";
    const pale = state.role === "receiver" ? "#6ba9ff" : "#5796f0";

    ctx.save();
    ctx.translate(logicalWidth / 2, baseY);
    ctx.rotate((state.rotate * Math.PI) / 180);
    ctx.transform(1, 0, Math.tan((state.skew * Math.PI) / 180), 1, 0, 0);
    ctx.scale(fitScaleX * state.scaleX, 1);
    ctx.translate(-width / 2, 0);

    const gradient = ctx.createLinearGradient(0, -fontSize, width, 5);
    gradient.addColorStop(0, rgba(dark, 0.86));
    gradient.addColorStop(0.32, rgba(mid, 0.62));
    gradient.addColorStop(0.58, rgba(pale, 0.36));
    gradient.addColorStop(0.82, rgba(dark, 0.76));
    gradient.addColorStop(1, rgba(mid, 0.56));

    ctx.globalAlpha = 0.12;
    ctx.filter = "none";
    ctx.fillStyle = rgba(pale, 0.46);
    drawTextWithSpacing(ctx, name, state.lightOffsetX, -0.4, state.letterSpacing);

    ctx.globalAlpha = state.opacity;
    ctx.filter = "none";
    ctx.fillStyle = gradient;
    drawTextWithSpacing(ctx, name, 0, 0, state.letterSpacing);

    ctx.globalAlpha = 0.14;
    ctx.filter = "none";
    ctx.fillStyle = rgba(dark, 0.82);
    drawTextWithSpacing(ctx, name, state.roughOffsetX, state.roughOffsetY, state.letterSpacing);

    ctx.globalAlpha = 0.13;
    ctx.fillStyle = rgba("#ffffff", 0.8);
    drawTextWithSpacing(ctx, name, -0.25, -0.25, state.letterSpacing);

    ctx.globalCompositeOperation = "destination-out";
    state.noise.forEach((point) => {
      ctx.globalAlpha = point.a;
      ctx.beginPath();
      ctx.arc(point.x % Math.max(width, 1), point.y - logicalHeight * 0.42, point.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = rgba(dark, 0.75);
    state.noise.slice(0, 16).forEach((point) => {
      ctx.fillRect(point.x % Math.max(width, 1), point.y - logicalHeight * 0.42, point.r * 1.4, Math.max(0.2, point.r * 0.45));
    });

    ctx.restore();
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

  function signatureItemHtml(name, state, index = 0, mode = "row") {
    if (!name || !state) return "";

    const id = `sig-${Date.now()}-${signatureCounter++}`;
    const stagger = [0, 3, -2, 2, -1, 3, -2, 1][index % 8] + (state.lineIndent || 0);
    const itemStyle = mode === "cloud"
      ? `transform:translate(${stagger}px, ${state.lineShift || 0}px);`
      : "";
    const estimatedNameWidth = Array.from(name).length * 10 + 46;
    const boxWidth = state.role === "receiver"
      ? Math.max(96, Math.min(164, estimatedNameWidth))
      : 300;
    const boxHeight = state.role === "receiver" ? 34 : 52;

    signatureStore.set(id, { name, state, boxWidth, boxHeight });

    return `
      <div class="signature-item" style="${itemStyle}">
        <canvas class="signature-canvas" data-signature-id="${escapeHtml(id)}" aria-label="${escapeHtml(name)}" style="width:${boxWidth}px;height:${boxHeight}px"></canvas>
      </div>
    `;
  }

  function renderSignatureGroup(names, states, ready = true) {
    if (!ready || !names.length) return '<div class="signature-empty"></div>';

    const mode = states.some((state) => state && state.role === "receiver") ? "cloud" : "row";
    const compactClass = names.length > 2 ? " compact" : "";
    const itemsHtml = names.map((name, index) => {
      const item = signatureItemHtml(name, states[index], index, mode);
      const shouldBreak = mode === "cloud" && (index + 1) % 2 === 0 && index < names.length - 1;
      return shouldBreak ? `${item}<span class="signature-row-break"></span>` : item;
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
    renderSignatureGroup
  };
})();
