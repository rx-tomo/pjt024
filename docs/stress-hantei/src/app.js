import { createStore } from "./store.js";
import { DEMO_DATASETS, getDatasetById } from "./data/demoDatasets.js";
import { parseCsvFile } from "./data/csvImport.js";
import { analyzeDataset } from "./scoring/analyze.js";
import { renderStressCharts } from "./viz/stressChart.js";
import { renderRankingTable } from "./viz/rankingTable.js";
import { renderDistributions } from "./viz/distributions.js";
import { renderSimulator } from "./viz/simulator.js";
import { scoreBjsq12 } from "./scoring/bjsq12.js";

const STEPS = /** @type {const} */ (["data", "analysis", "results"]);
const ANALYSES = /** @type {const} */ ([
  { id: "stress", label: "判定図（2図＋総合）" },
  { id: "ranking", label: "ランキング（総合健康リスク）" },
  { id: "dist", label: "分布（尺度のばらつき）" },
  { id: "sim", label: "施策シミュレーション" },
]);

const appEl = document.getElementById("app");
const contentEl = document.getElementById("content");
const topbarRightEl = document.getElementById("topbarRight");
const pageTitleEl = document.getElementById("pageTitle");
const pageSubtitleEl = document.getElementById("pageSubtitle");

if (!appEl || !contentEl || !topbarRightEl || !pageTitleEl || !pageSubtitleEl) {
  throw new Error("Required DOM elements not found.");
}

const store = createStore({
  step: "data",
  datasetId: DEMO_DATASETS[0]?.id ?? null,
  previewDatasetId: DEMO_DATASETS[0]?.id ?? null,
  dataset: null,
  analysisId: "stress",
  groupBy: "group",
  filters: {},
  coefficientPreset: { presetId: "bjsq12_legacy", meansVersion: "legacy" }, // legacyデフォルト
  sexMode: "split", // デフォルト：男女別に集計・表示
  simulatorDelta: { workload: 0, control: 0, supervisorSupport: 0, coworkerSupport: 0 },
  ui: { message: null },
});

store.subscribe(render);

function setStep(step) {
  store.setState((s) => ({ ...s, step }));
}

function setDatasetId(datasetId) {
  const dataset = datasetId ? getDatasetById(datasetId) : null;
  store.setState((s) => ({
    ...s,
    datasetId,
    previewDatasetId: datasetId === "uploaded" ? s.previewDatasetId : datasetId,
    dataset,
    ui: { ...s.ui, message: null },
  }));
}

function setPreviewDatasetId(previewDatasetId) {
  store.setState((s) => ({ ...s, previewDatasetId }));
}

function setAnalysisId(analysisId) {
  store.setState((s) => ({ ...s, analysisId }));
}

function setGroupBy(groupBy) {
  store.setState((s) => ({ ...s, groupBy }));
}

function setFilter(key, value) {
  store.setState((s) => ({ ...s, filters: { ...s.filters, [key]: value } }));
}

function clearFilters() {
  store.setState((s) => ({ ...s, filters: {} }));
}

function setMeansVersion(meansVersion) {
  store.setState((s) => ({
    ...s,
    coefficientPreset: { ...s.coefficientPreset, meansVersion },
  }));
}

function setSexMode(sexMode) {
  store.setState((s) => ({ ...s, sexMode }));
}

function setSimulatorDelta(delta) {
  store.setState((s) => ({ ...s, simulatorDelta: { ...s.simulatorDelta, ...delta } }));
}

async function importCsv() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const dataset = await parseCsvFile(file);
      store.setState((s) => ({
        ...s,
        datasetId: "uploaded",
        dataset,
        ui: { ...s.ui, message: { type: "ok", text: "CSVを読み込みました。" } },
      }));
      setStep("analysis");
    } catch (e) {
      store.setState((s) => ({
        ...s,
        ui: { ...s.ui, message: { type: "error", text: e instanceof Error ? e.message : String(e) } },
      }));
    }
  });
  input.click();
}

function initStepper() {
  const steps = document.querySelectorAll(".stepper__step");
  steps.forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = btn.getAttribute("data-step");
      if (step && STEPS.includes(step)) setStep(step);
    });
  });
}

