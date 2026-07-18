function boxBlur(src, width, height, radius) {
  const out = new Float32Array(width * height);
  const tmp = new Float32Array(width * height);
  const w = radius * 2 + 1;
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const row = y * width;
    for (let x = -radius; x <= radius; x++) sum += src[row + Math.min(width - 1, Math.max(0, x))];
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum / w;
      sum += src[row + Math.min(width - 1, x + radius + 1)] - src[row + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(height - 1, Math.max(0, y)) * width + x];
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / w;
      sum += tmp[Math.min(height - 1, y + radius + 1) * width + x] - tmp[Math.max(0, y - radius) * width + x];
    }
  }
  return out;
}

function enhanceCanvas(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const n = width * height;
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  const radius = Math.max(8, Math.round(Math.min(width, height) / 12));
  const background = boxBlur(gray, width, height, radius);
  const threshold = 185;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const factor = 255 / Math.max(40, background[i]);
    const flatGray = Math.min(255, gray[i] * factor);
    const centered = (flatGray - threshold) / 9;
    const sig = 255 / (1 + Math.exp(-centered));
    data[o] = data[o + 1] = data[o + 2] = sig;
  }
  ctx.putImageData(imageData, 0, 0);
}

// ------------------------------------------------------------
// DÉTECTION AUTOMATIQUE DES BORDS DU DOCUMENT (type CamScanner)
// 1) on binarise l'image (Otsu) pour séparer papier / fond
// 2) on cherche la plus grande zone connexe plausible ("le papier")
// 3) on prend ses 4 coins extrêmes
// 4) on redresse en perspective vers un rectangle
// ------------------------------------------------------------

function otsuThreshold(gray, n) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) hist[Math.min(255, Math.max(0, Math.round(gray[i])))]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0,
    wB = 0,
    varMax = 0,
    threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > varMax) {
      varMax = between;
      threshold = t;
    }
  }
  return threshold;
}

function largestComponent(maskFn, w, h) {
  const n = w * h;
  const visited = new Uint8Array(n);
  let best = null;
  for (let start = 0; start < n; start++) {
    if (visited[start] || !maskFn(start)) continue;
    let count = 0;
    let minSum = Infinity,
      maxSum = -Infinity,
      minDiff = Infinity,
      maxDiff = -Infinity;
    let tl = null,
      tr = null,
      br = null,
      bl = null;
    let minX = w,
      maxX = 0,
      minY = h,
      maxY = 0;
    const stack = [start];
    visited[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % w;
      const y = (idx / w) | 0;
      count++;
      const s = x + y;
      const d = x - y;
      if (s < minSum) {
        minSum = s;
        tl = { x, y };
      }
      if (s > maxSum) {
        maxSum = s;
        br = { x, y };
      }
      if (d > maxDiff) {
        maxDiff = d;
        tr = { x, y };
      }
      if (d < minDiff) {
        minDiff = d;
        bl = { x, y };
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const left = x > 0 ? idx - 1 : -1;
      const right = x < w - 1 ? idx + 1 : -1;
      const up = y > 0 ? idx - w : -1;
      const down = y < h - 1 ? idx + w : -1;
      for (const nb of [left, right, up, down]) {
        if (nb >= 0 && !visited[nb] && maskFn(nb)) {
          visited[nb] = 1;
          stack.push(nb);
        }
      }
    }
    if (!best || count > best.count) best = { count, minX, maxX, minY, maxY, tl, tr, br, bl };
  }
  return best;
}

function isValidCandidate(c, w, h, n) {
  if (!c) return false;
  const touchesAllEdges = c.minX <= 1 && c.maxX >= w - 2 && c.minY <= 1 && c.maxY >= h - 2;
  const ratio = c.count / n;
  return !touchesAllEdges && ratio > 0.12 && ratio < 0.94;
}

function detectDocumentCorners(img, targetW, targetH) {
  const maxDet = 500;
  const detScale = Math.min(1, maxDet / Math.max(img.width, img.height));
  const dw = Math.max(1, Math.round(img.width * detScale));
  const dh = Math.max(1, Math.round(img.height * detScale));
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, dw, dh);
  const imgData = ctx.getImageData(0, 0, dw, dh);
  const data = imgData.data;
  const n = dw * dh;
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  const blurred = boxBlur(gray, dw, dh, 2);
  const threshold = otsuThreshold(blurred, n);

  const above = largestComponent((i) => blurred[i] > threshold, dw, dh);
  const below = largestComponent((i) => blurred[i] <= threshold, dw, dh);

  let candidate = null;
  const aboveOk = isValidCandidate(above, dw, dh, n);
  const belowOk = isValidCandidate(below, dw, dh, n);
  if (aboveOk && belowOk) candidate = above.count > below.count ? above : below;
  else if (aboveOk) candidate = above;
  else if (belowOk) candidate = below;
  if (!candidate) return null;

  const scaleToTarget = targetW / dw;
  const conv = (p) => ({ x: p.x * scaleToTarget, y: p.y * scaleToTarget });
  return { tl: conv(candidate.tl), tr: conv(candidate.tr), br: conv(candidate.br), bl: conv(candidate.bl) };
}

