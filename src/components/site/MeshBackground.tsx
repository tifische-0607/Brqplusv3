import { useMemo } from "react";

type Node = { x: number; y: number; r: number; d: number };

export function MeshBackground() {
  const { nodes, edges } = useMemo(() => {
    // Deterministic pseudo-random for SSR stability
    const seed = 17;
    const rand = (i: number) => {
      const x = Math.sin(seed + i) * 10000;
      return x - Math.floor(x);
    };
    const count = 36;
    const nodes: Node[] = Array.from({ length: count }, (_, i) => ({
      x: rand(i) * 100,
      y: rand(i + 99) * 100,
      r: 0.6 + rand(i + 200) * 1.4,
      d: 2 + rand(i + 300) * 6,
    }));
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        if (Math.hypot(dx, dy) < 18) edges.push([i, j]);
      }
    }
    return { nodes, edges };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--navy)_0%,var(--charcoal)_60%,var(--charcoal)_100%)]" />
      <svg
        className="animate-mesh absolute inset-0 h-full w-full opacity-60"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="var(--cyan)"
            strokeOpacity="0.12"
            strokeWidth="0.08"
          />
        ))}
        {nodes.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r * 0.25}
            fill={i % 5 === 0 ? "var(--gold)" : "var(--cyan)"}
            style={{
              animation: `pulse-node ${n.d}s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-charcoal" />
    </div>
  );
}
