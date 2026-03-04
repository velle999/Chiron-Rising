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
}

const HEX_SIZE = 20;

// ─── Deterministic hash for per-tile variation ────────────────

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
  const v = (tileHash(tile.q, tile.r) - 0.5) * 12;
  const b = (s: string) => brighten(s, v);

  if (tile.terrain === Terrain.DeepOcean) return { base: b("#06101f"), hi: "#0a1830", lo: "#030810" };
  if (tile.terrain === Terrain.Ocean) return { base: b("#0c1e3a"), hi: "#102848", lo: "#081428" };
  if (tile.terrain === Terrain.Shelf) return { base: b("#163050"), hi: "#1e3c60", lo: "#102444" };

  if (tile.terrain === Terrain.Flat) {
    if (tile.moisture === Moisture.Rainy) return { base: b("#1e4a18"), hi: "#2a5a22", lo: "#143810" };
    if (tile.moisture === Moisture.Moderate) return { base: b("#3a6828"), hi: "#4a7a34", lo: "#2a5218" };
    return { base: b("#6a7a32"), hi: "#7a8a3e", lo: "#5a6a26" };
  }
  if (tile.terrain === Terrain.Rolling) {
    if (tile.moisture === Moisture.Rainy) return { base: b("#2a5420"), hi: "#366630", lo: "#1e4218" };
    if (tile.moisture === Moisture.Moderate) return { base: b("#4a7230"), hi: "#5a843c", lo: "#3a6024" };
    return { base: b("#7a8a3a"), hi: "#8a9a46", lo: "#6a7a2e" };
  }
  if (tile.terrain === Terrain.Hills) return { base: b("#5a6048"), hi: "#6a7058", lo: "#4a503a" };
  if (tile.terrain === Terrain.Mountains) return { base: b("#7a7a72"), hi: "#909088", lo: "#5a5a52" };

  return { base: "#333333", hi: "#444444", lo: "#222222" };
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

  // Elevation shading (light from top-left)
  if (!isWater(tile.terrain)) {
    const grad = ctx.createLinearGradient(center.x - size, center.y - size, center.x + size, center.y + size);
    grad.addColorStop(0, pal.hi + "44");
    grad.addColorStop(0.5, "transparent");
    grad.addColorStop(1, pal.lo + "55");
    ctx.fillStyle = grad;
    ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2);
  }

  // ── Per-terrain details ──
  const h1 = tileHash(tile.q, tile.r, 1);
  const h2 = tileHash(tile.q, tile.r, 2);
  const h3 = tileHash(tile.q, tile.r, 3);

  // Ocean waves
  if (tile.terrain === Terrain.DeepOcean || tile.terrain === Terrain.Ocean) {
    ctx.strokeStyle = pal.hi + "20";
    ctx.lineWidth = 0.5;
    const wo = Math.sin(time * 0.001 + tile.q * 0.5) * 2;
    for (let i = 0; i < 3; i++) {
      const y = center.y - size * 0.4 + i * size * 0.4 + wo;
      ctx.beginPath();
      ctx.moveTo(center.x - size * 0.6, y);
      ctx.quadraticCurveTo(center.x, y + (h1 - 0.5) * 4, center.x + size * 0.6, y);
      ctx.stroke();
    }
  }

  // Shelf sand dots
  if (tile.terrain === Terrain.Shelf) {
    ctx.fillStyle = pal.hi + "18";
    for (let i = 0; i < 4; i++) {
      const dx = (tileHash(tile.q, tile.r, 10 + i) - 0.5) * size * 1.2;
      const dy = (tileHash(tile.q, tile.r, 20 + i) - 0.5) * size * 1.2;
      ctx.beginPath();
      ctx.arc(center.x + dx, center.y + dy, tileHash(tile.q, tile.r, 30 + i) * 3 + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Grass/scrub
  if (tile.terrain === Terrain.Flat || tile.terrain === Terrain.Rolling) {
    const dots = tile.moisture === Moisture.Rainy ? 8 : tile.moisture === Moisture.Moderate ? 5 : 3;
    for (let i = 0; i < dots; i++) {
      const dx = (tileHash(tile.q, tile.r, 40 + i) - 0.5) * size * 1.4;
      const dy = (tileHash(tile.q, tile.r, 50 + i) - 0.5) * size * 1.4;
      ctx.fillStyle = (tile.moisture === Moisture.Rainy ? pal.hi : pal.lo) + "33";
      ctx.beginPath();
      ctx.arc(center.x + dx, center.y + dy, 1 + tileHash(tile.q, tile.r, 60 + i) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (tile.terrain === Terrain.Rolling) {
      ctx.strokeStyle = pal.lo + "30";
      ctx.lineWidth = 0.8;
      const ry = center.y + (h1 - 0.5) * size * 0.6;
      ctx.beginPath();
      ctx.moveTo(center.x - size * 0.5, ry);
      ctx.quadraticCurveTo(center.x, ry - size * 0.2, center.x + size * 0.5, ry + size * 0.1);
      ctx.stroke();
    }
  }

  // Hill contours
  if (tile.terrain === Terrain.Hills) {
    ctx.strokeStyle = pal.hi + "28";
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 2; i++) {
      const oy = (i - 0.5) * size * 0.5;
      ctx.beginPath();
      ctx.moveTo(center.x - size * 0.5, center.y + oy);
      ctx.quadraticCurveTo(center.x, center.y + oy + (tileHash(tile.q, tile.r, 70 + i) - 0.5) * size * 0.3, center.x + size * 0.5, center.y + oy);
      ctx.stroke();
    }
    ctx.fillStyle = pal.hi + "22";
    for (let i = 0; i < 5; i++) {
      const dx = (tileHash(tile.q, tile.r, 80 + i) - 0.5) * size * 1.2;
      const dy = (tileHash(tile.q, tile.r, 90 + i) - 0.5) * size;
      ctx.fillRect(center.x + dx - 1, center.y + dy - 1, 2, 2);
    }
  }

  // Mountain peaks
  if (tile.terrain === Terrain.Mountains) {
    const px = center.x + (h1 - 0.5) * size * 0.3;
    const py = center.y - size * 0.35;
    ctx.fillStyle = pal.hi + "40";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - size * 0.35, center.y + size * 0.2);
    ctx.lineTo(px + size * 0.35, center.y + size * 0.2);
    ctx.closePath();
    ctx.fill();

    if (tile.elevation > 200) {
      ctx.fillStyle = "#ffffff30";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - size * 0.15, py + size * 0.2);
      ctx.lineTo(px + size * 0.15, py + size * 0.2);
      ctx.closePath();
      ctx.fill();
    }

    if (h2 > 0.4) {
      ctx.fillStyle = pal.lo + "35";
      const p2x = center.x + (h3 - 0.5) * size * 0.6;
      ctx.beginPath();
      ctx.moveTo(p2x, center.y - size * 0.15);
      ctx.lineTo(p2x - size * 0.2, center.y + size * 0.25);
      ctx.lineTo(p2x + size * 0.2, center.y + size * 0.25);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = pal.lo + "25";
    for (let i = 0; i < 6; i++) {
      const dx = (tileHash(tile.q, tile.r, 100 + i) - 0.5) * size * 1.2;
      const dy = (tileHash(tile.q, tile.r, 110 + i) - 0.5) * size * 0.8 + size * 0.15;
      ctx.fillRect(center.x + dx - 0.5, center.y + dy - 0.5, 1.5, 1.5);
    }
  }

  // ── Xenofungus (animated) ──
  if (tile.fungus) {
    const pulse = Math.sin(time * 0.002 + tile.q * 0.7 + tile.r * 0.5) * 0.15 + 0.85;
    ctx.fillStyle = `rgba(139, 34, 82, ${0.45 * pulse})`;
    ctx.fillRect(center.x - size, center.y - size, size * 2, size * 2);

    ctx.strokeStyle = `rgba(180, 40, 90, ${0.5 * pulse})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const a = tileHash(tile.q, tile.r, 120 + i) * Math.PI * 2;
      const len = size * 0.4 + tileHash(tile.q, tile.r, 130 + i) * size * 0.4;
      const w = Math.sin(time * 0.003 + i * 1.5) * 3;
      const sx = center.x + Math.cos(a) * size * 0.1;
      const sy = center.y + Math.sin(a) * size * 0.1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + center.x + Math.cos(a) * len) / 2 + w, (sy + center.y + Math.sin(a) * len) / 2 + w, center.x + Math.cos(a) * len, center.y + Math.sin(a) * len);
      ctx.stroke();
    }

    ctx.fillStyle = `rgba(200, 50, 100, ${0.6 * pulse})`;
    for (let i = 0; i < 3; i++) {
      const dx = (tileHash(tile.q, tile.r, 140 + i) - 0.5) * size;
      const dy = (tileHash(tile.q, tile.r, 150 + i) - 0.5) * size;
      ctx.beginPath();
      ctx.arc(center.x + dx, center.y + dy, (1.5 + tileHash(tile.q, tile.r, 160 + i) * 2) * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── River ──
  if (tile.river && !isWater(tile.terrain)) {
    const rw = 1.5 + (tile.elevation < 150 ? 1 : 0);
    const ra = tileHash(tile.q, tile.r, 200) * Math.PI;
    const wb = (tileHash(tile.q, tile.r, 201) - 0.5) * size * 0.4;
    const rx1 = center.x + Math.cos(ra) * size * 0.7;
    const ry1 = center.y + Math.sin(ra) * size * 0.7;
    const rx2 = center.x - Math.cos(ra) * size * 0.7;
    const ry2 = center.y - Math.sin(ra) * size * 0.7;

    ctx.strokeStyle = "#44aaee22";
    ctx.lineWidth = rw + 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(rx1, ry1);
    ctx.quadraticCurveTo(center.x + wb, center.y - wb, rx2, ry2);
    ctx.stroke();

    ctx.strokeStyle = "#2288ccaa";
    ctx.lineWidth = rw;
    ctx.beginPath();
    ctx.moveTo(rx1, ry1);
    ctx.quadraticCurveTo(center.x + wb, center.y - wb, rx2, ry2);
    ctx.stroke();
  }

  // ── Bonus resource ──
  if (tile.bonus) {
    ctx.fillStyle = "#ffcc0055";
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - 3);
    ctx.lineTo(center.x + 2.5, center.y);
    ctx.lineTo(center.x, center.y + 3);
    ctx.lineTo(center.x - 2.5, center.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffcc0088";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // ── Road (drawn under improvement) ──
  if (tile.road) {
    drawImprovement(ctx, center, "road", size);
  }

  // ── Improvement ──
  if (tile.improvement) {
    drawImprovement(ctx, center, tile.improvement, size);
  }

  ctx.restore();
}

function drawImprovement(ctx: CanvasRenderingContext2D, c: { x: number; y: number }, type: string, size: number) {
  const s = size * 0.28;
  ctx.save();
  ctx.translate(c.x, c.y);

  if (type === "farm") {
    ctx.strokeStyle = "#44cc6688";
    ctx.lineWidth = 0.8;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-s, i * s * 0.6); ctx.lineTo(s, i * s * 0.6); ctx.stroke(); }
  } else if (type === "mine") {
    ctx.strokeStyle = "#cc884488";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.6); ctx.lineTo(s * 0.6, s * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.3); ctx.lineTo(-s * 0.3, -s * 0.6); ctx.stroke();
  } else if (type === "solar") {
    ctx.strokeStyle = "#ffcc4488";
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5); ctx.lineTo(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8); ctx.stroke(); }
  } else if (type === "forest") {
    ctx.fillStyle = "#228833aa";
    ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.lineTo(-s * 0.5, s * 0.4); ctx.lineTo(s * 0.5, s * 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#66442288"; ctx.fillRect(-s * 0.1, s * 0.4, s * 0.2, s * 0.3);
  } else if (type === "road") {
    ctx.strokeStyle = "#99888866"; ctx.lineWidth = 1.5; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ─── Unit Icon Renderer ───────────────────────────────────────

function drawUnitIcon(ctx: CanvasRenderingContext2D, x: number, y: number, type: UnitType, color: string, size: number) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  switch (type) {
    case UnitType.Colony:
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; const px = x + Math.cos(a) * size * 0.7; const py = y + Math.sin(a) * size * 0.7; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      break;
    case UnitType.Former:
      ctx.beginPath(); ctx.moveTo(x - size * 0.5, y + size * 0.5); ctx.lineTo(x + size * 0.5, y - size * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + size * 0.2, y - size * 0.5); ctx.lineTo(x + size * 0.5, y - size * 0.5); ctx.lineTo(x + size * 0.5, y - size * 0.2); ctx.stroke();
      break;
    case UnitType.Scout:
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.6, size * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, size * 0.15, 0, Math.PI * 2); ctx.fill();
      break;
    case UnitType.Infantry:
      ctx.beginPath(); ctx.moveTo(x, y - size * 0.6); ctx.lineTo(x + size * 0.5, y - size * 0.2); ctx.lineTo(x + size * 0.4, y + size * 0.5); ctx.lineTo(x, y + size * 0.7); ctx.lineTo(x - size * 0.4, y + size * 0.5); ctx.lineTo(x - size * 0.5, y - size * 0.2); ctx.closePath(); ctx.stroke();
      break;
    case UnitType.Speeder:
      ctx.beginPath(); ctx.moveTo(x - size * 0.5, y - size * 0.3); ctx.lineTo(x + size * 0.5, y); ctx.lineTo(x - size * 0.5, y + size * 0.3); ctx.stroke();
      break;
    case UnitType.Mindworm:
      ctx.beginPath(); ctx.moveTo(x - size * 0.6, y); ctx.quadraticCurveTo(x - size * 0.3, y - size * 0.4, x, y); ctx.quadraticCurveTo(x + size * 0.3, y + size * 0.4, x + size * 0.6, y); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + size * 0.6, y, 1.5, 0, Math.PI * 2); ctx.fill();
      break;
  }
}

// ─── Main Component ───────────────────────────────────────────

export default function HexMap({ gameState, onTileClick, onTileRightClick }: HexMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cameraStart, setCameraStart] = useState({ x: 0, y: 0 });
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);

  const { map, units, bases, selectedUnit, selectedTile, factions, currentFaction } = gameState;

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

      ctx.fillStyle = color + "11";
      ctx.beginPath(); ctx.arc(c.x, c.y, HEX_SIZE * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0a0e18ee";
      ctx.beginPath(); ctx.arc(c.x, c.y, HEX_SIZE * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, HEX_SIZE * 0.55, 0, Math.PI * 2); ctx.stroke();

      const popLines = Math.min(base.population, 6);
      ctx.strokeStyle = color + "44";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < popLines; i++) {
        const a = (i / popLines) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * HEX_SIZE * 0.4, c.y + Math.sin(a) * HEX_SIZE * 0.4); ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.font = `bold ${HEX_SIZE * 0.5}px Rajdhani, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(base.population), c.x, c.y + 1);

      ctx.fillStyle = "#000000aa";
      ctx.font = `500 ${HEX_SIZE * 0.38}px Rajdhani, sans-serif`;
      ctx.fillText(base.name, c.x + 0.5, c.y + HEX_SIZE * 0.9 + 0.5);
      ctx.fillStyle = color + "bb";
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
      const oy = hasBase ? -HEX_SIZE * 0.6 : 0;
      const ux = c.x, uy = c.y + oy;

      if (unit.id === selectedUnit) {
        const pulse = Math.sin(time * 0.005) * 2;
        ctx.strokeStyle = "#ffffffaa"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ux, uy, HEX_SIZE * 0.45 + pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#ffffff22"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ux, uy, HEX_SIZE * 0.55 + pulse, 0, Math.PI * 2); ctx.stroke();
      }

      ctx.fillStyle = "#080c14dd";
      ctx.beginPath(); ctx.arc(ux, uy, HEX_SIZE * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ux, uy, HEX_SIZE * 0.38, 0, Math.PI * 2); ctx.stroke();

      drawUnitIcon(ctx, ux, uy, unit.type, color, HEX_SIZE * 0.25);

      if (unit.health < unit.maxHealth) {
        const bw = HEX_SIZE * 0.55, bh = 2, bx = ux - bw / 2, by = uy + HEX_SIZE * 0.45;
        const pct = unit.health / unit.maxHealth;
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = pct > 0.5 ? "#22cc55" : pct > 0.25 ? "#ccaa22" : "#cc3333";
        ctx.fillRect(bx, by, bw * pct, bh);
      }

      if (unit.owner === currentFaction && unit.movesLeft > 0) {
        ctx.fillStyle = "#22cc55";
        ctx.beginPath(); ctx.arc(ux + HEX_SIZE * 0.32, uy - HEX_SIZE * 0.32, 2, 0, Math.PI * 2); ctx.fill();
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
    const loop = (t: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, rect.width, rect.height, t);
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
