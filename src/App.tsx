import React, { useMemo, useState } from "react";

/**
 * ✅ App.tsx（TypeScript / CRA react-scripts / Vercel 可直接 build）
 * - 零外部 UI 依赖
 * - 完整类型：避免 implicit any
 * - 修复 TS2569：不直接 for..of Map.entries()，改用 Array.from(...)
 */

/** ===== 类型定义 ===== */
type NodeId =
  | "M"
  | "r"
  | "RP"
  | "FC"
  | "I"
  | "C"
  | "Y"
  | "N"
  | "pi"
  | "E"
  | "NX"
  | "X"
  | "Ystar"
  | "CF"
  | "G"
  | "T"
  | "Def"
  | "Bg"
  | "Pcom"
  | "Geo"
  | "Unc"
  | "PH"
  | "PS"
  | "Credit"
  | "Lev"
  | "TFP"
  | "Yn"
  | "x"
  | "Inst"
  | "Urb"
  | "Pop"
  | "H";

type Lag = "S" | "M" | "L";
type Strength = 1 | 2 | 3;
type Sign = 1 | -1;

type Node = { id: NodeId; zh: string };

type Edge = {
  from: NodeId;
  to: NodeId;
  sign: Sign;
  strength: Strength;
  lag: Lag;
  note: string;
};

type Trend = "up" | "down" | "upFast" | "downFast";

type PropResult = {
  id: NodeId;
  score: number;
  steps: number;
  lagSum: number;
  path: Edge[];
};

/** ===== 数据：节点与边 ===== */
const nodes: Node[] = [
  { id: "M", zh: "货币供给" },
  { id: "r", zh: "利率" },
  { id: "RP", zh: "风险溢价" },
  { id: "FC", zh: "金融条件" },
  { id: "I", zh: "投资" },
  { id: "C", zh: "消费" },
  { id: "Y", zh: "产出（GDP）" },
  { id: "N", zh: "就业" },
  { id: "pi", zh: "通胀" },
  { id: "E", zh: "汇率（本币/外币）" },
  { id: "NX", zh: "净出口" },
  { id: "X", zh: "出口" },
  { id: "Ystar", zh: "全球需求" },
  { id: "CF", zh: "资本流动" },
  { id: "G", zh: "政府支出" },
  { id: "T", zh: "税收" },
  { id: "Def", zh: "财政赤字" },
  { id: "Bg", zh: "政府债务" },
  { id: "Pcom", zh: "大宗商品/能源价格" },
  { id: "Geo", zh: "地缘政治风险" },
  { id: "Unc", zh: "不确定性" },
  { id: "PH", zh: "房价" },
  { id: "PS", zh: "股价" },
  { id: "Credit", zh: "信贷规模" },
  { id: "Lev", zh: "杠杆率" },
  { id: "TFP", zh: "技术水平" },
  { id: "Yn", zh: "潜在产出" },
  { id: "x", zh: "产出缺口" },
  { id: "Inst", zh: "制度质量" },
  { id: "Urb", zh: "城镇化" },
  { id: "Pop", zh: "人口" },
  { id: "H", zh: "人力资本" },
];

const lagWeight: Record<Lag, number> = { S: 1, M: 2, L: 3 };

/**
 * 说明：E = 本币/外币，因此 E↑ = 本币贬值（需要更多本币换 1 单位外币）
 */
