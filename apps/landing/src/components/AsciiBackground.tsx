"use client";

import { useEffect, useRef } from "react";

// From sparse (low intensity) to dense (high intensity / wave peaks)
const CHARS = " .:-=+*#%@";
const CELL = 10;
const FONT = 9;

// 3D Simplex noise — JS port of the GLSL snoise used in the original shader
// Based on Ashima Arts simplex noise (same as the Framer module uses)
function mod289(x: number) {
  return x - Math.floor(x / 289) * 289;
}

function permute(x: number) {
  return mod289((x * 34 + 10) * x);
}

// Attempt a fast 3D simplex noise
function snoise3(x: number, y: number, z: number): number {
  // Skew factor for 3D
  const F3 = 1 / 3;
  const G3 = 1 / 6;

  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);

  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;

  const x0 = x - X0;
  const y0 = y - Y0;
  const z0 = z - Z0;

  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;

  if (x0 >= y0) {
    if (y0 >= z0) {
      i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    } else if (x0 >= z0) {
      i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
    } else {
      i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
    }
  } else {
    if (y0 < z0) {
      i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
    } else if (x0 < z0) {
      i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
    } else {
      i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3;
  const y2 = y0 - j2 + 2 * G3;
  const z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3;
  const y3 = y0 - 1 + 3 * G3;
  const z3 = z0 - 1 + 3 * G3;

  const ii = mod289(i);
  const jj = mod289(j);
  const kk = mod289(k);

  const gi0 = permute(permute(permute(kk) + jj) + ii);
  const gi1 = permute(permute(permute(kk + k1) + jj + j1) + ii + i1);
  const gi2 = permute(permute(permute(kk + k2) + jj + j2) + ii + i2);
  const gi3 = permute(permute(permute(kk + 1) + jj + 1) + ii + 1);

  function grad3(hash: number, gx: number, gy: number, gz: number): number {
    const h = hash % 12;
    const u = h < 8 ? gx : gy;
    const v = h < 4 ? gy : h === 12 || h === 14 ? gx : gz;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  let n = 0;

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 >= 0) {
    t0 *= t0;
    n += t0 * t0 * grad3(gi0, x0, y0, z0);
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 >= 0) {
    t1 *= t1;
    n += t1 * t1 * grad3(gi1, x1, y1, z1);
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 >= 0) {
    t2 *= t2;
    n += t2 * t2 * grad3(gi2, x2, y2, z2);
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 >= 0) {
    t3 *= t3;
    n += t3 * t3 * grad3(gi3, x3, y3, z3);
  }

  return 32 * n; // Range approx [-1, 1]
}

// Low frequency = fewer, much larger waves
const FREQUENCY = 0.9;
const SPEED = 0.15;
const GAMMA = 3.5;

export function AsciiBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let dpr = 1;
    const t0 = performance.now();

    function resize() {
      if (!canvas || !ctx) return;
      dpr = Math.min(window.devicePixelRatio, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    function render() {
      if (!canvas || !ctx) return;
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      const time = (performance.now() - t0) / 1000;

      ctx.clearRect(0, 0, w, h);
      ctx.font = `${FONT}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const cols = Math.ceil(w / CELL);
      const rows = Math.ceil(h / CELL);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * CELL + CELL / 2;
          const y = row * CELL + CELL / 2;

          // Pixel-space UVs preserving aspect ratio so waves aren't squished
          const nu = (col / cols) * (w / h);
          const nv = row / rows;

          // 3D simplex noise with aspect-correct coordinates
          const noiseVal = Math.abs(
            snoise3(nu * FREQUENCY, nv * FREQUENCY, time * SPEED)
          );

          // Gamma correction to spread the value range
          const corrected = Math.pow(noiseVal, 1 / GAMMA);

          // Map to character — high corrected = dense chars like @
          const ci = Math.floor(corrected * (CHARS.length - 1));
          const char = CHARS[Math.max(0, Math.min(ci, CHARS.length - 1))];

          // Soft edge fade — only the last 10% at bottom
          const vFade = nv > 0.9 ? 1 - (nv - 0.9) / 0.1 : 1;

          // Strong alpha — wave peaks very visible, troughs dim but present
          const alpha = (0.02 + corrected * 0.12) * vFade;

          if (alpha < 0.005) continue;

          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fillText(char, x, y);
        }
      }

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
