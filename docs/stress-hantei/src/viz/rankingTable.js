import { el } from "./dom.js";
import { formatNumber } from "../scoring/risk.js";

export function renderRankingTable(analysis, opts = {}) {
  const wrap = el("div", {}, []);
  const titleText =
    opts.title ??
    (analysis.sexMode === "split"
      ? "集団別ランキング（男女別）"
      : analysis.sexMode === "male"
        ? "集団別ランキング（男性）"
        : analysis.sexMode === "female"
          ? "集団別ランキング（女性）"
          : "集団別ランキング（不明）");
  const title = el("div", { className: "card__title", text: titleText });
  wrap.appendChild(title);
  wrap.appendChild(
    el("div", {
      className: "card__desc",
      text: "総合健康リスクが高い順に並べています。切り口（集計）やフィルタで変化します。",
    }),
  );

  const table = el("table", { className: "table" });
  const thead = el("thead");
  const trh = el("tr");
  for (const h of ["集団", "n", "総合", "図1", "図2", "量的", "ｺﾝﾄﾛｰﾙ", "上司", "同僚"]) {
    trh.appendChild(el("th", { text: h }));
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = el("tbody");
  const rows = analysis.groups.slice(0, opts.large ? 999 : 14);
  for (const g of rows) {
    const tr = el("tr");
    tr.appendChild(el("td", { text: g.key }));
    tr.appendChild(el("td", { text: String(g.n) }));
    tr.appendChild(el("td", { text: formatNumber(g.risk.total, 0) }));
    tr.appendChild(el("td", { text: formatNumber(g.risk.demandControl, 0) }));
    tr.appendChild(el("td", { text: formatNumber(g.risk.support, 0) }));
    tr.appendChild(el("td", { text: formatNumber(g.mean.workload, 1) }));
    tr.appendChild(el("td", { text: formatNumber(g.mean.control, 1) }));
    tr.appendChild(el("td", { text: formatNumber(g.mean.supervisorSupport, 1) }));
    tr.appendChild(el("td", { text: formatNumber(g.mean.coworkerSupport, 1) }));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  return wrap;
}
