import jsPDF from "jspdf";

export type StructuredCV = {
  full_name: string; headline: string; email: string; phone: string; location: string;
  linkedin?: string; website?: string; summary: string;
  experiences: { title: string; company: string; location: string; start: string; end: string; bullets: string[] }[];
  educations: { degree: string; school: string; location: string; start: string; end: string; details: string }[];
  skills_grouped: { category: string; items: string[] }[];
  languages: string[]; certifications: string[];
};
export type CoverLetter = {
  date: string; recipient: string; subject: string; greeting: string;
  paragraphs: string[]; closing: string; signature: string;
};
export type CvTemplate = "modern" | "classic" | "executive" | "sidebar" | "latex";

const PRIMARY: Record<CvTemplate, [number, number, number]> = {
  modern: [13, 148, 136],
  classic: [30, 41, 59],
  executive: [120, 53, 15],
  sidebar: [17, 94, 89],
  latex: [10, 61, 98],
};

/** Fetch an image URL and return a base64 dataURL (PNG/JPEG). Returns null on failure. */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

function newDoc() {
  return new jsPDF({ unit: "pt", format: "a4" });
}

function wrap(doc: jsPDF, text: string, w: number) { return doc.splitTextToSize(text || "", w) as string[]; }

function addPageIfNeeded(doc: jsPDF, y: number, needed: number, top: number) {
  const ph = doc.internal.pageSize.getHeight();
  if (y + needed > ph - 40) { doc.addPage(); return top; }
  return y;
}

