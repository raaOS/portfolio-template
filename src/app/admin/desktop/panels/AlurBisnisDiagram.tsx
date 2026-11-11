'use client';

import React from 'react';
import { ALUR_FASE, type BizActor, type BizNode, type BizPhase } from './bizMapContent';

/**
 * Diagram alur jualan v1.3.78 (deferred R2) — 6 fase kiri → kanan, 18 langkah.
 *
 * Digambar sebagai SVG inline, bukan file /public: alur ini proses internal
 * owner (aturan "cek mutasi dulu", `R2_PENDING`, `media_pending`), jadi tidak
 * boleh bisa dibuka lewat URL di deployment klien.
 *
 * Mermaid tidak dipakai karena tidak bisa menata 18 langkah berurutan jadi grid:
 * TB = 1303×4532 px, LR = 5592×268 px, dan `direction` di dalam subgraph
 * diabaikan bila ada edge lintas subgraph.
 *
 * Konten (fase, kotak, teks) ada di `bizMapContent.ts` → ubah di sana.
 */

const ACTOR_STYLE: Record<BizActor, { fill: string; stroke: string; text: string; label: string }> = {
  pembeli: { fill: '#eff6ff', stroke: '#3b82f6', text: '#1e3a8a', label: '#1d4ed8' },
  sistem: { fill: '#f5f3ff', stroke: '#8b5cf6', text: '#4c1d95', label: '#6d28d9' },
  owner: { fill: '#ecfdf5', stroke: '#10b981', text: '#065f46', label: '#047857' },
  kunci: { fill: '#fef3c7', stroke: '#f59e0b', text: '#78350f', label: '#b45309' },
  cron: { fill: '#f8fafc', stroke: '#94a3b8', text: '#334155', label: '#475569' },
};

// ─── Tata letak (angka px di dalam viewBox SVG) ───
const W = 1580;
const PAD = 26;
const NODE_W = 250;
const NODE_H = 92;
const NODE_GAP = 55;
const BAND_GAP = 44;
const HEAD_H = 26;
const BAND_PAD = 14;
const BAND_H = HEAD_H + NODE_H + BAND_PAD;
const TOP = 18;
const FONT = "Inter, 'Segoe UI', system-ui, sans-serif";

interface Placed {
  phase: BizPhase;
  bandY: number;
  nodes: { x: number; y: number; cx: number; cy: number; node: BizNode }[];
}

const LAYOUT: Placed[] = (() => {
  let y = TOP;
  return ALUR_FASE.map((phase) => {
    const count = phase.nodes.length;
    const rowW = count * NODE_W + (count - 1) * NODE_GAP;
    const startX = (W - rowW) / 2;
    const bandY = y;
    const nodes = phase.nodes.map((node, i) => {
      const x = startX + i * (NODE_W + NODE_GAP);
      const ny = bandY + HEAD_H;
      return { x, y: ny, cx: x + NODE_W / 2, cy: ny + NODE_H / 2, node };
    });
    y += BAND_H + BAND_PAD + BAND_GAP;
    return { phase, bandY, nodes };
  });
})();

const LEGEND_LABELS: Record<string, string> = {
  F1: 'biru = pesanan & bayar',
  F2: 'amber = verifikasi & aktivasi',
  F3: 'ungu = onboarding & deploy',
  F4: 'hijau = serah terima',
  F5: 'teal = aktivasi media',
  F6: 'abu putus-putus = otomatis harian',
};

const LEGEND = ALUR_FASE.map((phase) => ({
  label: LEGEND_LABELS[phase.id],
  color: phase.color,
  id: phase.id,
  dashed: phase.id === 'F6',
}));

const LEGEND_Y = LAYOUT[LAYOUT.length - 1].bandY + BAND_H + BAND_PAD + BAND_GAP + 10;
const HEIGHT = LEGEND_Y + 40;

/** Posisi x tiap item legenda — dihitung di module scope supaya render murni. */
const LEGEND_ITEMS = (() => {
  let x = PAD + 104;
  return LEGEND.map((item) => {
    const at = x;
    x += 32 + item.label.length * 5.5 + 24;
    return { ...item, x: at };
  });
})();