const edges: Edge[] = [
  // 主干 + 金融枢纽
  { from: "M", to: "r", sign: -1, strength: 3, lag: "S", note: "流动性↑→利率↓" },
  { from: "r", to: "FC", sign: -1, strength: 3, lag: "S", note: "利率↑→金融条件收紧" },
  { from: "RP", to: "FC", sign: -1, strength: 3, lag: "S", note: "溢价↑→金融条件收紧" },
  { from: "FC", to: "I", sign: +1, strength: 3, lag: "M", note: "融资更松→投资↑" },
  { from: "FC", to: "C", sign: +1, strength: 2, lag: "S", note: "信贷更松→消费↑" },
  { from: "r", to: "I", sign: -1, strength: 3, lag: "M", note: "利率↑→投资↓" },
  { from: "I", to: "Y", sign: +1, strength: 3, lag: "M", note: "投资↑→产出↑" },
  { from: "Y", to: "N", sign: +1, strength: 3, lag: "M", note: "产出↑→就业↑" },
  { from: "N", to: "C", sign: +1, strength: 3, lag: "S", note: "就业↑→消费↑" },
  { from: "C", to: "Y", sign: +1, strength: 3, lag: "S", note: "消费↑→产出↑" },
  { from: "Y", to: "pi", sign: +1, strength: 2, lag: "M", note: "需求↑→通胀↑" },
  { from: "pi", to: "r", sign: +1, strength: 3, lag: "S", note: "通胀↑→加息" },

  // 外部部门
  { from: "r", to: "E", sign: -1, strength: 2, lag: "S", note: "利差↑→资本流入→本币升值(E↓)" },
  { from: "CF", to: "E", sign: -1, strength: 2, lag: "S", note: "资本流入→本币升值(E↓)" },
  { from: "E", to: "NX", sign: +1, strength: 3, lag: "M", note: "贬值(E↑)→净出口↑" },
  { from: "NX", to: "Y", sign: +1, strength: 3, lag: "M", note: "净出口↑→产出↑" },
  { from: "E", to: "pi", sign: +1, strength: 2, lag: "M", note: "贬值→进口传导→通胀↑" },
  { from: "Ystar", to: "X", sign: +1, strength: 3, lag: "M", note: "外需↑→出口↑" },
  { from: "X", to: "NX", sign: +1, strength: 3, lag: "M", note: "出口↑→净出口↑" },

  // 财政与债务
  { from: "G", to: "Y", sign: +1, strength: 3, lag: "S", note: "政府支出↑→产出↑" },
  { from: "T", to: "C", sign: -1, strength: 2, lag: "M", note: "税负↑→消费↓" },
  { from: "Def", to: "Bg", sign: +1, strength: 3, lag: "L", note: "赤字累积→债务↑" },
  { from: "Bg", to: "RP", sign: +1, strength: 2, lag: "L", note: "债务↑→主权溢价↑" },
  { from: "RP", to: "r", sign: +1, strength: 1, lag: "M", note: "溢价↑→有效融资成本↑" },

  // 成本、风险、不确定性
  { from: "Pcom", to: "pi", sign: +1, strength: 3, lag: "S", note: "大宗↑→通胀↑" },
  { from: "Geo", to: "Pcom", sign: +1, strength: 2, lag: "S", note: "地缘风险↑→大宗↑" },
  { from: "Geo", to: "RP", sign: +1, strength: 2, lag: "S", note: "地缘风险↑→风险溢价↑" },
  { from: "Unc", to: "RP", sign: +1, strength: 3, lag: "S", note: "不确定性↑→溢价↑" },
  { from: "Unc", to: "I", sign: -1, strength: 2, lag: "M", note: "不确定性↑→投资推迟" },

  // 资产/信贷
  { from: "PH", to: "C", sign: +1, strength: 2, lag: "M", note: "房价↑→财富效应→消费↑" },
  { from: "PH", to: "FC", sign: +1, strength: 2, lag: "M", note: "抵押品价值↑→金融条件放松" },
  { from: "PS", to: "FC", sign: +1, strength: 2, lag: "S", note: "股价↑→融资更容易" },
  { from: "Credit", to: "FC", sign: +1, strength: 3, lag: "S", note: "信贷扩张→金融条件放松" },
  { from: "Lev", to: "RP", sign: +1, strength: 2, lag: "M", note: "杠杆↑→溢价↑" },

  // 供给侧慢变量
  { from: "TFP", to: "Yn", sign: +1, strength: 3, lag: "L", note: "技术↑→潜在产出↑" },
  { from: "Yn", to: "x", sign: -1, strength: 3, lag: "M", note: "潜在↑→缺口↓(x=Y-Yn)" },
  { from: "x", to: "pi", sign: +1, strength: 2, lag: "M", note: "缺口↑→通胀↑" },
  { from: "Inst", to: "RP", sign: -1, strength: 2, lag: "L", note: "制度改善→溢价↓" },
  { from: "Urb", to: "I", sign: +1, strength: 2, lag: "L", note: "城镇化→投资需求↑" },
  { from: "Pop", to: "Yn", sign: +1, strength: 3, lag: "L", note: "人口/劳动力↑→潜在↑" },
  { from: "H", to: "TFP", sign: +1, strength: 2, lag: "L", note: "人力资本↑→技术↑" },
];