function renderTopbar(state) {
  const titleMap = {
    data: ["データ選択", "分析対象のサンプルデータを選んでください"],
    analysis: ["分析選択", "次に、実行する分析を選んでください"],
    results: ["分析結果", "切り口（性別/集計/フィルタ）で比較しながら確認できます"],
  };
  const [title, subtitle] = titleMap[state.step] ?? ["", ""];
  pageTitleEl.textContent = title;
  pageSubtitleEl.textContent = subtitle;

  topbarRightEl.replaceChildren();

  const datasetSelect = document.createElement("select");
  datasetSelect.className = "select";
  datasetSelect.title = "データセット切替（確認用）";
  datasetSelect.setAttribute("aria-label", "データセット切替");
  const options = [
    ...DEMO_DATASETS.map((d) => ({ id: d.id, label: `デモ: ${d.title}` })),
    { id: "uploaded", label: "アップロード: CSV" },
  ];
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    datasetSelect.appendChild(o);
  }
  datasetSelect.value = state.datasetId ?? "";
  datasetSelect.disabled = state.step === "data";
  datasetSelect.addEventListener("change", () => setDatasetId(datasetSelect.value));

  const meansSelect = document.createElement("select");
  meansSelect.className = "select";
  meansSelect.title = "全国平均（Technote表の併記値）";
  meansSelect.setAttribute("aria-label", "全国平均のバージョン");
  const m1 = document.createElement("option");
  m1.value = "legacy";
  m1.textContent = "全国平均: legacy（デフォルト）";
  const m2 = document.createElement("option");
  m2.value = "updated";
  m2.textContent = "全国平均: updated（併記値）";
  meansSelect.appendChild(m1);
  meansSelect.appendChild(m2);
  meansSelect.value = state.coefficientPreset.meansVersion;
  meansSelect.addEventListener("change", () => setMeansVersion(meansSelect.value));

  const go = (label, step) => {
    const b = document.createElement("button");
    b.className = "btn btn--ghost";
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => setStep(step));
    return b;
  };

  if (state.step !== "data") topbarRightEl.appendChild(go("← データ選択", "data"));
  if (state.step !== "analysis") topbarRightEl.appendChild(go("分析選択", "analysis"));
  if (state.step === "results") topbarRightEl.appendChild(datasetSelect);
  topbarRightEl.appendChild(meansSelect);
}

function labelSex(sex) {
  return sex === "male" ? "男性" : sex === "female" ? "女性" : "不明";
}

