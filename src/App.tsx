import React, { useMemo, useState } from "react";

/**
 * ✅ 纯 React（零依赖）版本
 * - 不使用 shadcn/ui、不使用 @/ 路径别名
 * - 直接可在 CodeSandbox / Vite / CRA 里运行
 *
 * 使用方法：把本文件内容粘到 App.jsx（或 App.tsx 去掉类型）即可。
 */

/**
 * 节点：id + 中文
 */
const nodes = [
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

const lagWeight = { S: 1, M: 2, L: 3 };

/**
 * 有向边：sign(+1/-1), strength(1..3), lag(S/M/L)
 * 说明：E=本币/外币，所以 E↑=本币贬值
 */
const edges = [
  // 主干 + 金融枢纽
  {
    from: "M",
    to: "r",
    sign: -1,
    strength: 3,
    lag: "S",
    note: "流动性↑→利率↓",
  },
  {
    from: "r",
    to: "FC",
    sign: -1,
    strength: 3,
    lag: "S",
    note: "利率↑→金融条件收紧",
  },
  {
    from: "RP",
    to: "FC",
    sign: -1,
    strength: 3,
    lag: "S",
    note: "溢价↑→金融条件收紧",
  },
  {
    from: "FC",
    to: "I",
    sign: +1,
    strength: 3,
    lag: "M",
    note: "融资更松→投资↑",
  },
  {
    from: "FC",
    to: "C",
    sign: +1,
    strength: 2,
    lag: "S",
    note: "信贷更松→消费↑",
  },
  { from: "r", to: "I", sign: -1, strength: 3, lag: "M", note: "利率↑→投资↓" },
  { from: "I", to: "Y", sign: +1, strength: 3, lag: "M", note: "投资↑→产出↑" },
  { from: "Y", to: "N", sign: +1, strength: 3, lag: "M", note: "产出↑→就业↑" },
  { from: "N", to: "C", sign: +1, strength: 3, lag: "S", note: "就业↑→消费↑" },
  { from: "C", to: "Y", sign: +1, strength: 3, lag: "S", note: "消费↑→产出↑" },
  { from: "Y", to: "pi", sign: +1, strength: 2, lag: "M", note: "需求↑→通胀↑" },
  { from: "pi", to: "r", sign: +1, strength: 3, lag: "S", note: "通胀↑→加息" },

  // 外部部门（E=本币/外币，E↑=本币贬值）
  {
    from: "r",
    to: "E",
    sign: -1,
    strength: 2,
    lag: "S",
    note: "利差↑→资本流入→本币升值(E↓)",
  },
  {
    from: "CF",
    to: "E",
    sign: -1,
    strength: 2,
    lag: "S",
    note: "资本流入→本币升值(E↓)",
  },
  {
    from: "E",
    to: "NX",
    sign: +1,
    strength: 3,
    lag: "M",
    note: "贬值(E↑)→净出口↑",
  },
  {
    from: "NX",
    to: "Y",
    sign: +1,
    strength: 3,
    lag: "M",
    note: "净出口↑→产出↑",
  },
  {
    from: "E",
    to: "pi",
    sign: +1,
    strength: 2,
    lag: "M",
    note: "贬值→进口传导→通胀↑",
  },
  {
    from: "Ystar",
    to: "X",
    sign: +1,
    strength: 3,
    lag: "M",
    note: "外需↑→出口↑",
  },
  {
    from: "X",
    to: "NX",
    sign: +1,
    strength: 3,
    lag: "M",
    note: "出口↑→净出口↑",
  },

  // 财政与债务
  {
    from: "G",
    to: "Y",
    sign: +1,
    strength: 3,
    lag: "S",
    note: "政府支出↑→产出↑",
  },
  { from: "T", to: "C", sign: -1, strength: 2, lag: "M", note: "税负↑→消费↓" },
  {
    from: "Def",
    to: "Bg",
    sign: +1,
    strength: 3,
    lag: "L",
    note: "赤字累积→债务↑",
  },
  {
    from: "Bg",
    to: "RP",
    sign: +1,
    strength: 2,
    lag: "L",
    note: "债务↑→主权溢价↑",
  },
  {
    from: "RP",
    to: "r",
    sign: +1,
    strength: 1,
    lag: "M",
    note: "溢价↑→有效融资成本↑",
  },

  // 成本、风险、不确定性
  {
    from: "Pcom",
    to: "pi",
    sign: +1,
    strength: 3,
    lag: "S",
    note: "大宗↑→通胀↑",
  },
  {
    from: "Geo",
    to: "Pcom",
    sign: +1,
    strength: 2,
    lag: "S",
    note: "地缘风险↑→大宗↑",
  },
  {
    from: "Geo",
    to: "RP",
    sign: +1,
    strength: 2,
    lag: "S",
    note: "地缘风险↑→风险溢价↑",
  },
  {
    from: "Unc",
    to: "RP",
    sign: +1,
    strength: 3,
    lag: "S",
    note: "不确定性↑→溢价↑",
  },
  {
    from: "Unc",
    to: "I",
    sign: -1,
    strength: 2,
    lag: "M",
    note: "不确定性↑→投资推迟",
  },

  // 资产/信贷
  {
    from: "PH",
    to: "C",
    sign: +1,
    strength: 2,
    lag: "M",
    note: "房价↑→财富效应→消费↑",
  },
  {
    from: "PH",
    to: "FC",
    sign: +1,
    strength: 2,
    lag: "M",
    note: "抵押品价值↑→金融条件放松",
  },
  {
    from: "PS",
    to: "FC",
    sign: +1,
    strength: 2,
    lag: "S",
    note: "股价↑→融资更容易",
  },
  {
    from: "Credit",
    to: "FC",
    sign: +1,
    strength: 3,
    lag: "S",
    note: "信贷扩张→金融条件放松",
  },
  {
    from: "Lev",
    to: "RP",
    sign: +1,
    strength: 2,
    lag: "M",
    note: "杠杆↑→溢价↑",
  },

  // 供给侧慢变量
  {
    from: "TFP",
    to: "Yn",
    sign: +1,
    strength: 3,
    lag: "L",
    note: "技术↑→潜在产出↑",
  },
  {
    from: "Yn",
    to: "x",
    sign: -1,
    strength: 3,
    lag: "M",
    note: "潜在↑→缺口↓(x=Y-Yn)",
  },
  { from: "x", to: "pi", sign: +1, strength: 2, lag: "M", note: "缺口↑→通胀↑" },
  {
    from: "Inst",
    to: "RP",
    sign: -1,
    strength: 2,
    lag: "L",
    note: "制度改善→溢价↓",
  },
  {
    from: "Urb",
    to: "I",
    sign: +1,
    strength: 2,
    lag: "L",
    note: "城镇化→投资需求↑",
  },
  {
    from: "Pop",
    to: "Yn",
    sign: +1,
    strength: 3,
    lag: "L",
    note: "人口/劳动力↑→潜在↑",
  },
  {
    from: "H",
    to: "TFP",
    sign: +1,
    strength: 2,
    lag: "L",
    note: "人力资本↑→技术↑",
  },
];

function nodeLabel(id) {
  const n = nodes.find((x) => x.id === id);
  return n ? `${n.id}（${n.zh}）` : id;
}

function lagToZh(lag) {
  return lag === "S" ? "短期" : lag === "M" ? "中期" : "长期";
}

function strengthScale(strength) {
  // 1..3 → 0.4..1.0（可调）
  return strength === 3 ? 1.0 : strength === 2 ? 0.7 : 0.4;
}

/**
 * 传播：从起点做 BFS，保留每个节点“绝对影响最大”的路径
 */
function propagate({ start, shockSign, maxSteps, decay, threshold }) {
  const out = new Map();
  for (const e of edges) {
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from).push(e);
  }

  const best = new Map();
  best.set(start, { score: 1 * shockSign, steps: 0, lagSum: 0, path: [] });
  const q = [start];

  while (q.length) {
    const cur = q.shift();
    const curState = best.get(cur);
    if (!curState) continue;
    if (curState.steps >= maxSteps) continue;

    const outs = out.get(cur) || [];
    for (const e of outs) {
      const next = e.to;
      const nextSteps = curState.steps + 1;
      const nextLagSum = curState.lagSum + lagWeight[e.lag];

      const nextScore =
        curState.score *
        e.sign *
        strengthScale(e.strength) *
        Math.pow(decay, nextSteps - 1);

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

  const results = [];
  for (const [id, s] of best.entries()) {
    if (id === start) continue;
    results.push({ id, ...s });
  }
  results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return results;
}

function pillStyle(bg) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    background: bg,
  };
}

