import Table from "cli-table3";

export function renderTable(
  headers: string[],
  rows: string[][],
): string {
  const table = new Table({
    head: headers,
    style: { head: ["cyan"] },
  });
  for (const row of rows) {
    table.push(row);
  }
  return table.toString();
}

// Compact GitHub-flavored markdown table — far smaller than box-drawing
// output for prompt injection, since it drops per-row borders and padding.
export function renderMarkdownTable(
  headers: string[],
  rows: string[][],
): string {
  const escape = (s: string) =>
    String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const head = `| ${headers.map(escape).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(escape).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

// Pick the row renderer for a --format value. Unknown/absent falls back to the
// box-drawing table so default behavior is unchanged.
export function pickRowRenderer(
  format?: string,
): (headers: string[], rows: string[][]) => string {
  return format === "md" ? renderMarkdownTable : renderTable;
}

export function renderKeyValue(
  pairs: [string, string][],
): string {
  const table = new Table({
    style: { head: [] },
    colWidths: [20],
  });
  for (const [key, value] of pairs) {
    table.push({ [key]: value });
  }
  return table.toString();
}
