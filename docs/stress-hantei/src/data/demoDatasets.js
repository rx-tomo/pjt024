import { mulberry32, normal, clamp } from "./rng.js";

const TRIPLETS = (() => {
  const out = [];
  for (let a = 1; a <= 4; a++) {
    for (let b = 1; b <= 4; b++) {
      for (let c = 1; c <= 4; c++) out.push([a, b, c]);
    }
  }
  return out;
})();

function pickTripletForSum(sum, rng) {
  const target = clamp(Math.round(sum), 3, 12);
  const matches = TRIPLETS.filter((t) => t[0] + t[1] + t[2] === target);
  return matches[Math.floor(rng() * matches.length)];
}

function makeAnswersFromScaleTargets(targets, rng) {
  const w = pickTripletForSum(targets.workload, rng);
  const c = pickTripletForSum(targets.control, rng);
  const ss = pickTripletForSum(targets.supervisorSupport, rng);
  const cs = pickTripletForSum(targets.coworkerSupport, rng);
  return {
    q1: w[0],
    q2: w[1],
    q3: w[2],
    q4: c[0],
    q5: c[1],
    q6: c[2],
    q7: ss[0],
    q8: cs[0],
    q9: ss[1],
    q10: cs[1],
    q11: ss[2],
    q12: cs[2],
  };
}

