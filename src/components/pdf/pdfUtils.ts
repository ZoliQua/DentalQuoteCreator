// Shared PDF helper functions

// With Roboto font embedded, all Hungarian characters (including ő, ű) render natively.
// This function is kept as a pass-through for API compatibility.
export function toPdfText(text: string): string {
  return text;
}

// Format date as YYYY.MM.DD for PDF
export function formatPdfDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}
