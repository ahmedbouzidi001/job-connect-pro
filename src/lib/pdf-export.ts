import jsPDF from "jspdf";

export function downloadAsPdf(filename: string, title: string, content: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, margin, margin + 10);

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(content, maxWidth);
  let y = margin + 40;
  const lineHeight = 15;
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    // Bold for markdown headings
    if (typeof line === "string" && (line.startsWith("# ") || line.startsWith("## ") || line.startsWith("### "))) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(line.startsWith("# ") ? 14 : 12);
      doc.text(line.replace(/^#+\s*/, ""), margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
    } else {
      doc.text(line, margin, y);
    }
    y += lineHeight;
  }
  doc.save(filename);
}