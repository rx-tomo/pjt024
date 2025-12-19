import { el } from "./dom.js";

function histogram(values, min, max) {
  const bins = [];
  for (let i = min; i <= max; i++) bins.push({ x: i, n: 0 });
  for (const v of values) {
    const idx = Math.max(0, Math.min(bins.length - 1, Math.round(v) - min));
    bins[idx].n += 1;
  }
  const maxN = Math.max(...bins.map((b) => b.n), 1);
  return { bins, maxN };
}

function renderHistogramCard(title, values) {
  const min = 3;
  const max = 12;
  const { bins, maxN } = histogram(values, min, max);

  const card = el("div", { className: "card" });
  card.appendChild(el("div", { className: "card__title", text: title }));
  card.appendChild(
    el("div", { className: "card__desc", text: "個人スコアの分布（概形）です。棒は人数比です。" }),
  );

  const row = el("div");
  row.style.display = "grid";
  row.style.gridTemplateColumns = `repeat(${bins.length}, 1fr)`;
  row.style.gap = "6px";
  row.style.alignItems = "end";
  row.style.marginTop = "10px";
  row.style.height = "120px";

  for (const b of bins) {
    const col = el("div");
    col.style.display = "grid";
    col.style.gap = "6px";
    col.style.justifyItems = "center";

    const bar = el("div");
    bar.style.width = "100%";
    bar.style.borderRadius = "10px";
    bar.style.border = "1px solid rgba(255,255,255,0.10)";
    bar.style.background = "rgba(59,130,246,0.18)";
    bar.style.height = `${Math.max(4, (b.n / maxN) * 110)}px`;
    bar.title = `${b.x}: ${b.n}人`;

    const lab = el("div", { className: "muted", text: String(b.x) });
    lab.style.fontSize = "10px";
    col.appendChild(bar);
    col.appendChild(lab);
    row.appendChild(col);
  }

  card.appendChild(row);
  return card;
}

export function renderDistributions(analysis) {
  const people = analysis.people;
  const wrap = el("div", { className: "grid" });
  const title =
    analysis.sexMode === "split"
      ? "分布（個人・男女別）"
      : analysis.sexMode === "male"
        ? "分布（個人・男性）"
        : analysis.sexMode === "female"
          ? "分布（個人・女性）"
          : "分布（個人・不明）";
  wrap.appendChild(el("div", { className: "card__title", text: title }));
  wrap.appendChild(
    el("div", {
      className: "card__desc",
      text: "同じ平均でも、ばらつき（分布形状）が違うと見え方が変わるため、参考として表示します。",
    }),
  );

  const renderGrid = (label, rows) => {
    const block = el("div", { className: "grid" });
    block.appendChild(el("div", { className: "muted", text: label }));
    const grid = el("div", { className: "grid grid--cards" });
    grid.appendChild(renderHistogramCard("量的負担", rows.map((p) => p.scores.workload)));
    grid.appendChild(renderHistogramCard("コントロール", rows.map((p) => p.scores.control)));
    grid.appendChild(renderHistogramCard("上司の支援", rows.map((p) => p.scores.supervisorSupport)));
    grid.appendChild(renderHistogramCard("同僚の支援", rows.map((p) => p.scores.coworkerSupport)));
    block.appendChild(grid);
    return block;
  };

  if (analysis.sexMode === "split") {
    wrap.appendChild(renderGrid("男性", people.filter((p) => p.attrs.sex === "male")));
    wrap.appendChild(renderGrid("女性", people.filter((p) => p.attrs.sex === "female")));
  } else {
    wrap.appendChild(renderGrid("対象", people));
  }

  return wrap;
}