function bilinearSample(data, w, h, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const cx0 = Math.min(w - 1, Math.max(0, x0));
  const cy0 = Math.min(h - 1, Math.max(0, y0));
  const cx1 = Math.min(w - 1, Math.max(0, x0 + 1));
  const cy1 = Math.min(h - 1, Math.max(0, y0 + 1));
  const fx = x - x0;
  const fy = y - y0;
  const idx = (yy, xx) => (yy * w + xx) * 4;
  const i00 = idx(cy0, cx0),
    i10 = idx(cy0, cx1),
    i01 = idx(cy1, cx0),
    i11 = idx(cy1, cx1);
  const r = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const top = data[i00 + k] * (1 - fx) + data[i10 + k] * fx;
    const bottom = data[i01 + k] * (1 - fx) + data[i11 + k] * fx;
    r[k] = top * (1 - fy) + bottom * fy;
  }
  return r;
}

// Redresse le quadrilatère détecté (tl,tr,br,bl) vers un rectangle outW x outH
// (formule classique "unit square -> quad" de P. Heckbert, utilisée à l'envers)
function warpQuadToRect(sourceCanvas, quad, outW, outH) {
  const sw = sourceCanvas.width,
    sh = sourceCanvas.height;
  const sctx = sourceCanvas.getContext("2d");
  const sData = sctx.getImageData(0, 0, sw, sh).data;

  const { tl, tr, br, bl } = quad;
  const x0 = tl.x,
    y0 = tl.y,
    x1 = tr.x,
    y1 = tr.y,
    x2 = br.x,
    y2 = br.y,
    x3 = bl.x,
    y3 = bl.y;

  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3;

  let g = 0,
    h = 0;
  const denom = dx1 * dy2 - dx2 * dy1;
  if (!(Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) && Math.abs(denom) > 1e-9) {
    g = (dx3 * dy2 - dx2 * dy3) / denom;
    h = (dx1 * dy3 - dx3 * dy1) / denom;
  }
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const f = y0;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const octx = outCanvas.getContext("2d");
  const outData = octx.createImageData(outW, outH);
  const od = outData.data;

  for (let oy = 0; oy < outH; oy++) {
    const v = oy / outH;
    for (let ox = 0; ox < outW; ox++) {
      const u = ox / outW;
      const denomUV = g * u + h * v + 1;
      const sx = (a * u + b * v + c) / denomUV;
      const sy = (d * u + e * v + f) / denomUV;
      const px = bilinearSample(sData, sw, sh, sx, sy);
      const oIdx = (oy * outW + ox) * 4;
      od[oIdx] = px[0];
      od[oIdx + 1] = px[1];
      od[oIdx + 2] = px[2];
      od[oIdx + 3] = 255;
    }
  }
  octx.putImageData(outData, 0, 0);
  return outCanvas;
}

function processFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        try {
          const maxDim = 1400;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const fullW = Math.round(img.width * scale);
          const fullH = Math.round(img.height * scale);
          const fullCanvas = document.createElement("canvas");
          fullCanvas.width = fullW;
          fullCanvas.height = fullH;
          const fctx = fullCanvas.getContext("2d");
          fctx.drawImage(img, 0, 0, fullW, fullH);

          let workCanvas = fullCanvas;
          const corners = detectDocumentCorners(img, fullW, fullH);
          if (corners) {
            const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
            const wTop = dist(corners.tl, corners.tr);
            const wBot = dist(corners.bl, corners.br);
            const hLeft = dist(corners.tl, corners.bl);
            const hRight = dist(corners.tr, corners.br);
            let outW = Math.round(Math.max(wTop, wBot));
            let outH = Math.round(Math.max(hLeft, hRight));
            const maxOut = 1200;
            const s = Math.min(1, maxOut / Math.max(outW, outH));
            outW = Math.max(60, Math.round(outW * s));
            outH = Math.max(60, Math.round(outH * s));
            workCanvas = warpQuadToRect(fullCanvas, corners, outW, outH);
          }

          const wctx = workCanvas.getContext("2d");
          enhanceCanvas(wctx, workCanvas.width, workCanvas.height);
          resolve(workCanvas.toDataURL("image/jpeg", 0.8));
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
