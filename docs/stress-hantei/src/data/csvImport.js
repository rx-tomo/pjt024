function normalizeSex(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s === "male" || s === "m" || s === "1" || s === "男性") return "male";
  if (s === "female" || s === "f" || s === "2" || s === "女性") return "female";
  return "unknown";
}

function parseCsv(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error("CSVが空です。");

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(splitCsvLine(lines[i]));
  }
  return { header, rows };
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function toInt(v, label, rowIndex) {
  const n = Number(String(v ?? "").trim());
  if (!Number.isFinite(n)) throw new Error(`CSV行${rowIndex}: ${label} が数値ではありません。`);
  return Math.trunc(n);
}

export async function parseCsvFile(file) {
  const text = await file.text();
  const { header, rows } = parseCsv(text);
  const idx = new Map(header.map((h, i) => [h, i]));

  const required = ["id", "group", "sex"];
  for (let q = 1; q <= 12; q++) required.push(`q${q}`);
  const missing = required.filter((k) => !idx.has(k));
  if (missing.length > 0) {
    throw new Error(`CSVに必要列がありません: ${missing.join(", ")}`);
  }

  const employees = rows.map((r, i) => {
    const rowIndex = i + 2; // header=1
    const get = (k) => r[idx.get(k)] ?? "";
    const id = String(get("id")).trim();
    if (!id) throw new Error(`CSV行${rowIndex}: id が空です。`);

    const answers = {};
    for (let q = 1; q <= 12; q++) {
      const key = `q${q}`;
      const v = toInt(get(key), key, rowIndex);
      if (v < 1 || v > 4) throw new Error(`CSV行${rowIndex}: ${key} は1〜4で入力してください。`);
      answers[key] = v;
    }

    const attrs = {
      group: String(get("group")).trim() || undefined,
      site: idx.has("site") ? String(get("site")).trim() || undefined : undefined,
      role: idx.has("role") ? String(get("role")).trim() || undefined : undefined,
      shift: idx.has("shift") ? String(get("shift")).trim() || undefined : undefined,
      ageBand: idx.has("ageBand") ? String(get("ageBand")).trim() || undefined : undefined,
      phase: idx.has("phase") ? String(get("phase")).trim() || undefined : undefined,
      sex: normalizeSex(get("sex")),
    };

    return { id, attrs, answers };
  });

  return {
    id: "uploaded",
    title: file.name,
    description: "CSVから読み込んだデータ",
    createdAt: new Date().toISOString(),
    employees,
  };
}