/** Panah dari node terakhir satu fase ke node pertama fase berikutnya. */
function phaseArrow(from: { cx: number; y: number }, to: { cx: number; y: number }) {
  const y1 = from.y + NODE_H + 2;
  const y2 = to.y - 6;
  const midY = from.y + NODE_H + BAND_PAD + BAND_GAP / 2;
  const dir = to.cx > from.cx ? 1 : -1;
  return [
    `M ${from.cx} ${y1}`,
    `L ${from.cx} ${midY - 10}`,
    `Q ${from.cx} ${midY} ${from.cx + 12 * dir} ${midY}`,
    `L ${to.cx - 12 * dir} ${midY}`,
    `Q ${to.cx} ${midY} ${to.cx} ${midY + 10}`,
    `L ${to.cx} ${y2}`,
  ].join(' ');
}

export default function AlurBisnisDiagram() {
  return (
    <svg
      viewBox={`0 0 ${W} ${HEIGHT}`}
      role="img"
      aria-label="Diagram alur bisnis: pembeli, sistem, dan owner per fase"
      className="h-auto w-full min-w-[900px]"
    >
      <defs>
        {ALUR_FASE.map((p) => (
          <marker
            key={p.id}
            id={`alur-arw-${p.id}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={p.color} />
          </marker>
        ))}
      </defs>

      {LAYOUT.map(({ phase, bandY, nodes }) => (
        <g key={phase.id}>
          <rect
            x={PAD}
            y={bandY}
            width={W - PAD * 2}
            height={BAND_H + BAND_PAD}
            rx={12}
            fill={phase.bg}
            stroke={phase.border}
            strokeWidth={1.5}
          />
          <text
            x={W - PAD - 16}
            y={bandY + 20}
            textAnchor="end"
            fontFamily={FONT}
            fontSize={12}
            fontWeight={700}
            fill={phase.color}
            letterSpacing="0.06em"
          >
            {phase.title}
          </text>

          {nodes.map(({ x, y, node }) => {
            const a = ACTOR_STYLE[node.actor];
            return (
              <g key={node.head}>
                <rect
                  x={x}
                  y={y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill={a.fill}
                  stroke={a.stroke}
                  strokeWidth={1.5}
                />
                <text x={x + 12} y={y + 20} fontFamily={FONT} fontSize={11} fontWeight={700} fill={a.label}>
                  {node.head}
                </text>
                {node.lines.map((line, i) => (
                  <text
                    key={line}
                    x={x + 12}
                    y={y + 38 + i * 15}
                    fontFamily={FONT}
                    fontSize={11.5}
                    fill={a.text}
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}

          {nodes.slice(0, -1).map((n, i) => {
            const next = nodes[i + 1];
            return (
              <line
                key={`${phase.id}-link-${i}`}
                x1={n.x + NODE_W + 3}
                y1={n.cy}
                x2={next.x - 6}
                y2={next.cy}
                stroke={phase.color}
                strokeWidth={2.5}
                markerEnd={`url(#alur-arw-${phase.id})`}
              />
            );
          })}
        </g>
      ))}

      {LAYOUT.slice(0, -1).map((row, i) => {
        const next = LAYOUT[i + 1];
        const from = row.nodes[row.nodes.length - 1];
        const to = next.nodes[0];
        return (
          <path
            key={`${row.phase.id}-to-${next.phase.id}`}
            d={phaseArrow(from, to)}
            fill="none"
            stroke={next.phase.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            markerEnd={`url(#alur-arw-${next.phase.id})`}
          />
        );
      })}

      <text x={PAD + 4} y={LEGEND_Y} fontFamily={FONT} fontSize={11.5} fontWeight={700} fill="#334155">
        KETERANGAN
      </text>
      {LEGEND_ITEMS.map((item) => (
        <g key={item.label}>
          <line
            x1={item.x}
            y1={LEGEND_Y - 4}
            x2={item.x + 24}
            y2={LEGEND_Y - 4}
            stroke={item.color}
            strokeWidth={3}
            strokeDasharray={item.dashed ? '6 4' : undefined}
            markerEnd={`url(#alur-arw-${item.id})`}
          />
          <text x={item.x + 32} y={LEGEND_Y} fontFamily={FONT} fontSize={11} fill="#475569">
            {item.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
