import { el } from "./dom.js";
import { coeffsBjsq12BySex } from "../scoring/coefficients.js";
import { riskDemandControl, riskSupport, riskTotal, formatNumber } from "../scoring/risk.js";

function sliderRow(label, value, onChange) {
  const row = el("div", { className: "row" });
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";

  const left = el("div");
  left.style.minWidth = "140px";
  left.style.fontWeight = "800";
  left.style.fontSize = "12px";
  left.textContent = label;

  const input = el("input", { className: "input" });
  input.type = "range";
  input.min = "-1.5";
  input.max = "1.5";
  input.step = "0.1";
  input.value = String(value);
  input.style.flex = "1";
  input.addEventListener("input", () => onChange(Number(input.value)));

  const val = el("div", { className: "muted" });
  val.style.width = "62px";
  val.style.textAlign = "right";
  val.style.fontFamily = "var(--mono)";
  val.textContent = `${Number(value).toFixed(1)}`;

  row.appendChild(left);
  row.appendChild(input);
  row.appendChild(val);
  return row;
}

export function renderSimulator(analysis, { delta, onDelta }) {
  const wrap = el("div", { className: "grid" });
  wrap.appendChild(el("div", { className: "card__title", text: "施策シミュレーション（簡易）" }));
  wrap.appendChild(
    el("div", {
      className: "card__desc",
      text:
        "4尺度を仮に変化させた場合の推定リスク変化を確認します（全体平均に対する試算）。実データでは施策効果の推定には別途検討が必要です。",
    }),
  );

  if (analysis.sexMode === "split") {
    wrap.appendChild(
      el("div", {
        className: "notice",
        text: "施策シミュレーションは、上部の性別タブで「男性」または「女性」を選んでから実行してください（係数が性別で異なるため）。",
      }),
    );
    return wrap;
  }

  const coeff = coeffsBjsq12BySex(
    analysis.sexMode === "female" ? "female" : analysis.sexMode === "male" ? "male" : "unknown",
    analysis.meansVersion,
  );
  const before = analysis.overall.mean;
  const after = {
    workload: before.workload + (delta.workload ?? 0),
    control: before.control + (delta.control ?? 0),
    supervisorSupport: before.supervisorSupport + (delta.supervisorSupport ?? 0),
    coworkerSupport: before.coworkerSupport + (delta.coworkerSupport ?? 0),
  };

  const r1b = riskDemandControl(before, coeff);
  const r2b = riskSupport(before, coeff);
  const tb = riskTotal(r1b, r2b);

  const r1a = riskDemandControl(after, coeff);
  const r2a = riskSupport(after, coeff);
  const ta = riskTotal(r1a, r2a);

  const kpis = el("div", { className: "kpiGrid" });
  for (const k of [
    { label: "総合（現状）", value: formatNumber(tb, 0) },
    { label: "総合（施策後/仮）", value: formatNumber(ta, 0) },
    { label: "変化（差分）", value: Number.isFinite(ta - tb) ? `${(ta - tb).toFixed(0)}` : "—" },
  ]) {
    const box = el("div", { className: "kpi" });
    box.appendChild(el("div", { className: "kpi__label", text: k.label }));
    box.appendChild(el("div", { className: "kpi__value", text: k.value }));
    kpis.appendChild(box);
  }
  wrap.appendChild(kpis);

  wrap.appendChild(sliderRow("量的負担 Δ", delta.workload ?? 0, (v) => onDelta({ workload: v })));
  wrap.appendChild(sliderRow("コントロール Δ", delta.control ?? 0, (v) => onDelta({ control: v })));
  wrap.appendChild(sliderRow("上司の支援 Δ", delta.supervisorSupport ?? 0, (v) => onDelta({ supervisorSupport: v })));
  wrap.appendChild(sliderRow("同僚の支援 Δ", delta.coworkerSupport ?? 0, (v) => onDelta({ coworkerSupport: v })));

  const reset = el("button", { className: "btn", text: "リセット" });
  reset.type = "button";
  reset.addEventListener("click", () =>
    onDelta({ workload: 0, control: 0, supervisorSupport: 0, coworkerSupport: 0 }),
  );
  wrap.appendChild(reset);

  return wrap;
}