function sampleFromWeights(items, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function buildDataset(def) {
  const rng = mulberry32(def.seed);

  const employees = [];
  for (let i = 0; i < def.n; i++) {
    const group = sampleFromWeights(def.groups.map((g) => g.id), def.groups.map((g) => g.weight), rng);
    const groupDef = def.groups.find((g) => g.id === group);
    const site = sampleFromWeights(def.sites.items, def.sites.weights, rng);
    const role = sampleFromWeights(def.roles.items, def.roles.weights, rng);
    const shift = sampleFromWeights(def.shifts.items, def.shifts.weights, rng);
    const sex = sampleFromWeights(def.sex.items, def.sex.weights, rng);
    const ageBand = sampleFromWeights(def.ageBands.items, def.ageBands.weights, rng);
    const phase = def.phases ? sampleFromWeights(def.phases.items, def.phases.weights, rng) : undefined;

    const mean = groupDef?.means ?? def.means;
    const sd = groupDef?.sd ?? def.sd;
    const phaseDelta = def.phaseDeltas?.[phase] ?? { workload: 0, control: 0, supervisorSupport: 0, coworkerSupport: 0 };

    const targets = {
      workload: clamp(normal(rng, mean.workload + phaseDelta.workload, sd.workload), 3, 12),
      control: clamp(normal(rng, mean.control + phaseDelta.control, sd.control), 3, 12),
      supervisorSupport: clamp(normal(rng, mean.supervisorSupport + phaseDelta.supervisorSupport, sd.supervisorSupport), 3, 12),
      coworkerSupport: clamp(normal(rng, mean.coworkerSupport + phaseDelta.coworkerSupport, sd.coworkerSupport), 3, 12),
    };

    employees.push({
      id: `${def.id}-${String(i + 1).padStart(4, "0")}`,
      attrs: {
        group,
        site,
        role,
        shift,
        sex,
        ageBand,
        ...(phase ? { phase } : {}),
      },
      answers: makeAnswersFromScaleTargets(targets, rng),
    });
  }

  return {
    id: def.id,
    title: def.title,
    description: def.description,
    createdAt: new Date().toISOString(),
    employees,
  };
}

export const DEMO_DATASETS = [
  {
    id: "standard",
    title: "標準的な企業データ",
    description:
      "大きな偏りが少ない想定。部署間の差もほどほどで、総合健康リスクは概ね100付近に集まるようにしたデモです。",
    tags: [
      { kind: "focus", label: "比較の基準" },
      { kind: "tag", label: "部署差: 中" },
      { kind: "tag", label: "ばらつき: 中" },
    ],
    build: () =>
      buildDataset({
        id: "standard",
        title: "標準的な企業データ",
        description:
          "大きな偏りが少ない想定。部署間の差もほどほどで、総合健康リスクは概ね100付近に集まるようにしたデモです。",
        seed: 101,
        n: 240,
        means: { workload: 7.8, control: 7.9, supervisorSupport: 7.6, coworkerSupport: 8.1 },
        sd: { workload: 1.4, control: 1.3, supervisorSupport: 1.2, coworkerSupport: 1.1 },
        groups: [
          { id: "営業", weight: 1.0, means: { workload: 8.1, control: 7.6, supervisorSupport: 7.3, coworkerSupport: 8.0 } },
          { id: "開発", weight: 1.0, means: { workload: 7.6, control: 8.2, supervisorSupport: 7.7, coworkerSupport: 8.2 } },
          { id: "製造", weight: 1.0, means: { workload: 7.9, control: 7.7, supervisorSupport: 7.5, coworkerSupport: 8.0 } },
          { id: "管理", weight: 0.7, means: { workload: 7.3, control: 8.0, supervisorSupport: 7.9, coworkerSupport: 8.3 } },
        ],
        sites: { items: ["東京", "大阪", "名古屋"], weights: [0.5, 0.3, 0.2] },
        roles: { items: ["スタッフ", "リーダー", "マネージャ"], weights: [0.72, 0.22, 0.06] },
        shifts: { items: ["日勤", "交代制"], weights: [0.82, 0.18] },
        sex: { items: ["male", "female"], weights: [0.62, 0.38] },
        ageBands: { items: ["20s", "30s", "40s", "50s"], weights: [0.28, 0.34, 0.24, 0.14] },
      }),
  },
  {
    id: "high_stress",
    title: "高ストレス者の多い企業データ",
    description:
      "仕事の量的負担が高め、コントロールと支援がやや低めの想定。総合健康リスクが高い集団が見つかりやすいデモです。",
    tags: [
      { kind: "focus", label: "リスク高め" },
      { kind: "tag", label: "量的負担: 高" },
      { kind: "tag", label: "支援: 低〜中" },
    ],
    build: () =>
      buildDataset({
        id: "high_stress",
        title: "高ストレス者の多い企業データ",
        description:
          "仕事の量的負担が高め、コントロールと支援がやや低めの想定。総合健康リスクが高い集団が見つかりやすいデモです。",
        seed: 202,
        n: 260,
        means: { workload: 9.2, control: 7.2, supervisorSupport: 7.0, coworkerSupport: 7.6 },
        sd: { workload: 1.3, control: 1.2, supervisorSupport: 1.2, coworkerSupport: 1.1 },
        groups: [
          { id: "コールセンター", weight: 1.1, means: { workload: 9.6, control: 6.9, supervisorSupport: 6.9, coworkerSupport: 7.4 } },
          { id: "物流", weight: 1.0, means: { workload: 9.3, control: 7.0, supervisorSupport: 7.0, coworkerSupport: 7.6 } },
          { id: "営業", weight: 0.9, means: { workload: 9.0, control: 7.4, supervisorSupport: 7.1, coworkerSupport: 7.8 } },
        ],
        sites: { items: ["首都圏", "関西"], weights: [0.7, 0.3] },
        roles: { items: ["スタッフ", "リーダー", "マネージャ"], weights: [0.78, 0.18, 0.04] },
        shifts: { items: ["日勤", "交代制"], weights: [0.55, 0.45] },
        sex: { items: ["male", "female"], weights: [0.55, 0.45] },
        ageBands: { items: ["20s", "30s", "40s", "50s"], weights: [0.34, 0.33, 0.22, 0.11] },
      }),
  },
  {
    id: "older",
    title: "年齢層が高いデータ",
    description:
      "40〜50代が多い想定。年齢層の切り口（フィルタ/集計）で比較しやすいように、年代による傾向差も少し入れています。",
    tags: [
      { kind: "focus", label: "年代差が見やすい" },
      { kind: "tag", label: "40-50代中心" },
      { kind: "tag", label: "部署差: 低〜中" },
    ],
    build: () =>
      buildDataset({
        id: "older",
        title: "年齢層が高いデータ",
        description:
          "40〜50代が多い想定。年齢層の切り口（フィルタ/集計）で比較しやすいように、年代による傾向差も少し入れています。",
        seed: 303,
        n: 220,
        means: { workload: 7.7, control: 7.8, supervisorSupport: 7.7, coworkerSupport: 8.0 },
        sd: { workload: 1.3, control: 1.2, supervisorSupport: 1.2, coworkerSupport: 1.1 },
        groups: [
          { id: "製造", weight: 1.0, means: { workload: 7.9, control: 7.6, supervisorSupport: 7.6, coworkerSupport: 7.9 } },
          { id: "保全", weight: 0.7, means: { workload: 7.4, control: 7.7, supervisorSupport: 7.6, coworkerSupport: 8.0 } },
          { id: "品質", weight: 0.7, means: { workload: 7.5, control: 8.0, supervisorSupport: 7.8, coworkerSupport: 8.1 } },
        ],
        sites: { items: ["工場A", "工場B"], weights: [0.55, 0.45] },
        roles: { items: ["スタッフ", "リーダー", "マネージャ"], weights: [0.68, 0.26, 0.06] },
        shifts: { items: ["日勤", "交代制"], weights: [0.62, 0.38] },
        sex: { items: ["male", "female"], weights: [0.78, 0.22] },
        ageBands: { items: ["20s", "30s", "40s", "50s"], weights: [0.06, 0.18, 0.40, 0.36] },
      }),
  },
  {
    id: "mixed_roles",
    title: "職種混合データ",
    description:
      "同一企業内に複数職種が混在しており、職種で集計すると傾向が大きく変わる想定。『切り口変更（groupBy）』の効果を確認できます。",
    tags: [
      { kind: "focus", label: "切り口の効果" },
      { kind: "tag", label: "職種: 混在" },
      { kind: "tag", label: "拠点: 複数" },
    ],
    build: () =>
      buildDataset({
        id: "mixed_roles",
        title: "職種混合データ",
        description:
          "同一企業内に複数職種が混在しており、職種で集計すると傾向が大きく変わる想定。『切り口変更（groupBy）』の効果を確認できます。",
        seed: 404,
        n: 320,
        means: { workload: 7.9, control: 7.8, supervisorSupport: 7.6, coworkerSupport: 8.0 },
        sd: { workload: 1.4, control: 1.3, supervisorSupport: 1.2, coworkerSupport: 1.1 },
        groups: [
          { id: "本社", weight: 1.0, means: { workload: 7.6, control: 8.2, supervisorSupport: 7.8, coworkerSupport: 8.2 } },
          { id: "支社", weight: 0.9, means: { workload: 8.3, control: 7.3, supervisorSupport: 7.4, coworkerSupport: 7.9 } },
          { id: "現場", weight: 1.1, means: { workload: 8.1, control: 7.4, supervisorSupport: 7.5, coworkerSupport: 7.9 } },
        ],
        sites: { items: ["東京", "札幌", "福岡"], weights: [0.45, 0.25, 0.30] },
        roles: { items: ["スタッフ", "リーダー", "マネージャ"], weights: [0.74, 0.20, 0.06] },
        shifts: { items: ["日勤", "交代制"], weights: [0.75, 0.25] },
        sex: { items: ["male", "female"], weights: [0.60, 0.40] },
        ageBands: { items: ["20s", "30s", "40s", "50s"], weights: [0.26, 0.34, 0.26, 0.14] },
      }),
  },
  {
    id: "before_after",
    title: "比較しやすい追加パターン：施策前後（Before/After）",
    description:
      "同一データ内に『施策前/施策後』を含め、支援が上がる・量的負担が少し下がる想定を入れています。フィルタや集計で前後比較ができます。",
    tags: [
      { kind: "focus", label: "前後比較" },
      { kind: "tag", label: "phase: before/after" },
      { kind: "tag", label: "支援↑ / 負担↓" },
    ],
    build: () =>
      buildDataset({
        id: "before_after",
        title: "比較しやすい追加パターン：施策前後（Before/After）",
        description:
          "同一データ内に『施策前/施策後』を含め、支援が上がる・量的負担が少し下がる想定を入れています。フィルタや集計で前後比較ができます。",
        seed: 505,
        n: 280,
        means: { workload: 8.4, control: 7.5, supervisorSupport: 7.2, coworkerSupport: 7.8 },
        sd: { workload: 1.3, control: 1.2, supervisorSupport: 1.1, coworkerSupport: 1.1 },
        groups: [
          { id: "製造ラインA", weight: 1.0, means: { workload: 8.8, control: 7.2, supervisorSupport: 7.1, coworkerSupport: 7.7 } },
          { id: "製造ラインB", weight: 1.0, means: { workload: 8.2, control: 7.6, supervisorSupport: 7.2, coworkerSupport: 7.9 } },
        ],
        sites: { items: ["工場"], weights: [1.0] },
        roles: { items: ["スタッフ", "リーダー", "マネージャ"], weights: [0.78, 0.18, 0.04] },
        shifts: { items: ["交代制", "日勤"], weights: [0.6, 0.4] },
        sex: { items: ["male", "female"], weights: [0.7, 0.3] },
        ageBands: { items: ["20s", "30s", "40s", "50s"], weights: [0.18, 0.30, 0.32, 0.20] },
        phases: { items: ["before", "after"], weights: [0.5, 0.5] },
        phaseDeltas: {
          before: { workload: 0, control: 0, supervisorSupport: 0, coworkerSupport: 0 },
          after: { workload: -0.4, control: +0.1, supervisorSupport: +0.5, coworkerSupport: +0.2 },
        },
      }),
  },
].map((d) => ({
  ...d,
  tags: d.tags ?? [],
}));

const cache = new Map();

export function getDatasetById(id) {
  if (id === "uploaded") return null;
  const def = DEMO_DATASETS.find((d) => d.id === id);
  if (!def) return null;
  if (cache.has(def.id)) return cache.get(def.id);
  const dataset = def.build();
  cache.set(def.id, dataset);
  return dataset;
}
