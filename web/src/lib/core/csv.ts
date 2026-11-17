function csvCell(value: unknown) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 text: the first record's keys as the header, CRLF line ends, numbers as JavaScript writes them. */
export function encodeCsv(records: readonly Record<string, unknown>[]) {
  const columns = Object.keys(records[0]);
  const lines = [columns, ...records.map((record) => columns.map((column) => record[column]))];
  return `${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
