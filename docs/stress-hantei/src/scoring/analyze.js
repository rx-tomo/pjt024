import { scoreBjsq12 } from "./bjsq12.js";
import { coeffsBjsq12BySex } from "./coefficients.js";
import { riskDemandControl, riskSupport, riskTotal, formatNumber } from "./risk.js";

function uniq(values) {
  return [...new Set(values.filter((v) => v != null && String(v).trim() !== ""))];
}

function meanOfNumbers(nums) {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function applyFilters(rows, filters) {
  const active = Object.entries(filters ?? {}).filter(([, v]) => v != null && String(v).trim() !== "");
  if (active.length === 0) return rows;
  return rows.filter((r) => active.every(([k, v]) => String(r.attrs?.[k] ?? "") === String(v)));
}

function detectDimensions(dataset) {
  const dims = [
    { id: "group", label: "部署/グループ" },
    { id: "role", label: "職種" },
    { id: "site", label: "拠点" },
    { id: "shift", label: "勤務形態" },
    { id: "ageBand", label: "年代" },
    { id: "phase", label: "施策前後" },
  ];

  const available = dims.filter((d) =>
    dataset.employees.some((e) => (d.id === "sex" ? e.attrs?.sex : e.attrs?.[d.id]) != null),
  );

  const filters = [
    {
      id: "sex",
      label: "性別",
      values: uniq(dataset.employees.map((e) => e.attrs?.sex ?? "unknown"))
        .map((s) => String(s))
        .sort(),
    },
    ...available.map((d) => ({
      ...d,
      values: uniq(dataset.employees.map((e) => e.attrs?.[d.id])).sort(),
    })),
  ]
    .filter((d) => d.values.length > 1);

  return { groupBys: available, filters };
}

function makeAggregate(key, people, meansVersion) {
  const scores = people.map((p) => p.scores);
  const mean = {
    workload: meanOfNumbers(scores.map((s) => s.workload)),
    control: meanOfNumbers(scores.map((s) => s.control)),
    supervisorSupport: meanOfNumbers(scores.map((s) => s.supervisorSupport)),
    coworkerSupport: meanOfNumbers(scores.map((s) => s.coworkerSupport)),
  };

  const sexCounts = people.reduce(
    (acc, p) => {
      const sex = p.attrs.sex;
      if (sex === "female") acc.female += 1;
      else if (sex === "male") acc.male += 1;
      else acc.unknown += 1;
      return acc;
    },
    { male: 0, female: 0, unknown: 0 },
  );

  // 性別別集計の前提：係数は集団の性別に対応するものを使う
  // ただし、ここでは集団が単一sexにフィルタされていることを想定（UI側でmale/femaleを切替）
  const inferredSex =
    sexCounts.male > 0 && sexCounts.female === 0 ? "male" : sexCounts.female > 0 && sexCounts.male === 0 ? "female" : "unknown";
  const coeff = coeffsBjsq12BySex(inferredSex, meansVersion);
  const r1 = riskDemandControl(mean, coeff);
  const r2 = riskSupport(mean, coeff);
  const total = riskTotal(r1, r2);

  return {
    key,
    n: people.length,
    mean,
    sexCounts,
    inferredSex,
    risk: { demandControl: r1, support: r2, total },
  };
}

export function analyzeDataset(dataset, { groupBy, filters, meansVersion, sexMode }) {
  const { groupBys, filters: availableFilters } = detectDimensions(dataset);
  const groupById = groupBys.some((g) => g.id === groupBy) ? groupBy : groupBys[0]?.id ?? "group";

  const peopleAll = dataset.employees.map((e) => ({
    id: e.id,
    attrs: {
      group: e.attrs?.group ?? "未設定",
      role: e.attrs?.role ?? "未設定",
      site: e.attrs?.site ?? "未設定",
      shift: e.attrs?.shift ?? "未設定",
      sex: e.attrs?.sex ?? "unknown",
      ageBand: e.attrs?.ageBand ?? "未設定",
      phase: e.attrs?.phase ?? "未設定",
    },
    scores: scoreBjsq12(e.answers),
  }));

  let people = applyFilters(peopleAll, filters);
  const mode = sexMode ?? "split";
  if (mode === "male" || mode === "female" || mode === "unknown") {
    people = people.filter((p) => p.attrs.sex === mode);
  }

  const groupsMap = new Map();
  for (const p of people) {
    const k = String(p.attrs[groupById] ?? "未設定");
    if (!groupsMap.has(k)) groupsMap.set(k, []);
    groupsMap.get(k).push(p);
  }

  const groupsRaw = [...groupsMap.entries()].map(([key, items]) => ({ key, items }));

  const groups =
    mode === "split"
      ? groupsRaw
          .flatMap(({ key, items }) => {
            const bySex = new Map();
            for (const p of items) {
              const sx = p.attrs.sex;
              if (!bySex.has(sx)) bySex.set(sx, []);
              bySex.get(sx).push(p);
            }
            const label = (sx) => (sx === "male" ? "男性" : sx === "female" ? "女性" : "不明");
            return [...bySex.entries()].map(([sx, xs]) => ({
              ...makeAggregate(`${key} / ${label(sx)}`, xs, meansVersion),
              sex: sx,
              baseKey: key,
            }));
          })
          .sort((a, b) => b.risk.total - a.risk.total)
      : groupsRaw.map(({ key, items }) => ({ ...makeAggregate(key, items, meansVersion) })).sort((a, b) => b.risk.total - a.risk.total);

  const overall = makeAggregate("全体", people, meansVersion);
  const overallBySex =
    mode === "split"
      ? {
          male: makeAggregate("全体 / 男性", people.filter((p) => p.attrs.sex === "male"), meansVersion),
          female: makeAggregate("全体 / 女性", people.filter((p) => p.attrs.sex === "female"), meansVersion),
          unknown: makeAggregate("全体 / 不明", people.filter((p) => p.attrs.sex !== "male" && p.attrs.sex !== "female"), meansVersion),
        }
      : null;

  const kpis = [
    { label: "対象人数 (n)", value: String(overall.n) },
    { label: "集団数", value: String(groups.length) },
    { label: "平均: 量的負担", value: formatNumber(overall.mean.workload, 1) },
    { label: "平均: コントロール", value: formatNumber(overall.mean.control, 1) },
    { label: "図1 健康リスク", value: formatNumber(overall.risk.demandControl, 0) },
    { label: "図2 健康リスク", value: formatNumber(overall.risk.support, 0) },
    { label: "総合健康リスク", value: formatNumber(overall.risk.total, 0) },
  ];

  return {
    dataset: { id: dataset.id, title: dataset.title, description: dataset.description },
    meansVersion,
    availableGroupBys: groupBys,
    availableFilters,
    groupById,
    people, // for distributions
    groups,
    overall,
    overallBySex,
    kpis,
    sexMode: mode,
    helpers: {
      round1,
      formatNumber,
    },
  };
}
