export function csvCells(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { cells.push(value.trim()); value = ""; }
    else value += character;
  }
  cells.push(value.trim());
  return cells;
}

export function rowsFromGrid(grid) {
  if (!grid.length) return [];
  const headers = grid[0].map((cell) => String(cell ?? "").trim().toLowerCase());
  const emailIndex = headers.findIndex((header) => header.includes("email"));
  const firstIndex = headers.findIndex((header) => header.includes("first"));
  const lastIndex = headers.findIndex((header) => header.includes("surname") || header.includes("last"));
  const start = emailIndex >= 0 ? 1 : 0;
  return grid.slice(start).map((row) => ({
    firstName: String(row[firstIndex >= 0 ? firstIndex : 0] ?? "").trim(),
    lastName: String(row[lastIndex >= 0 ? lastIndex : 1] ?? "").trim(),
    email: String(row[emailIndex >= 0 ? emailIndex : 2] ?? "").trim().toLowerCase(),
  })).filter((row) => row.firstName.length > 0 && row.lastName.length > 0 && row.email.includes("@"));
}

export function parsePastedRows(text) {
  return rowsFromGrid(text.split(/\r?\n/).filter((line) => line.trim().length > 0).map((line) => csvCells(line.replaceAll("\t", ","))));
}

export function rowsForImport(pasteText, pendingRows) {
  return pendingRows.length > 0 ? pendingRows : parsePastedRows(pasteText);
}
