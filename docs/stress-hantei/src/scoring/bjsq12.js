export function scoreBjsq12(answers) {
  const q = (k) => {
    const v = Number(answers[k]);
    if (!Number.isFinite(v)) throw new Error(`回答 ${k} が不正です。`);
    return v;
  };

  return {
    workload: q("q1") + q("q2") + q("q3"),
    control: q("q4") + q("q5") + q("q6"),
    supervisorSupport: q("q7") + q("q9") + q("q11"),
    coworkerSupport: q("q8") + q("q10") + q("q12"),
  };
}
