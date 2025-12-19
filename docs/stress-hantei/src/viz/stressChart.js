import { coeffsBjsq12BySex } from "../scoring/coefficients.js";
import { riskDemandControl, riskSupport, riskTotal, formatNumber } from "../scoring/risk.js";
import { el, svgEl } from "./dom.js";

const PALETTE = ["#7c3aed", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

function makeLinearScale(domainMin, domainMax, rangeMin, rangeMax) {
  const d = domainMax - domainMin;
  const r = rangeMax - rangeMin;
  return (x) => rangeMin + ((x - domainMin) / d) * r;
}

function sampleRiskLine({ fnY, xMin, xMax, yMin, yMax, steps = 120 }) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps;
    const y = fnY(x);
    if (Number.isFinite(y) && y >= yMin && y <= yMax) pts.push([x, y]);
    else pts.push(null);
  }

  // split into segments (discontinuity)
  const segments = [];
  let cur = [];
  for (const p of pts) {
    if (!p) {
      if (cur.length >= 2) segments.push(cur);
      cur = [];
      continue;
    }
    cur.push(p);
  }
  if (cur.length >= 2) segments.push(cur);
  return segments;
}

function renderChart2D({
  title,
  xLabel,
  yLabel,
  domain,
  riskLines,
  points,
  overlayPoint,
}) {
  const width = 560;
  const height = 380;
  const pad = { l: 54, r: 18, t: 36, b: 44 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const x = makeLinearScale(domain.xMin, domain.xMax, pad.l, pad.l + innerW);
  const y = makeLinearScale(domain.yMin, domain.yMax, pad.t + innerH, pad.t);

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    role: "img",
    "aria-label": title,
  });

  const wrap = el("div", { className: "chartWrap" });
  const tooltip = el("div", { className: "chartTooltip" });
  tooltip.dataset.open = "false";

  const bg = svgEl("rect", {
    x: pad.l,
    y: pad.t,
    width: innerW,
    height: innerH,
    rx: 14,
    fill: "var(--chart-plot-bg)",
    stroke: "var(--chart-plot-border)",
  });
  svg.appendChild(bg);

  // grid
  for (let v = domain.xMin; v <= domain.xMax; v++) {
    const px = x(v);
    svg.appendChild(
      svgEl("line", {
        x1: px,
        y1: pad.t,
        x2: px,
        y2: pad.t + innerH,
        stroke: "var(--chart-grid)",
      }),
    );
  }
  for (let v = domain.yMin; v <= domain.yMax; v++) {
    const py = y(v);
    svg.appendChild(
      svgEl("line", {
        x1: pad.l,
        y1: py,
        x2: pad.l + innerW,
        y2: py,
        stroke: "var(--chart-grid)",
      }),
    );
  }

  // axes labels
  svg.appendChild(
    svgEl("text", {
      x: pad.l,
      y: 20,
      fill: "var(--chart-text)",
      "font-size": "12",
      "font-weight": "800",
    }, [document.createTextNode(title)]),
  );

  svg.appendChild(
    svgEl("text", {
      x: pad.l + innerW / 2,
      y: height - 12,
      fill: "var(--chart-muted)",
      "font-size": "11",
      "font-weight": "700",
      "text-anchor": "middle",
    }, [document.createTextNode(xLabel)]),
  );

  svg.appendChild(
    svgEl("text", {
      x: 14,
      y: pad.t + innerH / 2,
      fill: "var(--chart-muted)",
      "font-size": "11",
      "font-weight": "700",
      transform: `rotate(-90 14 ${pad.t + innerH / 2})`,
      "text-anchor": "middle",
    }, [document.createTextNode(yLabel)]),
  );

  // risk lines
  for (const rl of riskLines) {
    for (const seg of rl.segments) {
      const d = seg
        .map(([sx, sy], idx) => `${idx === 0 ? "M" : "L"} ${x(sx).toFixed(2)} ${y(sy).toFixed(2)}`)
        .join(" ");
      svg.appendChild(
        svgEl("path", {
          d,
          fill: "none",
          stroke: rl.color,
          "stroke-width": rl.width,
          "stroke-dasharray": rl.dash ?? "",
          opacity: rl.opacity,
        }),
      );
    }
  }

  // points
  const circleToPoint = new WeakMap();
  const setTipPos = (clientX, clientY) => {
    const rect = wrap.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const padding = 12;
    const maxLeft = rect.width - padding;
    const maxTop = rect.height - padding;
    const left = Math.max(padding, Math.min(maxLeft, mx + 14));
    const top = Math.max(padding, Math.min(maxTop, my + 14));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const showTooltip = (p, clientX, clientY) => {
    tooltip.innerHTML = `
      <div class="chartTooltip__title">${escapeHtml(p.key)}</div>
      <div class="chartTooltip__meta">n=${escapeHtml(String(p.n))}</div>
      <div class="chartTooltip__grid">
        <div class="chartTooltip__k">総合</div><div class="chartTooltip__v">${escapeHtml(formatNumber(p.risk.total, 0))}</div>
        <div class="chartTooltip__k">図1</div><div class="chartTooltip__v">${escapeHtml(formatNumber(p.risk.demandControl, 0))}</div>
        <div class="chartTooltip__k">図2</div><div class="chartTooltip__v">${escapeHtml(formatNumber(p.risk.support, 0))}</div>
        <div class="chartTooltip__k">${escapeHtml(p.axes.x)}</div><div class="chartTooltip__v">${escapeHtml(formatNumber(p.x, 1))}</div>
        <div class="chartTooltip__k">${escapeHtml(p.axes.y)}</div><div class="chartTooltip__v">${escapeHtml(formatNumber(p.y, 1))}</div>
      </div>
    `;
    tooltip.dataset.open = "true";
    if (typeof clientX === "number" && typeof clientY === "number") setTipPos(clientX, clientY);
  };

  const hideTooltip = () => {
    tooltip.dataset.open = "false";
  };

  for (const p of points) {
    const c = svgEl("circle", {
      cx: x(p.x),
      cy: y(p.y),
      r: p.r,
      fill: p.fill,
      stroke: "var(--chart-point-stroke)",
      "stroke-width": "1",
      opacity: p.opacity ?? "1",
    });
    circleToPoint.set(c, p);
    // native tooltip fallback
    c.appendChild(svgEl("title", {}, [document.createTextNode(p.title)]));
    c.setAttribute("tabindex", "0");
    c.style.cursor = "pointer";
    const baseR = Number(p.r);
    c.addEventListener("mouseenter", (ev) => {
      c.setAttribute("r", String(baseR + 1.5));
      showTooltip(p, ev.clientX, ev.clientY);
    });
    c.addEventListener("mousemove", (ev) => setTipPos(ev.clientX, ev.clientY));
    c.addEventListener("mouseleave", () => {
      c.setAttribute("r", String(baseR));
      hideTooltip();
    });
    c.addEventListener("focus", () => showTooltip(p));
    c.addEventListener("blur", () => hideTooltip());
    svg.appendChild(c);
  }

  if (overlayPoint) {
    const c = svgEl("circle", {
      cx: x(overlayPoint.x),
      cy: y(overlayPoint.y),
      r: 6,
      fill: "transparent",
      stroke: "rgba(34,197,94,0.95)",
      "stroke-width": "2",
    });
    c.appendChild(svgEl("title", {}, [document.createTextNode(overlayPoint.title)]));
    svg.appendChild(c);
  }

  // ticks
  for (let v = domain.xMin; v <= domain.xMax; v++) {
    svg.appendChild(
      svgEl("text", {
        x: x(v),
        y: pad.t + innerH + 18,
        fill: "var(--chart-tick)",
        "font-size": "10",
        "text-anchor": "middle",
      }, [document.createTextNode(String(v))]),
    );
  }
  for (let v = domain.yMin; v <= domain.yMax; v++) {
    svg.appendChild(
      svgEl("text", {
        x: pad.l - 10,
        y: y(v) + 3,
        fill: "var(--chart-tick)",
        "font-size": "10",
        "text-anchor": "end",
      }, [document.createTextNode(String(v))]),
    );
  }

  wrap.appendChild(svg);
  wrap.appendChild(tooltip);
  // background click hides tooltip (small UX improvement)
  wrap.addEventListener("pointerdown", (ev) => {
    const t = ev.target;
    if (t && typeof t === "object" && t instanceof SVGCircleElement) return;
    hideTooltip();
  });
  return wrap;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeRiskLinesDemandControl(coeff, domain, levels) {
  const lines = [];
  for (const r of levels) {
    const ln = Math.log(r / 100);
    const fnY = (x) => coeff.B + (ln - (x - coeff.A) * coeff.alpha) / coeff.beta;
    const segments = sampleRiskLine({
      fnY,
      xMin: domain.xMin,
      xMax: domain.xMax,
      yMin: domain.yMin,
      yMax: domain.yMax,
    });
    lines.push({
      r,
      segments,
      color: r === 100 ? "var(--chart-risk-major)" : "var(--chart-risk-minor)",
      width: r === 100 ? 1.5 : 1,
      dash: r === 100 ? "" : "4 6",
      opacity: 1,
    });
  }
  return lines;
}

function makeRiskLinesSupport(coeff, domain, levels) {
  const lines = [];
  for (const r of levels) {
    const ln = Math.log(r / 100);
    const fnY = (x) => coeff.D + (ln - (x - coeff.C) * coeff.gamma) / coeff.delta;
    const segments = sampleRiskLine({
      fnY,
      xMin: domain.xMin,
      xMax: domain.xMax,
      yMin: domain.yMin,
      yMax: domain.yMax,
    });
    lines.push({
      r,
      segments,
      color: r === 100 ? "var(--chart-risk-major)" : "var(--chart-risk-minor)",
      width: r === 100 ? 1.5 : 1,
      dash: r === 100 ? "" : "4 6",
      opacity: 1,
    });
  }
  return lines;
}

function makeGroupPoints(groups, keyLabel) {
  return groups.map((g, idx) => ({
    id: g.key,
    key: g.key,
    n: g.n,
    mean: g.mean,
    risk: g.risk,
    axes: keyLabel,
    x: g.mean[keyLabel.x],
    y: g.mean[keyLabel.y],
    r: Math.max(4, Math.min(7, 4 + Math.log10(g.n + 1))),
    fill: PALETTE[idx % PALETTE.length],
    title: `${g.key}\n n=${g.n}\n 総合=${formatNumber(g.risk.total, 0)} (図1=${formatNumber(
      g.risk.demandControl,
      0,
    )}, 図2=${formatNumber(g.risk.support, 0)})`,
    opacity: idx < 12 ? 1 : 0.55,
  }));
}

export function renderStressCharts(analysis, options = {}) {
  const wrap = el("div", {}, []);

  const header = el("div", { className: "row" }, []);
  header.style.justifyContent = "space-between";
  header.style.alignItems = "baseline";
  header.appendChild(
    el("div", { className: "card__title", text: "判定図（係数から動的に描画）" }),
  );
  header.appendChild(
    el("div", {
      className: "muted",
      text: `集計: ${analysis.availableGroupBys.find((g) => g.id === analysis.groupById)?.label ?? analysis.groupById}`,
    }),
  );
  wrap.appendChild(header);

  const domain = { xMin: 3, xMax: 12, yMin: 3, yMax: 12 };
  const levels = [60, 80, 100, 120, 140, 160];

  const visibleGroups = analysis.groups.slice(0, options.compact ? 8 : 18);

  const grid = el("div", { className: "grid" }, []);
  grid.style.gap = "12px";

  const renderForSex = (sex, label) => {
    const coeff = coeffsBjsq12BySex(sex, analysis.meansVersion);
    const groups = visibleGroups.filter((g) => (analysis.sexMode === "split" ? g.sex === sex : true));

    const chart1 = renderChart2D({
      title: `${label}: 量的負担 × コントロール（図1）`,
      xLabel: "量的負担（3〜12）",
      yLabel: "コントロール（3〜12）",
      domain,
      riskLines: makeRiskLinesDemandControl(coeff, domain, levels),
      points: makeGroupPoints(groups, { x: "workload", y: "control" }),
      overlayPoint: options.overlayDelta
        ? {
            x: analysis.overall.mean.workload + (options.overlayDelta.workload ?? 0),
            y: analysis.overall.mean.control + (options.overlayDelta.control ?? 0),
            title: `${label}: 全体（施策後の仮点）`,
          }
        : null,
    });

    const chart2 = renderChart2D({
      title: `${label}: 上司の支援 × 同僚の支援（図2）`,
      xLabel: "上司の支援（3〜12）",
      yLabel: "同僚の支援（3〜12）",
      domain,
      riskLines: makeRiskLinesSupport(coeff, domain, levels),
      points: makeGroupPoints(groups, { x: "supervisorSupport", y: "coworkerSupport" }),
      overlayPoint: options.overlayDelta
        ? {
            x: analysis.overall.mean.supervisorSupport + (options.overlayDelta.supervisorSupport ?? 0),
            y: analysis.overall.mean.coworkerSupport + (options.overlayDelta.coworkerSupport ?? 0),
            title: `${label}: 全体（施策後の仮点）`,
          }
        : null,
    });

    grid.appendChild(chart1);
    grid.appendChild(chart2);
  };

  if (analysis.sexMode === "split") {
    renderForSex("male", "男性");
    renderForSex("female", "女性");
  } else if (analysis.sexMode === "male") {
    renderForSex("male", "男性");
  } else if (analysis.sexMode === "female") {
    renderForSex("female", "女性");
  } else {
    renderForSex("unknown", "不明");
  }

  wrap.appendChild(grid);

  if (options.overlayDelta) {
    const meanAfter = {
      workload: analysis.overall.mean.workload + (options.overlayDelta.workload ?? 0),
      control: analysis.overall.mean.control + (options.overlayDelta.control ?? 0),
      supervisorSupport: analysis.overall.mean.supervisorSupport + (options.overlayDelta.supervisorSupport ?? 0),
      coworkerSupport: analysis.overall.mean.coworkerSupport + (options.overlayDelta.coworkerSupport ?? 0),
    };
    const coeff = coeffsBjsq12BySex(
      analysis.sexMode === "female" ? "female" : analysis.sexMode === "male" ? "male" : "unknown",
      analysis.meansVersion,
    );
    const r1 = riskDemandControl(meanAfter, coeff);
    const r2 = riskSupport(meanAfter, coeff);
    const total = riskTotal(r1, r2);
    const note = el("div", { className: "card__desc" });
    note.textContent = `施策後（仮）の推定: 図1=${formatNumber(r1, 0)}, 図2=${formatNumber(r2, 0)}, 総合=${formatNumber(
      total,
      0,
    )}`;
    wrap.appendChild(note);
  } else {
    const note = el("div", { className: "card__desc" });
    note.textContent =
      "点にマウスを載せると、集団名・n・健康リスクなどのツールチップが表示されます。等リスク線は係数と式から計算して描画しており、元サイトの画像を貼り付けているわけではありません。";
    wrap.appendChild(note);
  }

  return wrap;
}