/** ===== 工具函数 ===== */
function nodeLabel(id: NodeId): string {
  const n = nodes.find((x) => x.id === id);
  return n ? `${n.id}（${n.zh}）` : id;
}

function lagToZh(lag: Lag): string {
  return lag === "S" ? "短期" : lag === "M" ? "中期" : "长期";
}

function strengthScale(strength: Strength): number {
  return strength === 3 ? 1.0 : strength === 2 ? 0.7 : 0.4;
}

function trendText(trend: Trend): string {
  switch (trend) {
    case "up":
      return "上升";
    case "down":
      return "下降";
    case "upFast":
      return "快速上升";
    case "downFast":
      return "快速下降";
  }
}

function scoreStrengthLabel(absScore: number): "强" | "中" | "弱" {
  return absScore >= 0.65 ? "强" : absScore >= 0.35 ? "中" : "弱";
}

/**
 * 传播：从起点做 BFS
 * - 每个节点只保留“绝对影响最大”的路径（可解释性更强）
 * - ✅ 用 Array.from(best.entries()) 避免 TS2569
 */
function propagate(params: {
  start: NodeId;
  shockSign: Sign;
  maxSteps: number;
  decay: number;
  threshold: number;
}): PropResult[] {
  const { start, shockSign, maxSteps, decay, threshold } = params;

  const out = new Map<NodeId, Edge[]>();
  for (const e of edges) {
    const arr = out.get(e.from) ?? [];
    arr.push(e);
    out.set(e.from, arr);
  }

  const best = new Map<NodeId, { score: number; steps: number; lagSum: number; path: Edge[] }>();
  best.set(start, { score: 1 * shockSign, steps: 0, lagSum: 0, path: [] });

  const q: NodeId[] = [start];

  while (q.length) {
    const cur = q.shift() as NodeId;
    const curState = best.get(cur);
    if (!curState) continue;
    if (curState.steps >= maxSteps) continue;

    const outs = out.get(cur) ?? [];
    for (const e of outs) {
      const next = e.to;
      const nextSteps = curState.steps + 1;
      const nextLagSum = curState.lagSum + lagWeight[e.lag];

      const nextScore =
        curState.score * e.sign * strengthScale(e.strength) * Math.pow(decay, nextSteps - 1);

      const prev = best.get(next);
      const isBetter = !prev || Math.abs(nextScore) > Math.abs(prev.score);

      if (isBetter && Math.abs(nextScore) >= threshold) {
        best.set(next, {
          score: nextScore,
          steps: nextSteps,
          lagSum: nextLagSum,
          path: [...curState.path, e],
        });
        q.push(next);
      }
    }
  }

  const results: PropResult[] = [];
  Array.from(best.entries()).forEach(([id, s]) => {
    if (id === start) return;
    results.push({ id, score: s.score, steps: s.steps, lagSum: s.lagSum, path: s.path });
  });

  results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return results;
}

/** ===== 样式（内联，零依赖） ===== */
const page: React.CSSProperties = {
  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  background: "#fafafa",
  minHeight: "100vh",
};

const container: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: 16,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  alignItems: "start",
};

const card: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 18,
  padding: 16,
  background: "white",
  boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
};

const label: React.CSSProperties = { fontWeight: 700, marginBottom: 6 };

const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  background: "rgba(0,0,0,0.02)",
};

function Btn(props: { active: boolean; children: React.ReactNode; onClick: () => void }): JSX.Element {
  const { active, children, onClick } = props;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.18)",
        background: active ? "rgba(0,0,0,0.90)" : "white",
        color: active ? "white" : "rgba(0,0,0,0.85)",
        cursor: "pointer",
        fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}

