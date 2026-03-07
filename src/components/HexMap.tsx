// ═══════════════════════════════════════════════════════════════
// CHIRON RISING — Hex Map Canvas Renderer v2
// Textured terrain, elevation shading, coastlines, animated fungus
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState } from "react";
import {
  hexToPixel, hexCorners, pixelToHex, hexKey, hexNeighbors,
  MapTile, Terrain, Moisture,
} from "../game/hexMap";
import { GameState, UnitType, getTileVisibility } from "../game/gameState";

interface HexMapProps {
  gameState: GameState;
  onTileClick: (q: number, r: number) => void;
  onTileRightClick: (q: number, r: number) => void;
  onCameraChange?: (x: number, y: number, zoom: number, viewW: number, viewH: number) => void;
  setCameraTo?: { x: number; y: number } | null;
}

const HEX_SIZE = 20;

// ─── Deterministic hash for per-tile variation ────────────────

// roundRect polyfill for canvas
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  const radii = typeof r === "number" ? [r, r, r, r] : [...r, r, r, r].slice(0, 4);
  ctx.moveTo(x + radii[0], y);
  ctx.lineTo(x + w - radii[1], y);
  ctx.arcTo(x + w, y, x + w, y + radii[1], radii[1]);
  ctx.lineTo(x + w, y + h - radii[2]);
  ctx.arcTo(x + w, y + h, x + w - radii[2], y + h, radii[2]);
  ctx.lineTo(x + radii[3], y + h);
  ctx.arcTo(x, y + h, x, y + h - radii[3], radii[3]);
  ctx.lineTo(x, y + radii[0]);
  ctx.arcTo(x, y, x + radii[0], y, radii[0]);
  ctx.closePath();
}


function tileHash(q: number, r: number, salt: number = 0): number {
  let h = ((q * 374761393 + r * 668265263 + salt) & 0xffffffff) >>> 0;
  h = (((h ^ (h >> 13)) * 1274126177) & 0xffffffff) >>> 0;
  return (h >>> 0) / 0xffffffff;
}

// ─── Color Utilities ──────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (Math.max(0,Math.min(255,r)) << 16) + (Math.max(0,Math.min(255,g)) << 8) + Math.max(0,Math.min(255,b))).toString(16).slice(1);
}

function brighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(Math.round(r + amount), Math.round(g + amount), Math.round(b + amount));
}

// ─── Terrain Palette ──────────────────────────────────────────

function getTerrainPalette(tile: MapTile) {
  const v = (tileHash(tile.q, tile.r) - 0.5) * 10;
  const v2 = (tileHash(tile.q, tile.r, 7) - 0.5) * 6;
  const b = (s: string) => brighten(s, v);

  // Elevation tint — higher = slightly brighter
  const elev = tile.elevation / 255;
  const elvBright = Math.floor(elev * 8);

  if (tile.terrain === Terrain.DeepOcean) return { base: b("#050d1a"), hi: "#0a1830", lo: "#020810", accent: "#0e2040" };
  if (tile.terrain === Terrain.Ocean) return { base: b("#0b1a32"), hi: "#102848", lo: "#061020", accent: "#1a3858" };
  if (tile.terrain === Terrain.Shelf) return { base: b("#142a48"), hi: "#1e3c60", lo: "#0e2038", accent: "#2a4a70" };

  if (tile.terrain === Terrain.Flat) {
    if (tile.moisture === Moisture.Rainy) return { base: brighten("#1a4414", v + v2), hi: brighten("#285a20", elvBright), lo: "#0e3008", accent: "#2a6a22" };
    if (tile.moisture === Moisture.Moderate) return { base: brighten("#345e22", v + v2), hi: brighten("#467030", elvBright), lo: "#264c18", accent: "#4a8030" };
    return { base: brighten("#5a6a2a", v + v2), hi: brighten("#6a7a36", elvBright), lo: "#4a5a1e", accent: "#7a8a38" };
  }
  if (tile.terrain === Terrain.Rolling) {
    if (tile.moisture === Moisture.Rainy) return { base: brighten("#244e1c", v + v2), hi: brighten("#306228", elvBright), lo: "#1a3c14", accent: "#387030" };
    if (tile.moisture === Moisture.Moderate) return { base: brighten("#406828", v + v2), hi: brighten("#527a34", elvBright), lo: "#305620", accent: "#5a8a38" };
    return { base: brighten("#6a7a32", v + v2), hi: brighten("#7a8a3e", elvBright), lo: "#5a6a26", accent: "#8a9a44" };
  }
  if (tile.terrain === Terrain.Hills) return { base: brighten("#4e5640", v), hi: brighten("#5e664e", elvBright), lo: "#3e4632", accent: "#6a7458" };
  if (tile.terrain === Terrain.Mountains) return { base: brighten("#6a6a60", v), hi: brighten("#808078", elvBright), lo: "#4a4a42", accent: "#909088" };

  return { base: "#333333", hi: "#444444", lo: "#222222", accent: "#555555" };
}

// ─── Water check ──────────────────────────────────────────────

function isWater(t: Terrain): boolean {
  return t === Terrain.DeepOcean || t === Terrain.Ocean || t === Terrain.Shelf;
}

// ─── Draw one hex tile (textured) ─────────────────────────────

