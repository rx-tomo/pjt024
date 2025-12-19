export function riskDemandControl(mean, coeff) {
  const x = mean.workload;
  const y = mean.control;
  return 100 * Math.exp((x - coeff.A) * coeff.alpha + (y - coeff.B) * coeff.beta);
}

export function riskSupport(mean, coeff) {
  const x = mean.supervisorSupport;
  const y = mean.coworkerSupport;
  return 100 * Math.exp((x - coeff.C) * coeff.gamma + (y - coeff.D) * coeff.delta);
}

export function riskTotal(r1, r2) {
  return (r1 * r2) / 100;
}

export function formatNumber(n, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}