export function exportCvPdf(cv: StructuredCV, template: CvTemplate, filename: string, photoDataUrl?: string | null) {
  if (template === "sidebar") return exportSidebarPdf(cv, filename, photoDataUrl ?? null);
  if (template === "latex")   return exportLatexPdf(cv, filename, photoDataUrl ?? null);
  const doc = newDoc();
  const w = doc.internal.pageSize.getWidth();
  const color = PRIMARY[template];
  const margin = 48;
  const top = 60;
  let y = top;

  // === HEADER : nom du candidat (PAS de "CV — POSTE") ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(template === "executive" ? 26 : 24);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(cv.full_name || "Nom Prénom", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text(cv.headline || "", margin, y);
  y += 16;

  // Contact ligne
  const contact = [cv.email, cv.phone, cv.location, cv.linkedin, cv.website].filter(Boolean).join("  •  ");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  for (const line of wrap(doc, contact, w - margin * 2)) { doc.text(line, margin, y); y += 11; }
  y += 6;

  // Séparateur
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(template === "modern" ? 2 : 0.8);
  doc.line(margin, y, w - margin, y);
  y += 16;

  const section = (title: string) => {
    y = addPageIfNeeded(doc, y, 30, top);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(title.toUpperCase(), margin, y);
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, w - margin, y);
    y += 14;
    doc.setTextColor(40, 40, 40);
  };

  // Résumé
  if (cv.summary) {
    section("Profil");
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const line of wrap(doc, cv.summary, w - margin * 2)) {
      y = addPageIfNeeded(doc, y, 12, top);
      doc.text(line, margin, y); y += 13;
    }
    y += 6;
  }

  // Expériences
  if (cv.experiences?.length) {
    section("Expériences professionnelles");
    for (const exp of cv.experiences) {
      y = addPageIfNeeded(doc, y, 50, top);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
      doc.text(`${exp.title}`, margin, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
      const period = `${exp.start} – ${exp.end}`;
      doc.text(period, w - margin - doc.getTextWidth(period), y);
      y += 13;
      doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(80, 80, 80);
      doc.text(`${exp.company}${exp.location ? " · " + exp.location : ""}`, margin, y);
      y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      for (const b of exp.bullets || []) {
        const lines = wrap(doc, "• " + b, w - margin * 2 - 10);
        for (let i = 0; i < lines.length; i++) {
          y = addPageIfNeeded(doc, y, 12, top);
          doc.text(lines[i], margin + (i === 0 ? 0 : 10), y); y += 12;
        }
      }
      y += 8;
    }
  }

  // Formations
  if (cv.educations?.length) {
    section("Formation");
    for (const ed of cv.educations) {
      y = addPageIfNeeded(doc, y, 36, top);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.text(ed.degree, margin, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
      const period = `${ed.start} – ${ed.end}`;
      doc.text(period, w - margin - doc.getTextWidth(period), y);
      y += 12;
      doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(80, 80, 80);
      doc.text(`${ed.school}${ed.location ? " · " + ed.location : ""}`, margin, y);
      y += 12;
      if (ed.details) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
        for (const line of wrap(doc, ed.details, w - margin * 2)) {
          y = addPageIfNeeded(doc, y, 11, top);
          doc.text(line, margin, y); y += 11;
        }
      }
      y += 6;
    }
  }

  // Compétences
  if (cv.skills_grouped?.length) {
    section("Compétences");
    for (const g of cv.skills_grouped) {
      y = addPageIfNeeded(doc, y, 16, top);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.text(`${g.category} :`, margin, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
      const labelW = doc.getTextWidth(`${g.category} : `);
      const items = (g.items || []).join(" • ");
      const lines = wrap(doc, items, w - margin * 2 - labelW);
      doc.text(lines[0] || "", margin + labelW, y); y += 12;
      for (let i = 1; i < lines.length; i++) {
        y = addPageIfNeeded(doc, y, 12, top);
        doc.text(lines[i], margin, y); y += 12;
      }
      y += 4;
    }
  }

  // Langues + Certifs
  if (cv.languages?.length) {
    section("Langues");
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    for (const line of wrap(doc, cv.languages.join(" • "), w - margin * 2)) {
      y = addPageIfNeeded(doc, y, 12, top); doc.text(line, margin, y); y += 12;
    }
    y += 4;
  }
  if (cv.certifications?.length) {
    section("Certifications");
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    for (const c of cv.certifications) {
      y = addPageIfNeeded(doc, y, 12, top);
      doc.text("• " + c, margin, y); y += 12;
    }
  }

  doc.save(filename);
}

/* ---------- Template 4: SIDEBAR (2 colonnes avec photo) ---------- */
function exportSidebarPdf(cv: StructuredCV, filename: string, photo: string | null) {
  const doc = newDoc();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const sidebarW = 180;
  const margin = 18;

  // Sidebar background
  doc.setFillColor(15, 76, 71);
  doc.rect(0, 0, sidebarW, h, "F");

  // Photo (cercle simulé = rect avec coins arrondis si dispo, sinon rect)
  let cy = 36;
  if (photo) {
    const size = 100;
    const px = (sidebarW - size) / 2;
    try { doc.addImage(photo, "JPEG", px, cy, size, size, undefined, "FAST"); }
    catch { try { doc.addImage(photo, "PNG", px, cy, size, size, undefined, "FAST"); } catch { /* ignore */ } }
    cy += size + 18;
  } else {
    cy += 8;
  }

  // Nom
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
  for (const line of doc.splitTextToSize(cv.full_name || "Nom Prénom", sidebarW - margin * 2) as string[]) {
    doc.text(line, sidebarW / 2, cy, { align: "center" }); cy += 18;
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(200, 230, 220);
  for (const line of doc.splitTextToSize(cv.headline || "", sidebarW - margin * 2) as string[]) {
    doc.text(line, sidebarW / 2, cy, { align: "center" }); cy += 12;
  }
  cy += 12;

  // Contact
  const sideSection = (title: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(180, 230, 215);
    doc.text(title.toUpperCase(), margin, cy); cy += 4;
    doc.setDrawColor(180, 230, 215); doc.setLineWidth(0.5);
    doc.line(margin, cy, sidebarW - margin, cy); cy += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(235, 245, 240);
  };

  sideSection("Contact");
  const ct = [cv.email, cv.phone, cv.location, cv.linkedin, cv.website].filter(Boolean);
  for (const c of ct) {
    for (const line of doc.splitTextToSize(String(c), sidebarW - margin * 2) as string[]) {
      doc.text(line, margin, cy); cy += 11;
    }
  }
  cy += 8;

  if (cv.skills_grouped?.length) {
    sideSection("Compétences");
    for (const g of cv.skills_grouped) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text(g.category, margin, cy); cy += 10;
      doc.setFont("helvetica", "normal"); doc.setTextColor(220, 235, 230);
      for (const line of doc.splitTextToSize((g.items || []).join(" · "), sidebarW - margin * 2) as string[]) {
        doc.text(line, margin, cy); cy += 10;
      }
      cy += 6;
    }
  }

  if (cv.languages?.length) {
    sideSection("Langues");
    for (const l of cv.languages) { doc.text("• " + l, margin, cy); cy += 11; }
    cy += 6;
  }
  if (cv.certifications?.length) {
    sideSection("Certifications");
    for (const c of cv.certifications) {
      for (const line of doc.splitTextToSize("• " + c, sidebarW - margin * 2) as string[]) { doc.text(line, margin, cy); cy += 11; }
    }
  }

  // Main content (right column)
  const mainX = sidebarW + 24;
  const mainW = w - mainX - 28;
  let my = 50;

  const mainSection = (title: string) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(15, 76, 71);
    doc.text(title.toUpperCase(), mainX, my); my += 4;
    doc.setDrawColor(15, 76, 71); doc.setLineWidth(1);
    doc.line(mainX, my, mainX + 40, my); my += 14;
    doc.setTextColor(40, 40, 40);
  };
  const ensureSpace = (n: number) => {
    if (my + n > h - 40) { doc.addPage(); my = 50; }
  };

  if (cv.summary) {
    mainSection("Profil");
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const line of doc.splitTextToSize(cv.summary, mainW) as string[]) {
      ensureSpace(12); doc.text(line, mainX, my); my += 13;
    }
    my += 8;
  }

  if (cv.experiences?.length) {
    mainSection("Expériences");
    for (const exp of cv.experiences) {
      ensureSpace(40);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
      doc.text(exp.title, mainX, my);
      const period = `${exp.start} – ${exp.end}`;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
      doc.text(period, mainX + mainW - doc.getTextWidth(period), my);
      my += 13;
      doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(15, 76, 71);
      doc.text(`${exp.company}${exp.location ? " · " + exp.location : ""}`, mainX, my); my += 13;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(50, 50, 50);
      for (const b of exp.bullets || []) {
        const lines = doc.splitTextToSize("• " + b, mainW - 8) as string[];
        for (let i = 0; i < lines.length; i++) {
          ensureSpace(12);
          doc.text(lines[i], mainX + (i === 0 ? 0 : 8), my); my += 12;
        }
      }
      my += 8;
    }
  }

  if (cv.educations?.length) {
    mainSection("Formation");
    for (const ed of cv.educations) {
      ensureSpace(30);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.text(ed.degree, mainX, my);
      const period = `${ed.start} – ${ed.end}`;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
      doc.text(period, mainX + mainW - doc.getTextWidth(period), my); my += 12;
      doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(80, 80, 80);
      doc.text(`${ed.school}${ed.location ? " · " + ed.location : ""}`, mainX, my); my += 14;
    }
  }

  doc.save(filename);
}