function drawTile(ctx: CanvasRenderingContext2D, center: { x: number; y: number }, tile: MapTile, size: number, time: number) {
  const pal = getTerrainPalette(tile);
  const corners = hexCorners(center, size);

  ctx.save();
  ctx.beginPath();
  corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
  ctx.closePath();
  ctx.clip();

  // Base fill
  ctx.fillStyle = pal.base;
  ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2);

  // Elevation shading (directional light from top-left)
  if (!isWater(tile.terrain)) {
    const grad = ctx.createLinearGradient(center.x - size, center.y - size, center.x + size, center.y + size);
    grad.addColorStop(0, pal.hi + "55");
    grad.addColorStop(0.45, "transparent");
    grad.addColorStop(1, pal.lo + "66");
    ctx.fillStyle = grad;
    ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2);
  }

  const h1 = tileHash(tile.q, tile.r, 1);
  const h2 = tileHash(tile.q, tile.r, 2);
  const h3 = tileHash(tile.q, tile.r, 3);
  const h4 = tileHash(tile.q, tile.r, 4);

  // ── Water: animated caustic shimmer ──
  if (tile.terrain === Terrain.DeepOcean || tile.terrain === Terrain.Ocean) {
    // Subtle moving caustic pattern
    const t1 = time * 0.0005;
    for (let i = 0; i < 4; i++) {
      const cx = center.x + (tileHash(tile.q, tile.r, 10 + i) - 0.5) * size * 1.4;
      const cy = center.y + (tileHash(tile.q, tile.r, 20 + i) - 0.5) * size * 1.4;
      const phase = Math.sin(t1 + i * 2.1 + tile.q * 0.4) * 0.5 + 0.5;
      const r = size * 0.2 + phase * size * 0.15;
      ctx.fillStyle = pal.hi + (Math.floor(phase * 12 + 6)).toString(16).padStart(2, "0");
      ctx.beginPath();
      ctx.arc(cx + Math.sin(t1 + i) * 2, cy + Math.cos(t1 * 0.7 + i) * 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Wave lines
    ctx.strokeStyle = pal.hi + "18";
    ctx.lineWidth = 0.6;
    const wo = Math.sin(time * 0.001 + tile.q * 0.5) * 2;
    for (let i = 0; i < 3; i++) {
      const y = center.y - size * 0.4 + i * size * 0.4 + wo;
      ctx.beginPath();
      ctx.moveTo(center.x - size * 0.7, y);
      ctx.quadraticCurveTo(center.x, y + (h1 - 0.5) * 5, center.x + size * 0.7, y);
      ctx.stroke();
    }
  }

  // ── Shelf: sandy with scattered pebbles ──
  if (tile.terrain === Terrain.Shelf) {
    ctx.fillStyle = pal.hi + "14";
    for (let i = 0; i < 6; i++) {
      const dx = (tileHash(tile.q, tile.r, 10 + i) - 0.5) * size * 1.2;
      const dy = (tileHash(tile.q, tile.r, 20 + i) - 0.5) * size * 1.2;
      ctx.beginPath();
      ctx.arc(center.x + dx, center.y + dy, 1 + tileHash(tile.q, tile.r, 30 + i) * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Grass/scrub with texture dots ──
  if (tile.terrain === Terrain.Flat || tile.terrain === Terrain.Rolling) {
    const dots = tile.moisture === Moisture.Rainy ? 10 : tile.moisture === Moisture.Moderate ? 6 : 3;
    for (let i = 0; i < dots; i++) {
      const dx = (tileHash(tile.q, tile.r, 40 + i) - 0.5) * size * 1.4;
      const dy = (tileHash(tile.q, tile.r, 50 + i) - 0.5) * size * 1.4;
      const dotSize = 0.8 + tileHash(tile.q, tile.r, 60 + i) * 2;
      ctx.fillStyle = (tile.moisture === Moisture.Rainy ? pal.accent : pal.lo) + "30";
      ctx.beginPath();
      ctx.arc(center.x + dx, center.y + dy, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rolling: subtle contour ridges
    if (tile.terrain === Terrain.Rolling) {
      ctx.strokeStyle = pal.lo + "28";
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 2; i++) {
        const ry = center.y + (h1 - 0.5 + i * 0.5) * size * 0.5;
        ctx.beginPath();
        ctx.moveTo(center.x - size * 0.6, ry);
        ctx.quadraticCurveTo(center.x + (h2 - 0.5) * size * 0.4, ry - size * 0.15, center.x + size * 0.6, ry + (h3 - 0.5) * size * 0.2);
        ctx.stroke();
      }
    }
  }

  // ── Hills: layered contour shading ──
  if (tile.terrain === Terrain.Hills) {
    // Multiple contour lines
    for (let i = 0; i < 3; i++) {
      const oy = (i - 1) * size * 0.35;
      const ox = (tileHash(tile.q, tile.r, 70 + i) - 0.5) * size * 0.3;
      ctx.strokeStyle = i === 1 ? pal.hi + "30" : pal.lo + "20";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(center.x - size * 0.55 + ox, center.y + oy);
      ctx.quadraticCurveTo(center.x + ox, center.y + oy - size * 0.15, center.x + size * 0.55 + ox, center.y + oy + (h1 - 0.5) * size * 0.15);
      ctx.stroke();
    }
    // Rocky texture dots
    for (let i = 0; i < 7; i++) {
      const dx = (tileHash(tile.q, tile.r, 80 + i) - 0.5) * size * 1.2;
      const dy = (tileHash(tile.q, tile.r, 90 + i) - 0.5) * size;
      ctx.fillStyle = pal.accent + "22";
      ctx.fillRect(center.x + dx - 1, center.y + dy - 1, 2, 2);
    }
  }

  // ── Mountains: dramatic layered peaks with snow caps ──
  if (tile.terrain === Terrain.Mountains) {
    // Main peak
    const px = center.x + (h1 - 0.5) * size * 0.25;
    const py = center.y - size * 0.4;

    // Shadow side
    ctx.fillStyle = pal.lo + "55";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + size * 0.05, center.y + size * 0.25);
    ctx.lineTo(px + size * 0.4, center.y + size * 0.25);
    ctx.closePath();
    ctx.fill();

    // Lit side
    ctx.fillStyle = pal.hi + "44";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - size * 0.4, center.y + size * 0.25);
    ctx.lineTo(px + size * 0.05, center.y + size * 0.25);
    ctx.closePath();
    ctx.fill();

    // Snow cap
    if (tile.elevation > 160) {
      const snowHeight = tile.elevation > 220 ? 0.35 : 0.22;
      ctx.fillStyle = `rgba(220,230,240,${tile.elevation > 220 ? 0.45 : 0.3})`;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - size * snowHeight * 0.5, py + size * snowHeight);
      ctx.lineTo(px + size * snowHeight * 0.5, py + size * snowHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Secondary peak
    if (h2 > 0.35) {
      const p2x = center.x + (h3 - 0.5) * size * 0.6;
      const p2y = center.y - size * 0.2;
      ctx.fillStyle = pal.lo + "38";
      ctx.beginPath();
      ctx.moveTo(p2x, p2y);
      ctx.lineTo(p2x - size * 0.22, center.y + size * 0.3);
      ctx.lineTo(p2x + size * 0.22, center.y + size * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    // Scree/rock texture
    for (let i = 0; i < 5; i++) {
      const dx = (tileHash(tile.q, tile.r, 100 + i) - 0.5) * size * 1.1;
      const dy = (tileHash(tile.q, tile.r, 110 + i) - 0.5) * size * 0.6 + size * 0.2;
      ctx.fillStyle = pal.accent + "18";
      ctx.fillRect(center.x + dx - 1, center.y + dy - 0.5, 2, 1.5);
    }
  }

  // ── Xenofungus (animated, glowing) ──
  if (tile.fungus) {
    const pulse = Math.sin(time * 0.002 + tile.q * 0.7 + tile.r * 0.5) * 0.15 + 0.85;

    // Ambient glow
    const glowGrad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, size * 0.9);
    glowGrad.addColorStop(0, `rgba(160, 30, 80, ${0.25 * pulse})`);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2);

    // Overlay
    ctx.fillStyle = `rgba(120, 28, 65, ${0.35 * pulse})`;
    ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2);

    // Tendrils
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 6; i++) {
      const a = tileHash(tile.q, tile.r, 120 + i) * Math.PI * 2;
      const len = size * 0.35 + tileHash(tile.q, tile.r, 130 + i) * size * 0.4;
      const w = Math.sin(time * 0.003 + i * 1.5) * 3;
      const sx = center.x + Math.cos(a) * size * 0.1;
      const sy = center.y + Math.sin(a) * size * 0.1;
      const ex = center.x + Math.cos(a) * len;
      const ey = center.y + Math.sin(a) * len;
      ctx.strokeStyle = `rgba(200, 45, 100, ${(0.4 + tileHash(tile.q, tile.r, 170 + i) * 0.2) * pulse})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + ex) / 2 + w, (sy + ey) / 2 + w, ex, ey);
      ctx.stroke();
    }

    // Glowing spore nodes
    for (let i = 0; i < 4; i++) {
      const dx = (tileHash(tile.q, tile.r, 140 + i) - 0.5) * size * 0.9;
      const dy = (tileHash(tile.q, tile.r, 150 + i) - 0.5) * size * 0.9;
      const nr = (1.2 + tileHash(tile.q, tile.r, 160 + i) * 2) * pulse;
      // Glow
      ctx.fillStyle = `rgba(255, 60, 130, ${0.15 * pulse})`;
      ctx.beginPath(); ctx.arc(center.x + dx, center.y + dy, nr * 2, 0, Math.PI * 2); ctx.fill();
      // Core
      ctx.fillStyle = `rgba(220, 50, 110, ${0.7 * pulse})`;
      ctx.beginPath(); ctx.arc(center.x + dx, center.y + dy, nr, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── River (wider, with glow) ──
  if (tile.river && !isWater(tile.terrain)) {
    const rw = 1.8 + (tile.elevation < 150 ? 1.2 : 0);
    const ra = tileHash(tile.q, tile.r, 200) * Math.PI;
    const wb = (tileHash(tile.q, tile.r, 201) - 0.5) * size * 0.4;
    const rx1 = center.x + Math.cos(ra) * size * 0.75;
    const ry1 = center.y + Math.sin(ra) * size * 0.75;
    const rx2 = center.x - Math.cos(ra) * size * 0.75;
    const ry2 = center.y - Math.sin(ra) * size * 0.75;

    // River glow
    ctx.strokeStyle = "#3388cc18";
    ctx.lineWidth = rw + 4;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.quadraticCurveTo(center.x + wb, center.y - wb, rx2, ry2); ctx.stroke();
    // River bank
    ctx.strokeStyle = "#44aaee28";
    ctx.lineWidth = rw + 2;
    ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.quadraticCurveTo(center.x + wb, center.y - wb, rx2, ry2); ctx.stroke();
    // River water
    ctx.strokeStyle = "#2288ccbb";
    ctx.lineWidth = rw;
    ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.quadraticCurveTo(center.x + wb, center.y - wb, rx2, ry2); ctx.stroke();
    // Highlight
    ctx.strokeStyle = "#66ccff30";
    ctx.lineWidth = rw * 0.4;
    ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.quadraticCurveTo(center.x + wb * 0.8, center.y - wb * 0.8 - 1, rx2, ry2); ctx.stroke();
  }

  // ── Bonus resource (diamond with glow) ──
  if (tile.bonus) {
    // Glow
    ctx.fillStyle = "#ffcc0018";
    ctx.beginPath(); ctx.arc(center.x, center.y, 6, 0, Math.PI * 2); ctx.fill();
    // Diamond
    ctx.fillStyle = "#ffcc0066";
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - 3.5);
    ctx.lineTo(center.x + 3, center.y);
    ctx.lineTo(center.x, center.y + 3.5);
    ctx.lineTo(center.x - 3, center.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffcc00aa";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // ── Road ──
  if (tile.road) {
    drawImprovement(ctx, center, "road", size);
  }

  // ── Improvement ──
  if (tile.improvement) {
    drawImprovement(ctx, center, tile.improvement, size);
  }

  // ── Supply Pod ──
  if (tile.supplyPod) {
    const pulse = Math.sin(time * 0.003 + tile.q * 1.1 + tile.r * 0.7) * 0.15 + 0.85;
    // Glow
    ctx.fillStyle = `rgba(100, 200, 255, ${0.12 * pulse})`;
    ctx.beginPath(); ctx.arc(center.x, center.y, size * 0.45, 0, Math.PI * 2); ctx.fill();
    // Pod body (capsule shape)
    ctx.fillStyle = `rgba(180, 200, 220, ${0.7 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(center.x - size * 0.2, center.y - size * 0.15);
    ctx.lineTo(center.x + size * 0.2, center.y - size * 0.15);
    ctx.lineTo(center.x + size * 0.25, center.y + size * 0.05);
    ctx.lineTo(center.x + size * 0.15, center.y + size * 0.2);
    ctx.lineTo(center.x - size * 0.15, center.y + size * 0.2);
    ctx.lineTo(center.x - size * 0.25, center.y + size * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(100, 200, 255, ${0.6 * pulse})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Unity logo (small U)
    ctx.fillStyle = `rgba(60, 150, 220, ${0.8 * pulse})`;
    ctx.font = `bold ${size * 0.22}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("U", center.x, center.y + size * 0.02);
  }

  ctx.restore();
}

function drawImprovement(ctx: CanvasRenderingContext2D, c: { x: number; y: number }, type: string, size: number) {
  const s = size * 0.3;
  ctx.save();
  ctx.translate(c.x, c.y);

  if (type === "farm") {
    // Green field rows
    ctx.strokeStyle = "#44cc6680";
    ctx.lineWidth = 0.7;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(-s, i * s * 0.55); ctx.lineTo(s, i * s * 0.55); ctx.stroke();
    }
    // Cross lines
    ctx.strokeStyle = "#44cc6640";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * s * 0.55, -s * 0.7); ctx.lineTo(i * s * 0.55, s * 0.7); ctx.stroke();
    }
  } else if (type === "mine") {
    // Pickaxe shape
    ctx.strokeStyle = "#cc884499";
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.6); ctx.lineTo(s * 0.6, s * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.3); ctx.lineTo(-s * 0.3, -s * 0.6); ctx.stroke();
    // Ore dots
    ctx.fillStyle = "#cc884444";
    ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-s * 0.1, s * 0.3, 1, 0, Math.PI * 2); ctx.fill();
  } else if (type === "solar") {
    // Solar panel with rays
    ctx.strokeStyle = "#ffcc4488";
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffcc4422";
    ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
      ctx.lineTo(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8);
      ctx.stroke();
    }
  } else if (type === "forest") {
    // Multiple layered trees
    for (let t = 0; t < 3; t++) {
      const tx = (t - 1) * s * 0.45;
      const ty = (t === 1 ? -s * 0.15 : s * 0.1);
      const ts = s * (t === 1 ? 0.85 : 0.65);
      ctx.fillStyle = t === 1 ? "#1c7030bb" : "#1c703088";
      ctx.beginPath();
      ctx.moveTo(tx, ty - ts * 0.9);
      ctx.lineTo(tx - ts * 0.5, ty + ts * 0.35);
      ctx.lineTo(tx + ts * 0.5, ty + ts * 0.35);
      ctx.closePath();
      ctx.fill();
    }
    // Trunks
    ctx.fillStyle = "#55381888";
    ctx.fillRect(-s * 0.06, s * 0.15, s * 0.12, s * 0.25);
  } else if (type === "road") {
    // Dashed road line
    ctx.strokeStyle = "#aa997766";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([2.5, 2]);
    ctx.beginPath(); ctx.moveTo(-s * 1.1, 0); ctx.lineTo(s * 1.1, 0); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// ─── Unit Icon Renderer ───────────────────────────────────────

function drawUnitIcon(ctx: CanvasRenderingContext2D, x: number, y: number, type: UnitType, color: string, size: number) {
  const s = size;
  ctx.save();
  ctx.translate(x, y);

  switch (type) {
    case UnitType.Colony: {
      // Dome/pod shape — curved top with base
      ctx.fillStyle = color + "66";
      ctx.beginPath();
      ctx.arc(0, -s * 0.05, s * 0.55, Math.PI, 0); // dome top
      ctx.lineTo(s * 0.55, s * 0.3);
      ctx.lineTo(-s * 0.55, s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Window lights
      ctx.fillStyle = color;
      ctx.fillRect(-s * 0.2, s * 0.0, s * 0.12, s * 0.1);
      ctx.fillRect(s * 0.08, s * 0.0, s * 0.12, s * 0.1);
      // Base platform
      ctx.fillStyle = color + "44";
      ctx.fillRect(-s * 0.6, s * 0.3, s * 1.2, s * 0.12);
      break;
    }
    case UnitType.Former: {
      // Bulldozer/terraformer — tracked vehicle with blade
      ctx.fillStyle = color + "55";
      // Body
      ctx.fillRect(-s * 0.35, -s * 0.2, s * 0.7, s * 0.35);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(-s * 0.35, -s * 0.2, s * 0.7, s * 0.35);
      // Blade (front)
      ctx.fillStyle = color + "88";
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, s * 0.15);
      ctx.lineTo(-s * 0.5, -s * 0.3);
      ctx.lineTo(-s * 0.35, -s * 0.2);
      ctx.lineTo(-s * 0.35, s * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Tracks
      ctx.fillStyle = color + "33";
      ctx.fillRect(-s * 0.4, s * 0.15, s * 0.8, s * 0.1);
      // Cab window
      ctx.fillStyle = color;
      ctx.fillRect(s * 0.05, -s * 0.12, s * 0.2, s * 0.12);
      break;
    }
    case UnitType.Scout: {
      // Binoculars/recon — light vehicle silhouette
      ctx.fillStyle = color + "55";
      // Low-profile body
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, s * 0.15);
      ctx.lineTo(-s * 0.35, -s * 0.15);
      ctx.lineTo(s * 0.35, -s * 0.15);
      ctx.lineTo(s * 0.5, s * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Antenna
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.15);
      ctx.lineTo(s * 0.15, -s * 0.5);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(s * 0.15, -s * 0.5, 1.5, 0, Math.PI * 2); ctx.fill();
      // Scope
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, -s * 0.15);
      ctx.lineTo(-s * 0.25, -s * 0.4);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.4, s * 0.1, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case UnitType.Infantry: {
      // Soldier silhouette — figure with weapon
      ctx.fillStyle = color + "66";
      // Torso
      ctx.fillRect(-s * 0.15, -s * 0.15, s * 0.3, s * 0.35);
      // Head
      ctx.beginPath(); ctx.arc(0, -s * 0.28, s * 0.14, 0, Math.PI * 2); ctx.fill();
      // Legs
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-s * 0.05, s * 0.2); ctx.lineTo(-s * 0.2, s * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.05, s * 0.2); ctx.lineTo(s * 0.15, s * 0.5); ctx.stroke();
      // Weapon (rifle)
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(s * 0.15, -s * 0.1);
      ctx.lineTo(s * 0.5, -s * 0.35);
      ctx.stroke();
      // Helmet detail
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, -s * 0.32, s * 0.08, Math.PI, 0); ctx.fill();
      break;
    }
    case UnitType.Speeder: {
      // Fast attack vehicle — angular rover
      ctx.fillStyle = color + "55";
      // Body — angular wedge shape
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, s * 0.15);
      ctx.lineTo(-s * 0.3, -s * 0.15);
      ctx.lineTo(s * 0.15, -s * 0.25);
      ctx.lineTo(s * 0.55, -s * 0.05);
      ctx.lineTo(s * 0.55, s * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Turret
      ctx.fillStyle = color + "77";
      ctx.fillRect(-s * 0.15, -s * 0.3, s * 0.25, s * 0.15);
      ctx.strokeRect(-s * 0.15, -s * 0.3, s * 0.25, s * 0.15);
      // Gun barrel
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.22);
      ctx.lineTo(s * 0.5, -s * 0.22);
      ctx.stroke();
      // Wheels
      ctx.fillStyle = color + "44";
      ctx.beginPath(); ctx.arc(-s * 0.3, s * 0.2, s * 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.3, s * 0.2, s * 0.1, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case UnitType.Mindworm: {
      // Alien worm — segmented body with tendrils and glowing nodes
      ctx.strokeStyle = "#cc2266";
      ctx.lineWidth = 2;
      // Segmented body
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, s * 0.05);
      ctx.quadraticCurveTo(-s * 0.3, -s * 0.35, 0, 0);
      ctx.quadraticCurveTo(s * 0.3, s * 0.35, s * 0.55, s * 0.05);
      ctx.stroke();
      // Segments
      ctx.fillStyle = "#cc226644";
      for (let i = 0; i < 4; i++) {
        const t = (i + 1) / 5;
        const sx = -s * 0.6 + t * s * 1.15;
        const sy = Math.sin(t * Math.PI) * -s * 0.15 + s * 0.05;
        ctx.beginPath(); ctx.arc(sx, sy, s * 0.1, 0, Math.PI * 2); ctx.fill();
      }
      // Head with glowing eye
      ctx.fillStyle = "#ff2266";
      ctx.beginPath(); ctx.arc(s * 0.55, s * 0.05, s * 0.12, 0, Math.PI * 2); ctx.fill();
      // Eye glow
      ctx.fillStyle = "#ff448833";
      ctx.beginPath(); ctx.arc(s * 0.55, s * 0.05, s * 0.25, 0, Math.PI * 2); ctx.fill();
      // Tendrils
      ctx.strokeStyle = "#cc226688";
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.05); ctx.lineTo(-s * 0.7, -s * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.05); ctx.lineTo(-s * 0.75, s * 0.2); ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

// ─── Main Component ───────────────────────────────────────────

export default function HexMap({ gameState, onTileClick, onTileRightClick, onCameraChange, setCameraTo }: HexMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cameraStart, setCameraStart] = useState({ x: 0, y: 0 });
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);

  const { map, units, bases, selectedUnit, selectedTile, factions, currentFaction } = gameState;

  // Handle external camera set (e.g. from minimap click)
  useEffect(() => {
    if (setCameraTo) {
      setCamera({ x: -setCameraTo.x, y: -setCameraTo.y });
    }
  }, [setCameraTo]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    ctx.fillStyle = "#040810";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(camera.x + width / 2, camera.y + height / 2);
    ctx.scale(zoom, zoom);

    const vl = (-camera.x - width / 2) / zoom - HEX_SIZE * 2;
    const vr = (-camera.x + width / 2) / zoom + HEX_SIZE * 2;
    const vt = (-camera.y - height / 2) / zoom - HEX_SIZE * 2;
    const vb = (-camera.y + height / 2) / zoom + HEX_SIZE * 2;

    // Pass 1: Terrain
    for (const [key, tile] of map.tiles) {
      const c = hexToPixel({ q: tile.q, r: tile.r }, HEX_SIZE);
      if (c.x < vl || c.x > vr || c.y < vt || c.y > vb) continue;

      const vis = getTileVisibility(gameState, key);
      if (vis === "hidden") {
        // Draw black hex
        const corners = hexCorners(c, HEX_SIZE);
        ctx.fillStyle = "#030508";
        ctx.beginPath();
        corners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();
        // Subtle edge to show hex grid in fog
        ctx.strokeStyle = "#0a0f1808";
        ctx.lineWidth = 0.5;
        ctx.stroke();
        continue;
      }

      drawTile(ctx, c, tile, HEX_SIZE, time);

      // Explored but not currently visible = dim overlay
      if (vis === "explored") {
        const corners = hexCorners(c, HEX_SIZE);
        ctx.fillStyle = "rgba(4, 8, 16, 0.55)";
        ctx.beginPath();
        corners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();
      }
    }

    // Pass 2: Coastlines (only on visible/explored tiles)
    for (const [key, tile] of map.tiles) {
      if (isWater(tile.terrain)) continue;
      const vis = getTileVisibility(gameState, key);
      if (vis === "hidden") continue;
      const c = hexToPixel({ q: tile.q, r: tile.r }, HEX_SIZE);
      if (c.x < vl || c.x > vr || c.y < vt || c.y > vb) continue;

      const opacity = vis === "explored" ? "18" : "30";
      const glowOpacity = vis === "explored" ? "08" : "12";

      const neighbors = hexNeighbors({ q: tile.q, r: tile.r });
      const corners = hexCorners(c, HEX_SIZE);
      neighbors.forEach((n, i) => {
        const nt = map.tiles.get(hexKey(n.q, n.r));
        if (!nt || isWater(nt.terrain)) {
          const c1 = corners[i];
          const c2 = corners[(i + 1) % 6];
          ctx.strokeStyle = "#88bbcc" + opacity;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
          ctx.strokeStyle = "#88bbcc" + glowOpacity;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
        }
      });
    }

    // Pass 2.5: Fog of war edge glow (boundary between explored/visible and hidden)
    for (const [key, tile] of map.tiles) {
      const vis = getTileVisibility(gameState, key);
      if (vis === "hidden") continue;
      const c = hexToPixel({ q: tile.q, r: tile.r }, HEX_SIZE);
      if (c.x < vl || c.x > vr || c.y < vt || c.y > vb) continue;

      const corners = hexCorners(c, HEX_SIZE);
      hexNeighbors({ q: tile.q, r: tile.r }).forEach((n, i) => {
        const nKey = hexKey(n.q, n.r);
        const nVis = getTileVisibility(gameState, nKey);
        if (nVis === "hidden") {
          const c1 = corners[i];
          const c2 = corners[(i + 1) % 6];
          // Subtle fog edge
          ctx.strokeStyle = "#0a1420aa";
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
          ctx.strokeStyle = "#18283844";
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
        }
      });
    }

    // Pass 3: Territory borders (only visible/explored)
    for (const [key, tile] of map.tiles) {
      if (tile.owner === null || tile.owner < 0) continue;
      const vis = getTileVisibility(gameState, key);
      if (vis === "hidden") continue;
      const c = hexToPixel({ q: tile.q, r: tile.r }, HEX_SIZE);
      if (c.x < vl || c.x > vr || c.y < vt || c.y > vb) continue;
      const faction = factions[tile.owner];
      if (!faction) continue;

      const corners = hexCorners(c, HEX_SIZE);
      hexNeighbors({ q: tile.q, r: tile.r }).forEach((n, i) => {
        const nt = map.tiles.get(hexKey(n.q, n.r));
        if (!nt || nt.owner !== tile.owner) {
          ctx.strokeStyle = faction.color + "55";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(corners[i].x, corners[i].y);
          ctx.lineTo(corners[(i + 1) % 6].x, corners[(i + 1) % 6].y);
          ctx.stroke();
        }
      });
    }

    // Pass 4: Selections & hover (only on explored/visible tiles)
    for (const [key, tile] of map.tiles) {
      const vis = getTileVisibility(gameState, key);
      if (vis === "hidden") continue;
      const c = hexToPixel({ q: tile.q, r: tile.r }, HEX_SIZE);
      if (c.x < vl || c.x > vr || c.y < vt || c.y > vb) continue;
      const corners = hexCorners(c, HEX_SIZE);

      if (key === selectedTile) {
        ctx.strokeStyle = "#ffffff66";
        ctx.lineWidth = 2;
        ctx.beginPath(); corners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = "#ffffff18";
        ctx.lineWidth = 5;
        ctx.beginPath(); corners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
      } else if (key === hoveredTile) {
        ctx.strokeStyle = "#ffffff22";
        ctx.lineWidth = 1;
        ctx.beginPath(); corners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
      }
    }

    // Pass 5: Movement range
    if (selectedUnit) {
      const unit = units.get(selectedUnit);
      if (unit && unit.movesLeft > 0 && unit.owner === currentFaction) {
        for (const n of hexNeighbors({ q: unit.q, r: unit.r })) {
          const nt = map.tiles.get(hexKey(n.q, n.r));
          if (nt && !isWater(nt.terrain)) {
            const nc = hexToPixel(n, HEX_SIZE);
            const nCorners = hexCorners(nc, HEX_SIZE);
            ctx.strokeStyle = "#ffffff20";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); nCorners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    }

    // Pass 6: Bases (only visible, or explored for own bases)
    for (const [, base] of bases) {
      const bKey = hexKey(base.q, base.r);
      const vis = getTileVisibility(gameState, bKey);
      // Only show bases we can currently see, or our own bases in explored territory
      if (vis === "hidden") continue;
      if (vis === "explored" && base.owner !== currentFaction) continue;

      const c = hexToPixel({ q: base.q, r: base.r }, HEX_SIZE);
      if (c.x < vl || c.x > vr || c.y < vt || c.y > vb) continue;
      const faction = factions[base.owner];
      const color = faction?.color || "#ffffff";
      const dimAlpha = vis === "explored" ? 0.4 : 1.0;

      // Base glow
      const baseGlow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, HEX_SIZE);
      baseGlow.addColorStop(0, color + "18");
      baseGlow.addColorStop(1, "transparent");
      ctx.fillStyle = baseGlow;
      ctx.beginPath(); ctx.arc(c.x, c.y, HEX_SIZE, 0, Math.PI * 2); ctx.fill();

      // Building silhouettes (small rectangles around base)
      const numBuildings = Math.min(base.facilities.length, 8);
      ctx.fillStyle = color + "44";
      for (let i = 0; i < numBuildings; i++) {
        const a = (i / Math.max(numBuildings, 1)) * Math.PI * 2 - Math.PI / 2;
        const bx = c.x + Math.cos(a) * HEX_SIZE * 0.6;
        const by = c.y + Math.sin(a) * HEX_SIZE * 0.6;
        const bw = 2 + (i % 3);
        const bh = 3 + (i % 2) * 2;
        ctx.fillRect(bx - bw / 2, by - bh, bw, bh);
      }

      // Base circle
      ctx.fillStyle = "#080c14ee";
      ctx.beginPath(); ctx.arc(c.x, c.y, HEX_SIZE * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, HEX_SIZE * 0.5, 0, Math.PI * 2); ctx.stroke();

      // Population number
      ctx.fillStyle = color;
      ctx.font = `bold ${HEX_SIZE * 0.5}px Rajdhani, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(base.population), c.x, c.y + 1);

      // Base name label with background
      const nameWidth = ctx.measureText(base.name).width;
      ctx.fillStyle = "#080c14cc";
      ctx.fillRect(c.x - nameWidth / 2 - 3, c.y + HEX_SIZE * 0.7, nameWidth + 6, HEX_SIZE * 0.42);
      ctx.fillStyle = color + "cc";
      ctx.font = `500 ${HEX_SIZE * 0.36}px Rajdhani, sans-serif`;
      ctx.fillText(base.name, c.x, c.y + HEX_SIZE * 0.9);
    }

    // Pass 7: Units (only on currently visible tiles — no peeking in fog!)
    for (const [, unit] of units) {
      const uKey = hexKey(unit.q, unit.r);
      const vis = getTileVisibility(gameState, uKey);
      // Only show units on visible tiles (own units always visible, enemies only if in sight)
      if (vis !== "visible" && unit.owner !== currentFaction) continue;
      if (vis === "hidden") continue;
      const c = hexToPixel({ q: unit.q, r: unit.r }, HEX_SIZE);
      if (c.x < vl || c.x > vr || c.y < vt || c.y > vb) continue;

      let color = "#888888";
      if (unit.owner === -1) color = "#cc2266";
      else if (unit.owner >= 0 && unit.owner < factions.length) color = factions[unit.owner].color;

      const hasBase = Array.from(bases.values()).some(b => b.q === unit.q && b.r === unit.r);
      const oy = hasBase ? -HEX_SIZE * 0.65 : 0;
      const ux = c.x, uy = c.y + oy;

      // Selection ring
      if (unit.id === selectedUnit) {
        const pulse = Math.sin(time * 0.005) * 1.5;
        ctx.strokeStyle = "#ffffffbb"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ux, uy, HEX_SIZE * 0.55 + pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#ffffff22"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ux, uy, HEX_SIZE * 0.65 + pulse, 0, Math.PI * 2); ctx.stroke();
      }

      // Unit shield — SMAC-style rounded rectangle
      const sw = HEX_SIZE * 0.8; // shield width
      const sh = HEX_SIZE * 0.85; // shield height
      const sr = 3; // corner radius
      const sx = ux - sw / 2;
      const sy = uy - sh / 2;

      // Shadow
      ctx.fillStyle = "#00000066";
      ctx.beginPath();
      drawRoundRect(ctx, sx + 1, sy + 1, sw, sh, sr);
      ctx.fill();

      // Shield background
      ctx.fillStyle = "#0a0e18ee";
      ctx.beginPath();
      drawRoundRect(ctx, sx, sy, sw, sh, sr);
      ctx.fill();

      // Faction color stripe (left edge)
      ctx.fillStyle = color + "cc";
      ctx.beginPath();
      drawRoundRect(ctx, sx, sy, 3.5, sh, [sr, 0, 0, sr]);
      ctx.fill();

      // Shield border
      ctx.strokeStyle = color + "88";
      ctx.lineWidth = 1;
      ctx.beginPath();
      drawRoundRect(ctx, sx, sy, sw, sh, sr);
      ctx.stroke();

      // Unit silhouette — draw larger for visibility
      drawUnitIcon(ctx, ux + 1, uy - sh * 0.08, unit.type, color, HEX_SIZE * 0.35);

      // ── Stats bar at bottom of shield ──
      const barY = sy + sh - HEX_SIZE * 0.28;

      // Attack number (left, red bg)
      if (unit.attack > 0) {
        ctx.fillStyle = "#88222266";
        ctx.fillRect(sx + 1, barY, sw * 0.33, HEX_SIZE * 0.25);
        ctx.fillStyle = "#ff8866";
        ctx.font = `bold ${HEX_SIZE * 0.22}px Rajdhani, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(unit.attack), sx + sw * 0.165, barY + HEX_SIZE * 0.13);
      }

      // Defense number (right, blue bg)
      ctx.fillStyle = "#22228866";
      ctx.fillRect(sx + sw * 0.67, barY, sw * 0.33 - 1, HEX_SIZE * 0.25);
      ctx.fillStyle = "#8888ff";
      ctx.font = `bold ${HEX_SIZE * 0.22}px Rajdhani, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(unit.defense), sx + sw * 0.835, barY + HEX_SIZE * 0.13);

      // Moves (center, green)
      ctx.fillStyle = "#22664422";
      ctx.fillRect(sx + sw * 0.33, barY, sw * 0.34, HEX_SIZE * 0.25);
      ctx.fillStyle = unit.movesLeft > 0 ? "#66ff88" : "#445566";
      ctx.fillText(String(unit.movesLeft), sx + sw * 0.5, barY + HEX_SIZE * 0.13);

      // Health bar (top of shield)
      if (unit.health < unit.maxHealth) {
        const bw = sw - 4, bh = 2, bx = sx + 2, by = sy + 2;
        const pct = unit.health / unit.maxHealth;
        ctx.fillStyle = "#0a0a0acc"; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = pct > 0.5 ? "#22cc55" : pct > 0.25 ? "#ccaa22" : "#cc3333";
        ctx.fillRect(bx, by, bw * pct, bh);
      }

      // Move indicator (green dot top-right when has moves)
      if (unit.owner === currentFaction && unit.movesLeft > 0) {
        ctx.fillStyle = "#22cc55";
        ctx.beginPath(); ctx.arc(sx + sw - 2, sy + 2, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // Orders indicator (small icon top-left)
      if (unit.orders) {
        ctx.fillStyle = "#44cc6688";
        ctx.font = `bold ${HEX_SIZE * 0.18}px Rajdhani, sans-serif`;
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        const orderChar: Record<string, string> = {
          auto: "A", auto_former: "T", auto_scout: "X", auto_patrol: "P",
          sentry: "S", hold: "H", fortify: "F",
        };
        ctx.fillText(orderChar[unit.orders] || "·", sx + 5, sy + 1);
      }
    }

    ctx.restore();
  }, [map, units, bases, factions, camera, zoom, hoveredTile, selectedUnit, selectedTile, currentFaction, gameState]);

  // ─── Animation Loop ──────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let af: number;
    let lastReportedCamera = "";
    const loop = (t: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, rect.width, rect.height, t);

      // Report camera changes (throttled)
      if (onCameraChange) {
        const camKey = `${camera.x},${camera.y},${zoom}`;
        if (camKey !== lastReportedCamera) {
          lastReportedCamera = camKey;
          onCameraChange(camera.x, camera.y, zoom, rect.width, rect.height);
        }
      }

      af = requestAnimationFrame(loop);
    };
    af = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(af);
  }, [draw]);

  // ─── Mouse Handlers ──────────────────────────────────────

  const getPos = (e: React.MouseEvent) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };

  const toHex = (sx: number, sy: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { q: 0, r: 0 };
    return pixelToHex((sx - camera.x - r.width / 2) / zoom, (sy - camera.y - r.height / 2) / zoom, HEX_SIZE);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { setIsDragging(true); setDragStart(getPos(e)); setCameraStart({ ...camera }); }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const p = getPos(e);
    if (isDragging) {
      setCamera({ x: cameraStart.x + (p.x - dragStart.x), y: cameraStart.y + (p.y - dragStart.y) });
    } else {
      const h = toHex(p.x, p.y);
      const k = hexKey(h.q, h.r);
      setHoveredTile(map.tiles.has(k) ? k : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const p = getPos(e);
    const moved = Math.abs(p.x - dragStart.x) + Math.abs(p.y - dragStart.y);
    setIsDragging(false);
    if (moved < 5 && e.button === 0) { const h = toHex(p.x, p.y); onTileClick(h.q, h.r); }
  };

  const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault(); const p = getPos(e); const h = toHex(p.x, p.y); onTileRightClick(h.q, h.r); };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      // Ctrl/Shift + scroll = pan
      setCamera(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    } else {
      // Plain scroll = zoom toward cursor
      const canvas = canvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2;
      const my = e.clientY - r.top - r.height / 2;

      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.3, Math.min(4.0, zoom * factor));
      const scale = newZoom / zoom;

      // Adjust camera so zoom centers on cursor position
      setCamera(prev => ({
        x: mx - scale * (mx - prev.x),
        y: my - scale * (my - prev.y),
      }));
      setZoom(newZoom);
    }
  };

  return (
    <canvas ref={canvasRef}
      style={{ width: "100%", height: "100%", cursor: isDragging ? "grabbing" : "grab", display: "block" }}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu} onWheel={handleWheel}
    />
  );
}
