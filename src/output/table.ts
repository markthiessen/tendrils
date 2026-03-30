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