/* ---------- Template 5: LATEX (Awesome-CV inspired, 1 colonne ATS) ---------- */
function exportLatexPdf(cv: StructuredCV, filename: string, photo: string | null) {
  const doc = newDoc();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 56;
  let y = 70;

  // Bandeau nom centré + photo à droite
  if (photo) {
    try { doc.addImage(photo, "JPEG", w - margin - 70, y - 10, 70, 70, undefined, "FAST"); }
    catch { try { doc.addImage(photo, "PNG", w - margin - 70, y - 10, 70, 70, undefined, "FAST"); } catch { /* ignore */ } }
  }

  doc.setFont("times", "normal"); doc.setFontSize(28); doc.setTextColor(40, 40, 40);
  doc.text(cv.full_name || "Nom Prénom", margin, y);
  y += 10;
  doc.setDrawColor(10, 61, 98); doc.setLineWidth(2);
  doc.line(margin, y, margin + 60, y);
  y += 18;

  doc.setFont("times", "italic"); doc.setFontSize(11); doc.setTextColor(80, 80, 80);
  doc.text(cv.headline || "", margin, y); y += 16;

  // Contact
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  const contact = [cv.email, cv.phone, cv.location, cv.linkedin, cv.website].filter(Boolean).join("  •  ");
  for (const line of doc.splitTextToSize(contact, w - margin * 2) as string[]) {
    doc.text(line, margin, y); y += 11;
  }
  y += 14;

  const ensureSpace = (n: number) => { if (y + n > h - 40) { doc.addPage(); y = 70; } };

  const section = (title: string) => {
    ensureSpace(30);
    doc.setFont("times", "bold"); doc.setFontSize(12); doc.setTextColor(10, 61, 98);
    doc.text(title.toUpperCase(), margin, y);
    y += 4;
    doc.setDrawColor(10, 61, 98); doc.setLineWidth(0.8);
    doc.line(margin, y, w - margin, y);
    y += 14;
    doc.setTextColor(40, 40, 40);
  };

  if (cv.summary) {
    section("Résumé");
    doc.setFont("times", "normal"); doc.setFontSize(10);
    for (const line of doc.splitTextToSize(cv.summary, w - margin * 2) as string[]) { ensureSpace(12); doc.text(line, margin, y); y += 13; }
    y += 6;
  }

  if (cv.experiences?.length) {
    section("Expérience professionnelle");
    for (const exp of cv.experiences) {
      ensureSpace(50);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
      doc.text(exp.company, margin, y);
      const period = `${exp.start} – ${exp.end}`;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
      doc.text(period, w - margin - doc.getTextWidth(period), y);
      y += 13;
      doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(10, 61, 98);
      doc.text(`${exp.title}${exp.location ? " — " + exp.location : ""}`, margin, y); y += 13;
      doc.setFont("times", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      for (const b of exp.bullets || []) {
        const lines = doc.splitTextToSize("◦ " + b, w - margin * 2 - 10) as string[];
        for (let i = 0; i < lines.length; i++) {
          ensureSpace(12);
          doc.text(lines[i], margin + (i === 0 ? 0 : 10), y); y += 12;
        }
      }
      y += 8;
    }
  }

  if (cv.educations?.length) {
    section("Formation");
    for (const ed of cv.educations) {
      ensureSpace(28);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.text(ed.school, margin, y);
      const period = `${ed.start} – ${ed.end}`;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
      doc.text(period, w - margin - doc.getTextWidth(period), y); y += 12;
      doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(10, 61, 98);
      doc.text(`${ed.degree}${ed.location ? " — " + ed.location : ""}`, margin, y); y += 14;
    }
  }

  if (cv.skills_grouped?.length) {
    section("Compétences");
    doc.setFont("times", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    for (const g of cv.skills_grouped) {
      ensureSpace(14);
      doc.setFont("helvetica", "bold"); doc.text(`${g.category} :`, margin, y);
      const lw = doc.getTextWidth(`${g.category} : `);
      doc.setFont("times", "normal");
      const lines = doc.splitTextToSize((g.items || []).join(", "), w - margin * 2 - lw) as string[];
      doc.text(lines[0] || "", margin + lw, y); y += 12;
      for (let i = 1; i < lines.length; i++) { ensureSpace(12); doc.text(lines[i], margin, y); y += 12; }
      y += 2;
    }
  }

  if (cv.languages?.length) {
    section("Langues");
    doc.setFont("times", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    for (const line of doc.splitTextToSize(cv.languages.join("  •  "), w - margin * 2) as string[]) {
      ensureSpace(12); doc.text(line, margin, y); y += 12;
    }
  }

  doc.save(filename);
}

export function exportCoverLetterPdf(cv: StructuredCV, lm: CoverLetter, template: CvTemplate, filename: string) {
  const doc = newDoc();
  const w = doc.internal.pageSize.getWidth();
  const margin = 56;
  const color = PRIMARY[template];
  let y = 70;

  // Expéditeur
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(color[0], color[1], color[2]);
  doc.text(cv.full_name || "", margin, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
  for (const line of [cv.email, cv.phone, cv.location].filter(Boolean)) { doc.text(line!, margin, y); y += 11; }
  y += 18;

  // Destinataire
  doc.setFontSize(10); doc.setTextColor(40, 40, 40);
  for (const line of wrap(doc, lm.recipient, w - margin * 2)) { doc.text(line, w - margin - doc.getTextWidth(line), y); y += 12; }
  y += 8;
  doc.setFontSize(9); doc.setTextColor(110, 110, 110);
  doc.text(lm.date, w - margin - doc.getTextWidth(lm.date), y); y += 24;

  // Objet
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
  doc.text("Objet : ", margin, y);
  const objX = margin + doc.getTextWidth("Objet : ");
  doc.setFont("helvetica", "normal");
  for (const line of wrap(doc, lm.subject, w - margin - objX)) { doc.text(line, objX, y); y += 13; }
  y += 14;

  // Salutation
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(40, 40, 40);
  doc.text(lm.greeting, margin, y); y += 18;

  // Paragraphes
  for (const p of lm.paragraphs) {
    for (const line of wrap(doc, p, w - margin * 2)) {
      y = addPageIfNeeded(doc, y, 14, 70);
      doc.text(line, margin, y); y += 14;
    }
    y += 8;
  }

  // Closing
  y = addPageIfNeeded(doc, y, 40, 70);
  for (const line of wrap(doc, lm.closing, w - margin * 2)) { doc.text(line, margin, y); y += 14; }
  y += 24;
  doc.setFont("helvetica", "bold");
  doc.text(lm.signature || cv.full_name || "", margin, y);

  doc.save(filename);
}