function ScorePill({ score }) {
  const s = Math.abs(score);
  const dir = score >= 0 ? "正向" : "反向";
  const strength = s >= 0.65 ? "强" : s >= 0.35 ? "中" : "弱";
  return (
    <span style={pillStyle("rgba(0,0,0,0.02)")}>
      <b>{dir}</b>
      <span style={{ opacity: 0.6 }}>|</span>
      <span>{strength}</span>
      <span style={{ opacity: 0.6 }}>|</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {score.toFixed(3)}
      </span>
    </span>
  );
}

function TrendPill({ trend }) {
  const text =
    trend === "up"
      ? "上升"
      : trend === "down"
      ? "下降"
      : trend === "upFast"
      ? "快速上升"
      : "快速下降";
  const bg = trend.startsWith("down") ? "rgba(0,0,0,0.03)" : "rgba(0,0,0,0.02)";
  return <span style={pillStyle(bg)}>{text}</span>;
}

function Card({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 18,
        padding: 16,
        background: "white",
        boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function PathView({ path }) {
  if (!path?.length) return <div style={{ opacity: 0.7 }}>（无路径）</div>;
  return (
    <div style={{ fontSize: 12, lineHeight: 1.6 }}>
      <div style={{ opacity: 0.7, marginBottom: 6 }}>最强路径（按边顺序）</div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span
          style={{
            ...pillStyle("rgba(0,0,0,0.03)"),
            fontFamily: "ui-monospace",
          }}
        >
          {path[0].from}
        </span>
        {path.map((e, idx) => (
          <React.Fragment key={`${e.from}-${e.to}-${idx}`}>
            <span style={{ opacity: 0.7 }}>→</span>
            <span
              style={{
                ...pillStyle("rgba(0,0,0,0.03)"),
                fontFamily: "ui-monospace",
              }}
            >
              {e.to}
            </span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 8, opacity: 0.75 }}>
        边细节：
        {path.map((e, idx) => (
          <div key={idx}>
            <span style={{ fontFamily: "ui-monospace" }}>{e.from}</span> →{" "}
            <span style={{ fontFamily: "ui-monospace" }}>{e.to}</span> （
            {e.sign > 0 ? "+" : "-"}，强度 {"★".repeat(e.strength)}，
            {lagToZh(e.lag)}）
            <span style={{ marginLeft: 8, opacity: 0.8 }}>— {e.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [start, setStart] = useState("M");
  const [trend, setTrend] = useState("up");
  const [maxSteps, setMaxSteps] = useState(5);
  const [decay, setDecay] = useState(0.75);
  const [threshold, setThreshold] = useState(0.08);
  const [query, setQuery] = useState("");

  const shockSign = useMemo(
    () => (trend.startsWith("down") ? -1 : +1),
    [trend]
  );

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
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui",
        background: "#fafafa",
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>
          宏观因果网络 · 反应模拟（纯React版）
        </h1>
        <p style={{ marginTop: 8, color: "rgba(0,0,0,0.7)" }}>
          选择任意变量及其趋势（上升/下降），系统基于“方向+强度+滞后”的因果网络推演连锁反应。
          <span style={{ marginLeft: 8, fontWeight: 600 }}>注意：</span>
          这是结构化推演工具，不等同于精确预测。
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr",
            marginTop: 12,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "1fr",
              alignItems: "start",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <Card title="输入：冲击设定">
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      搜索变量（ID/中文）
                    </div>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="例如：利率 / r / 通胀 / pi"
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.18)",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      选择变量
                    </div>
                    <select
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.18)",
                      }}
                    >
                      {filteredNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.id}（{n.zh}）
                        </option>
                      ))}
                    </select>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: "rgba(0,0,0,0.65)",
                      }}
                    >
                      当前：
                      <b>
                        {startNode
                          ? `${startNode.id}（${startNode.zh}）`
                          : start}
                      </b>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>变化趋势</div>
                      <TrendPill trend={trend} />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <button
                        onClick={() => setTrend("up")}
                        style={btnStyle(trend === "up")}
                      >
                        上升
                      </button>
                      <button
                        onClick={() => setTrend("down")}
                        style={btnStyle(trend === "down")}
                      >
                        下降
                      </button>
                      <button
                        onClick={() => setTrend("upFast")}
                        style={btnStyle(trend === "upFast")}
                      >
                        快速上升
                      </button>
                      <button
                        onClick={() => setTrend("downFast")}
                        style={btnStyle(trend === "downFast")}
                      >
                        快速下降
                      </button>
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: "rgba(0,0,0,0.65)",
                      }}
                    >
                      “快速”不改变符号；想看更长链条可提高步数或降低阈值。
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        传播深度（最大步数）：{maxSteps}
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={maxSteps}
                        onChange={(e) =>
                          setMaxSteps(parseInt(e.target.value, 10))
                        }
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        衰减系数（越小越保守）：{decay.toFixed(2)}
                      </div>
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
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        显示阈值（过滤弱反应）：{threshold.toFixed(2)}
                      </div>
                      <input
                        type="range"
                        min={0.01}
                        max={0.3}
                        step={0.01}
                        value={threshold}
                        onChange={(e) =>
                          setThreshold(parseFloat(e.target.value))
                        }
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
                      评分=路径乘积（方向×强度缩放×衰减），用于排序与筛选。
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="输出：反应概览">
                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <div>
                      冲击：<b>{nodeLabel(start)}</b>{" "}
                      {trend.startsWith("down") ? "下降" : "上升"}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(0,0,0,0.65)",
                        marginTop: 4,
                      }}
                    >
                      规则：E=本币/外币（E↑=本币贬值）。强度：★弱/★★中/★★★强。滞后：短/中/长。
                    </div>
                  </div>

                  <div style={{ fontWeight: 700 }}>
                    可能引发的主要反应（按强度排序）
                  </div>
                  <div
                    style={{
                      maxHeight: 520,
                      overflow: "auto",
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 14,
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "#fff",
                        }}
                      >
                        <tr
                          style={{ borderBottom: "1px solid rgba(0,0,0,0.12)" }}
                        >
                          <th style={thStyle}>变量</th>
                          <th style={thStyle}>方向/强弱</th>
                          <th style={thStyle}>步数</th>
                          <th style={thStyle}>滞后(累加)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              style={{ padding: 12, color: "rgba(0,0,0,0.65)" }}
                            >
                              没有找到超过阈值的传播结果。可尝试：提高最大步数、降低阈值或提高衰减系数。
                            </td>
                          </tr>
                        ) : (
                          results.map((r) => (
                            <tr
                              key={r.id}
                              style={{
                                borderBottom: "1px solid rgba(0,0,0,0.08)",
                              }}
                            >
                              <td style={tdStyle}>
                                <div style={{ fontWeight: 700 }}>
                                  {nodeLabel(r.id)}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "rgba(0,0,0,0.65)",
                                  }}
                                >
                                  {r.path.length
                                    ? r.path[r.path.length - 1].note
                                    : ""}
                                </div>
                              </td>
                              <td style={tdStyle}>
                                <ScorePill score={r.score} />
                              </td>
                              <td
                                style={{
                                  ...tdStyle,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {r.steps}
                              </td>
                              <td
                                style={{
                                  ...tdStyle,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {r.lagSum}{" "}
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: "rgba(0,0,0,0.6)",
                                  }}
                                >
                                  (S=1,M=2,L=3)
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <Card title="路径解释（Top 6 最强路径）">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{nodeLabel(r.id)}</div>
                    <ScorePill score={r.score} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <PathView path={r.path} />
                  </div>
                </div>
              ))}
              {results.length === 0 ? (
                <div style={{ padding: 12, color: "rgba(0,0,0,0.65)" }}>
                  暂无可展示路径。调整参数后再试。
                </div>
              ) : null}
            </div>
          </Card>

          <Card title="自定义说明">
            <div
              style={{
                fontSize: 13,
                color: "rgba(0,0,0,0.7)",
                lineHeight: 1.7,
              }}
            >
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  你可以在 <code>nodes</code> 和 <code>edges</code>{" "}
                  里继续扩展变量与边：
                  <code>sign</code> 用 +1/-1，<code>strength</code> 用 1/2/3，
                  <code>lag</code> 用 S/M/L。
                </li>
                <li>
                  当前为“每个节点保留最强路径”，更可解释；若想“多路径累加”，可把
                  best 结构改成对同一节点累加 score。
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function btnStyle(active) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: active ? "rgba(0,0,0,0.90)" : "white",
    color: active ? "white" : "rgba(0,0,0,0.85)",
    cursor: "pointer",
    fontWeight: 700,
  };
}

const thStyle = {
  padding: 10,
  textAlign: "left",
  fontWeight: 800,
  fontSize: 12,
};
const tdStyle = { padding: 10, verticalAlign: "top" };