function ScorePill(props: { score: number }): JSX.Element {
  const { score } = props;
  const abs = Math.abs(score);
  const dir = score >= 0 ? "正向" : "反向";
  const s = scoreStrengthLabel(abs);
  return (
    <span style={pill}>
      <b>{dir}</b>
      <span style={{ opacity: 0.6 }}>|</span>
      <span>{s}</span>
      <span style={{ opacity: 0.6 }}>|</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{score.toFixed(3)}</span>
    </span>
  );
}

function PathView(props: { path: Edge[] }): JSX.Element {
  const { path } = props;
  if (!path.length) return <div style={{ opacity: 0.7 }}>（无路径）</div>;

  return (
    <div style={{ fontSize: 12, lineHeight: 1.6 }}>
      <div style={{ opacity: 0.7, marginBottom: 6 }}>最强路径（按边顺序）</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ ...pill, background: "rgba(0,0,0,0.03)", fontFamily: "ui-monospace" }}>{path[0].from}</span>
        {path.map((e, idx) => (
          <React.Fragment key={`${e.from}-${e.to}-${idx}`}>
            <span style={{ opacity: 0.7 }}>→</span>
            <span style={{ ...pill, background: "rgba(0,0,0,0.03)", fontFamily: "ui-monospace" }}>{e.to}</span>
          </React.Fragment>
        ))}
      </div>

      <div style={{ marginTop: 8, opacity: 0.78 }}>
        {path.map((e, idx) => (
          <div key={idx}>
            <span style={{ fontFamily: "ui-monospace" }}>{e.from}</span> →{" "}
            <span style={{ fontFamily: "ui-monospace" }}>{e.to}</span>（{e.sign > 0 ? "+" : "-"}，强度{" "}
            {"★".repeat(e.strength)}，{lagToZh(e.lag)}）<span style={{ marginLeft: 8 }}>— {e.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** ===== 主组件 ===== */
export default function App(): JSX.Element {
  const [start, setStart] = useState<NodeId>("M");
  const [trend, setTrend] = useState<Trend>("up");
  const [maxSteps, setMaxSteps] = useState<number>(5);
  const [decay, setDecay] = useState<number>(0.75);
  const [threshold, setThreshold] = useState<number>(0.08);
  const [query, setQuery] = useState<string>("");

  const shockSign: Sign = trend.startsWith("down") ? -1 : 1;

  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => `${n.id}${n.zh}`.toLowerCase().includes(q));
  }, [query]);

  const results = useMemo(() => {
    return propagate({ start, shockSign, maxSteps, decay, threshold });
  }, [start, shockSign, maxSteps, decay, threshold]);

  const startNode = useMemo(() => nodes.find((n) => n.id === start), [start]);

  return (
    <div style={page}>
      <div style={container}>
        <h1 style={{ margin: 0, fontSize: 24 }}>宏观因果网络 · 反应模拟（TypeScript / 可部署）</h1>
        <p style={{ marginTop: 8, color: "rgba(0,0,0,0.7)" }}>
          选择任意变量及其趋势（上升/下降），系统基于“方向+强度+滞后”的因果网络推演连锁反应。
          <span style={{ marginLeft: 8, fontWeight: 700 }}>注意：</span>这是结构化推演工具，不等同于精确预测。
        </p>

        <div style={{ ...grid2, marginTop: 12 }}>
          {/* 输入 */}
          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>输入：冲击设定</div>

            <div style={{ marginBottom: 10 }}>
              <div style={label}>搜索变量（ID/中文）</div>
              <input
                style={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例如：利率 / r / 通胀 / pi"
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={label}>选择变量</div>
              <select style={input} value={start} onChange={(e) => setStart(e.target.value as NodeId)}>
                {filteredNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.id}（{n.zh}）
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
                当前：<b>{startNode ? `${startNode.id}（${startNode.zh}）` : start}</b>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={label}>变化趋势</div>
                <span style={pill}>{trendText(trend)}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                <Btn active={trend === "up"} onClick={() => setTrend("up")}>
                  上升
                </Btn>
                <Btn active={trend === "down"} onClick={() => setTrend("down")}>
                  下降
                </Btn>
                <Btn active={trend === "upFast"} onClick={() => setTrend("upFast")}>
                  快速上升
                </Btn>
                <Btn active={trend === "downFast"} onClick={() => setTrend("downFast")}>
                  快速下降
                </Btn>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
                “快速”不改变符号；想看更长链条可提高步数或降低阈值。
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={label}>传播深度（最大步数）：{maxSteps}</div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(parseInt(e.target.value, 10))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <div style={label}>衰减系数（越小越保守）：{decay.toFixed(2)}</div>
                <input
                  type="range"
                  min={0.3}
                  max={0.95}
                  step={0.05}
                  value={decay}
                  onChange={(e) => setDecay(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <div style={label}>显示阈值（过滤弱反应）：{threshold.toFixed(2)}</div>
                <input
                  type="range"
                  min={0.01}
                  max={0.3}
                  step={0.01}
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
                评分=路径乘积（方向×强度缩放×衰减），用于排序与筛选。
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
              规则：E=本币/外币（E↑=本币贬值）。强度：★弱/★★中/★★★强。滞后：短/中/长。
            </div>
          </div>

          {/* 输出 */}
          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>输出：反应概览</div>

            <div
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 14,
                padding: 12,
                background: "rgba(0,0,0,0.02)",
                marginBottom: 10,
              }}
            >
              <div>
                冲击：<b>{nodeLabel(start)}</b> {trend.startsWith("down") ? "下降" : "上升"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)", marginTop: 4 }}>
                将展示超过阈值的最强路径传播结果（每个节点保留绝对影响最大的一条路径）。
              </div>
            </div>

            <div style={{ fontWeight: 900, marginBottom: 8 }}>可能引发的主要反应（按强度排序）</div>

            <div style={{ maxHeight: 520, overflow: "auto", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12 }}>变量</th>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12 }}>方向/强弱</th>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12 }}>步数</th>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12 }}>滞后(累加)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, color: "rgba(0,0,0,0.65)" }}>
                        没有找到超过阈值的传播结果。可尝试：提高最大步数、降低阈值或提高衰减系数。
                      </td>
                    </tr>
                  ) : (
                    results.map((r) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <td style={{ padding: 10, verticalAlign: "top" }}>
                          <div style={{ fontWeight: 900 }}>{nodeLabel(r.id)}</div>
                          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
                            {r.path.length ? r.path[r.path.length - 1].note : ""}
                          </div>
                        </td>
                        <td style={{ padding: 10, verticalAlign: "top" }}>
                          <ScorePill score={r.score} />
                        </td>
                        <td style={{ padding: 10, verticalAlign: "top", fontVariantNumeric: "tabular-nums" }}>{r.steps}</td>
                        <td style={{ padding: 10, verticalAlign: "top", fontVariantNumeric: "tabular-nums" }}>
                          {r.lagSum} <span style={{ fontSize: 12, color: "rgba(0,0,0,0.6)" }}>(S=1,M=2,L=3)</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 路径解释 */}
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>路径解释（Top 6 最强路径）</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {results.slice(0, 6).map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 14,
                  padding: 12,
                  background: "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{nodeLabel(r.id)}</div>
                  <ScorePill score={r.score} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <PathView path={r.path} />
                </div>
              </div>
            ))}
            {results.length === 0 ? (
              <div style={{ padding: 12, color: "rgba(0,0,0,0.65)" }}>暂无可展示路径。调整参数后再试。</div>
            ) : null}
          </div>
        </div>

        {/* 自定义说明 */}
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>自定义说明</div>
          <div style={{ fontSize: 13, color: "rgba(0,0,0,0.75)", lineHeight: 1.7 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                你可以在 <code>nodes</code> 与 <code>edges</code> 里继续扩展变量与边：<code>sign</code> 用 +1/-1，<code>strength</code>{" "}
                用 1/2/3，<code>lag</code> 用 S/M/L。
              </li>
              <li>
                当前算法对每个节点只保留“绝对影响最大”的路径（更可解释）。如果你想“多路径累加”或“矩阵脉冲响应（IRF）”，我也可以帮你改。
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
