/**
 * Escape a field for CSV format
 */
function escapeCSVField(value: unknown): string {
  const str = String(value ?? "");

  // If the field contains comma, quote, or newline, wrap it in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert proposals to CSV format
 */
export function exportProposalsToCSV(
  proposals: Array<{
    id: string;
    characteristics: Record<string, string>;
    content: string;
  }>
): string {
  if (proposals.length === 0) {
    return "";
  }

  // Get all unique characteristic names
  const characteristicNames = new Set<string>();
  for (const proposal of proposals) {
    Object.keys(proposal.characteristics).forEach((name) => characteristicNames.add(name));
  }
  const sortedCharNames = Array.from(characteristicNames).sort();

  // Create header row
  const headers = ["ID", ...sortedCharNames, "Content"];
  const headerRow = headers.map(escapeCSVField).join(",");

  // Create data rows
  const dataRows = proposals.map((proposal) => {
    const row = [
      proposal.id,
      ...sortedCharNames.map((name) => proposal.characteristics[name] ?? ""),
      proposal.content,
    ];
    return row.map(escapeCSVField).join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Trigger download of CSV file
 */
export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
