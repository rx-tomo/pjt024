import { scoreBjsq12 } from "./scoring/bjsq12.js";
import { blendCoefficientsBySexRatio } from "./scoring/coefficients.js";
import { riskDemandControl, riskSupport, riskTotal } from "./scoring/risk.js";

const out = document.getElementById("out");
if (!out) throw new Error("Missing #out");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function near(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

test("スコア計算: 12項目→4尺度", () => {
  const s = scoreBjsq12({
    q1: 4,
    q2: 3,
    q3: 2,
    q4: 1,
    q5: 2,
    q6: 3,
    q7: 4,
    q8: 1,
    q9: 2,
    q10: 3,
    q11: 1,
    q12: 4,
  });
  assert(s.workload === 9, "workload mismatch");
  assert(s.control === 6, "control mismatch");
  assert(s.supervisorSupport === 7, "supervisorSupport mismatch");
  assert(s.coworkerSupport === 8, "coworkerSupport mismatch");
});

test("総合健康リスク: 110×120/100=132", () => {
  assert(near(riskTotal(110, 120), 132), "total risk mismatch");
});

test("基準点で risk=100（男性・legacy）", () => {
  const coeff = blendCoefficientsBySexRatio({ male: 100, female: 0 }, "legacy");
  const mean = {
    workload: coeff.A,
    control: coeff.B,
    supervisorSupport: coeff.C,
    coworkerSupport: coeff.D,
  };
  const r1 = riskDemandControl(mean, coeff);
  const r2 = riskSupport(mean, coeff);
  assert(Math.abs(r1 - 100) < 1e-9, `r1=${r1}`);
  assert(Math.abs(r2 - 100) < 1e-9, `r2=${r2}`);
});

test("基準点で risk=100（女性・updated）", () => {
  const coeff = blendCoefficientsBySexRatio({ male: 0, female: 100 }, "updated");
  const mean = {
    workload: coeff.A,
    control: coeff.B,
    supervisorSupport: coeff.C,
    coworkerSupport: coeff.D,
  };
  const r1 = riskDemandControl(mean, coeff);
  const r2 = riskSupport(mean, coeff);
  assert(Math.abs(r1 - 100) < 1e-9, `r1=${r1}`);
  assert(Math.abs(r2 - 100) < 1e-9, `r2=${r2}`);
});

const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;

out.innerHTML = `
  <div class="card__title">結果</div>
  <div class="card__desc">pass=${pass}, fail=${fail}</div>
  <table class="table" style="margin-top:10px">
    <thead><tr><th>テスト</th><th>結果</th></tr></thead>
    <tbody>
      ${results
        .map((r) => {
          const status = r.ok ? "OK" : `FAIL: ${r.error}`;
          return `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(status)}</td></tr>`;
        })
        .join("")}
    </tbody>
  </table>
`;

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
