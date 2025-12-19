export function coeffsBjsq12BySex(sex, meansVersion) {
  const mv = meansVersion === "updated" ? "updated" : "legacy";
  if (sex === "female") {
    return {
      A: mv === "legacy" ? 7.6 : 7.9,
      alpha: 0.048,
      B: mv === "legacy" ? 7.9 : 7.2,
      beta: -0.056,
      C: mv === "legacy" ? 6.9 : 6.6,
      gamma: -0.097,
      D: mv === "legacy" ? 8.1 : 8.2,
      delta: -0.097,
    };
  }

  // male / unknown は男性扱い（デモの簡易な既定）
  return {
    A: 8.7,
    alpha: 0.076,
    B: mv === "legacy" ? 8.0 : 7.9,
    beta: -0.089,
    C: mv === "legacy" ? 7.6 : 7.5,
    gamma: -0.097,
    D: 8.1,
    delta: -0.097,
  };
}

export function blendCoefficientsBySexRatio({ male, female }, meansVersion) {
  const total = (male ?? 0) + (female ?? 0);
  const wm = total > 0 ? (male ?? 0) / total : 0.5;
  const wf = total > 0 ? (female ?? 0) / total : 0.5;
  const m = coeffsBjsq12BySex("male", meansVersion);
  const f = coeffsBjsq12BySex("female", meansVersion);
  const blend = (k) => m[k] * wm + f[k] * wf;
  return {
    A: blend("A"),
    alpha: blend("alpha"),
    B: blend("B"),
    beta: blend("beta"),
    C: blend("C"),
    gamma: blend("gamma"),
    D: blend("D"),
    delta: blend("delta"),
    meta: { wm, wf, mode: total > 0 ? "weighted" : "fallback_50_50" },
  };
}