function renderDatasetPreviewTable(dataset) {
  const card = document.createElement("div");
  card.className = "card card--solid";

  const title = document.createElement("div");
  title.className = "card__title";
  title.textContent = "データプレビュー（全件）";
  card.appendChild(title);

  const desc = document.createElement("div");
  desc.className = "card__desc";
  desc.textContent = `データ: ${dataset.title}（全${dataset.employees.length}件。枠内をスクロールして確認できます。4尺度は q1..q12 から計算）`;
  card.appendChild(desc);

  const wrap = document.createElement("div");
  wrap.className = "tableWrap tableWrap--preview";
  wrap.style.marginTop = "10px";

  const table = document.createElement("table");
  table.className = "table";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  for (const h of ["ID", "部署", "性別", "年代", "職種", "拠点", "勤務", "量的負担", "コントロール", "上司支援", "同僚支援"]) {
    const th = document.createElement("th");
    th.textContent = h;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const e of dataset.employees) {
    const tr = document.createElement("tr");
    const s = scoreBjsq12(e.answers);
    const cells = [
      e.id,
      e.attrs?.group ?? "",
      labelSex(e.attrs?.sex ?? "unknown"),
      e.attrs?.ageBand ?? "",
      e.attrs?.role ?? "",
      e.attrs?.site ?? "",
      e.attrs?.shift ?? "",
      s.workload,
      s.control,
      s.supervisorSupport,
      s.coworkerSupport,
    ];
    for (const c of cells) {
      const td = document.createElement("td");
      td.textContent = String(c);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  card.appendChild(wrap);
  return card;
}

function renderDataStep(state) {
  const wrap = document.createElement("div");
  wrap.className = "grid";

  if (state.ui.message) {
    const n = document.createElement("div");
    n.className = "notice";
    n.textContent = state.ui.message.text;
    wrap.appendChild(n);
  }

  const header = document.createElement("div");
  header.className = "row";
  const btnCsv = document.createElement("button");
  btnCsv.className = "btn";
  btnCsv.type = "button";
  btnCsv.textContent = "CSVを読み込む";
  btnCsv.addEventListener("click", importCsv);
  header.appendChild(btnCsv);
  const hint = document.createElement("div");
  hint.className = "muted";
  hint.style.fontSize = "12px";
  hint.textContent = "※ CSVはブラウザ内で読み込みます（外部送信しません）";
  header.appendChild(hint);
  wrap.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "grid grid--cards";

  for (const d of DEMO_DATASETS) {
    const card = document.createElement("div");
    card.className = "card";
    const t = document.createElement("div");
    t.className = "row";
    t.style.justifyContent = "space-between";
    t.style.alignItems = "baseline";

    const h = document.createElement("h2");
    h.className = "card__title";
    h.textContent = d.title;
    t.appendChild(h);

    const b = document.createElement("button");
    b.className = "btn btn--primary";
    b.type = "button";
    b.textContent = "このデータを使う";
    b.addEventListener("click", () => {
      setDatasetId(d.id);
      setStep("analysis");
    });
    t.appendChild(b);

    const pv = document.createElement("button");
    pv.className = "btn";
    pv.type = "button";
    pv.textContent = "プレビュー";
    pv.addEventListener("click", () => setPreviewDatasetId(d.id));
    t.appendChild(pv);
    card.appendChild(t);

    const desc = document.createElement("div");
    desc.className = "card__desc";
    desc.textContent = d.description;
    card.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "card__meta";
    for (const tag of d.tags) {
      const badge = document.createElement("span");
      badge.className = tag.kind === "focus" ? "badge badge--brand" : "badge";
      badge.textContent = tag.label;
      meta.appendChild(badge);
    }
    card.appendChild(meta);

    grid.appendChild(card);
  }

  wrap.appendChild(grid);

  const previewId = state.previewDatasetId ?? DEMO_DATASETS[0]?.id ?? null;
  const previewDataset = previewId ? getDatasetById(previewId) : null;
  if (previewDataset) {
    wrap.appendChild(renderDatasetPreviewTable(previewDataset));
  }

  return wrap;
}

function renderAnalysisStep(state) {
  const wrap = document.createElement("div");
  wrap.className = "grid";

  const selected = DEMO_DATASETS.find((d) => d.id === state.datasetId);
  const card = document.createElement("div");
  card.className = "card";
  const title = document.createElement("div");
  title.className = "card__title";
  title.textContent = `選択中データ: ${selected?.title ?? "（未選択）"}`;
  const desc = document.createElement("div");
  desc.className = "card__desc";
  desc.textContent = selected?.description ?? "先にデータを選択してください。";
  card.appendChild(title);
  card.appendChild(desc);
  wrap.appendChild(card);

  const grid = document.createElement("div");
  grid.className = "grid grid--cards";

  for (const a of ANALYSES) {
    const c = document.createElement("div");
    c.className = "card";
    const h = document.createElement("h2");
    h.className = "card__title";
    h.textContent = a.label;
    c.appendChild(h);
    const p = document.createElement("div");
    p.className = "card__desc";
    p.textContent =
      a.id === "stress"
        ? "2つの判定図（等リスク線）と、総合健康リスクを表示します。"
        : a.id === "ranking"
          ? "総合健康リスクが高い集団を上位から並べ、比較しやすくします。"
          : a.id === "dist"
            ? "4尺度の分布を見て、平均との差・ばらつきを把握します。"
            : "尺度を仮に変化させた場合の推定リスク変化を確認します。";
    c.appendChild(p);

    const b = document.createElement("button");
    b.className = "btn btn--primary";
    b.type = "button";
    b.textContent = "この分析を見る";
    b.addEventListener("click", () => {
      setAnalysisId(a.id);
      setStep("results");
    });
    c.appendChild(b);
    grid.appendChild(c);
  }

  wrap.appendChild(grid);
  return wrap;
}

function renderResultsOrExplore(state) {
  const dataset = state.dataset ?? (state.datasetId ? getDatasetById(state.datasetId) : null);
  if (!dataset) {
    const n = document.createElement("div");
    n.className = "notice";
    n.textContent = "データが未選択です。先にデータを選んでください。";
    return n;
  }

  const analysis = analyzeDataset(dataset, {
    groupBy: state.groupBy,
    filters: state.filters,
    meansVersion: state.coefficientPreset.meansVersion,
    sexMode: state.sexMode,
  });

  const wrap = document.createElement("div");
  wrap.className = "grid";

  // analysis description (accordion)
  const details = document.createElement("details");
  details.className = "accordion";
  const summary = document.createElement("summary");
  const analysisLabel = ANALYSES.find((a) => a.id === state.analysisId)?.label ?? state.analysisId;
  summary.textContent = `この分析について（目的・計算・参考）: ${analysisLabel}`;
  details.appendChild(summary);
  const body = document.createElement("div");
  body.className = "accordion__body";
  body.innerHTML = buildAnalysisDescriptionHtml(state.analysisId);
  details.appendChild(body);
  wrap.appendChild(details);

  const bar = document.createElement("div");
  bar.className = "row";

  const sexTabs = document.createElement("div");
  sexTabs.className = "tabs";
  sexTabs.setAttribute("aria-label", "性別表示モード");

  const sexChoices = [
    { id: "split", label: "男女別" },
    { id: "male", label: "男性" },
    { id: "female", label: "女性" },
    { id: "unknown", label: "不明" },
  ];
  for (const c of sexChoices) {
    const b = document.createElement("button");
    b.className = "tabs__tab";
    b.type = "button";
    b.textContent = c.label;
    b.setAttribute("aria-selected", c.id === state.sexMode ? "true" : "false");
    b.addEventListener("click", () => setSexMode(c.id));
    sexTabs.appendChild(b);
  }
  bar.appendChild(sexTabs);

  const groupBySelect = document.createElement("select");
  groupBySelect.className = "select";
  groupBySelect.setAttribute("aria-label", "集計単位（groupBy）");
  for (const g of analysis.availableGroupBys) {
    const o = document.createElement("option");
    o.value = g.id;
    o.textContent = `集計: ${g.label}`;
    groupBySelect.appendChild(o);
  }
  groupBySelect.value = analysis.availableGroupBys.some((g) => g.id === state.groupBy)
    ? state.groupBy
    : analysis.availableGroupBys[0]?.id ?? "group";
  groupBySelect.addEventListener("change", () => setGroupBy(groupBySelect.value));
  bar.appendChild(groupBySelect);

  const filterKeys = analysis.availableFilters;
  for (const f of filterKeys) {
    const sel = document.createElement("select");
    sel.className = "select";
    sel.setAttribute("aria-label", `フィルタ: ${f.label}`);
    const all = document.createElement("option");
    all.value = "";
    all.textContent = `フィルタ: ${f.label}（すべて）`;
    sel.appendChild(all);
    for (const v of f.values) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = `${f.label}: ${v}`;
      sel.appendChild(o);
    }
    sel.value = state.filters[f.id] ?? "";
    sel.addEventListener("change", () => setFilter(f.id, sel.value || undefined));
    bar.appendChild(sel);
  }

  const clear = document.createElement("button");
  clear.className = "btn";
  clear.type = "button";
  clear.textContent = "フィルタ解除";
  clear.addEventListener("click", clearFilters);
  bar.appendChild(clear);

  wrap.appendChild(bar);

  const renderKpiGrid = (kpis) => {
    const grid = document.createElement("div");
    grid.className = "kpiGrid";
    for (const k of kpis) {
      const box = document.createElement("div");
      box.className = "kpi";
      const l = document.createElement("div");
      l.className = "kpi__label";
      l.textContent = k.label;
      const v = document.createElement("div");
      v.className = "kpi__value";
      v.textContent = k.value;
      box.appendChild(l);
      box.appendChild(v);
      grid.appendChild(box);
    }
    return grid;
  };

  if (analysis.sexMode === "split" && analysis.overallBySex) {
    const splitKpi = document.createElement("div");
    splitKpi.className = "grid";
    splitKpi.style.gap = "10px";
    const mk = (label, agg) => [
      { label: `${label}: 対象人数 (n)`, value: String(agg.n) },
      { label: `${label}: 平均 量的負担`, value: analysis.helpers.formatNumber(agg.mean.workload, 1) },
      { label: `${label}: 平均 ｺﾝﾄﾛｰﾙ`, value: analysis.helpers.formatNumber(agg.mean.control, 1) },
      { label: `${label}: 総合健康リスク`, value: analysis.helpers.formatNumber(agg.risk.total, 0) },
    ];
    splitKpi.appendChild(renderKpiGrid(mk("男性", analysis.overallBySex.male)));
    splitKpi.appendChild(renderKpiGrid(mk("女性", analysis.overallBySex.female)));
    wrap.appendChild(splitKpi);
  } else {
    wrap.appendChild(renderKpiGrid(analysis.kpis));
  }

  const split = document.createElement("div");
  split.className = "split";

  const left = document.createElement("div");
  left.className = state.analysisId === "stress" || state.analysisId === "ranking" ? "card card--solid" : "card";
  const right = document.createElement("div");
  right.className = state.analysisId === "stress" || state.analysisId === "ranking" ? "card card--solid" : "card";

  if (state.analysisId === "stress") {
    left.appendChild(renderStressCharts(analysis, { mode: state.step }));
    right.appendChild(renderRankingTable(analysis));
  } else if (state.analysisId === "ranking") {
    left.appendChild(renderRankingTable(analysis, { large: true }));
    right.appendChild(renderStressCharts(analysis, { compact: true }));
  } else if (state.analysisId === "dist") {
    left.appendChild(renderDistributions(analysis));
    right.appendChild(renderRankingTable(analysis));
  } else {
    left.appendChild(
      renderSimulator(analysis, {
        delta: state.simulatorDelta,
        onDelta: setSimulatorDelta,
      }),
    );
    right.appendChild(renderStressCharts(analysis, { overlayDelta: state.simulatorDelta }));
  }

  split.appendChild(left);
  split.appendChild(right);
  wrap.appendChild(split);

  return wrap;
}

function buildAnalysisDescriptionHtml(analysisId) {
  // NOTE: ここはHTML文字列だが、入力は固定で外部入力を混ぜない（XSS回避）
  const common = `
    <ul>
      <li>このデモは「職業性ストレス簡易調査票（簡易版12項目）」の回答（q1..q12）から、4尺度（量的負担/コントロール/上司支援/同僚支援）を算出します。</li>
      <li>健康リスクは、係数と <code>100×exp(...)</code> の式で算出します（ブラウザ内でリアルタイム計算）。</li>
      <li>総合健康リスクは、図1×図2÷100 で合成します。</li>
      <li><code>全国平均: legacy</code> はテクニカルノートの掲載値、<code>updated</code> は併記されている訂正値（あるいは更新値）として切替できるようにしています。</li>
    </ul>
    <div style="margin-top:8px">参考（入口）：<a href="https://mental.m.u-tokyo.ac.jp/old/hanteizu/" target="_blank" rel="noopener">仕事のストレス判定図</a>（配下にテクニカルノート/質問票/結果の読み方/使用条件など）</div>
  `;

  if (analysisId === "stress") {
    return `
      <div><strong>目的</strong>：集団（部署/職種/拠点など）の平均点から、仕事のストレス要因の特徴と、相対的な健康リスク（標準=100）を把握します。</div>
      <div style="margin-top:8px"><strong>計算</strong>：図1（量的負担×コントロール）と図2（上司支援×同僚支援）を別々に計算し、最後に総合します。</div>
      ${common}
    `;
  }
  if (analysisId === "ranking") {
    return `
      <div><strong>目的</strong>：総合健康リスクが相対的に高い集団を上位から見つけ、比較の起点を作ります。</div>
      ${common}
    `;
  }
  if (analysisId === "dist") {
    return `
      <div><strong>目的</strong>：平均だけでなく「ばらつき（分布）」を見ることで、集団の状態像を掴みやすくします。</div>
      ${common}
    `;
  }
  return `
    <div><strong>目的</strong>：4尺度を仮に変化させた場合に、推定リスクがどの方向に動くかを確認します（説明用）。</div>
    <div style="margin-top:8px"><strong>注意</strong>：これは因果推論や効果推定を保証するものではなく、あくまで「式に入れたらどうなるか」の試算です。</div>
    ${common}
  `;
}

function render() {
  const state = store.getState();

  // stepper current 표시
  const stepButtons = document.querySelectorAll(".stepper__step");
  stepButtons.forEach((btn) => {
    const step = btn.getAttribute("data-step");
    btn.setAttribute("aria-current", step === state.step ? "step" : "false");
  });

  renderTopbar(state);

  if (!state.dataset) {
    setDatasetId(state.datasetId);
  }

  contentEl.replaceChildren();
  if (state.step === "data") contentEl.appendChild(renderDataStep(state));
  else if (state.step === "analysis") contentEl.appendChild(renderAnalysisStep(state));
  else contentEl.appendChild(renderResultsOrExplore(state));
}

initStepper();
render();
