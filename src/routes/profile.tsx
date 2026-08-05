import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Plus, Trash2, User as UserIcon, Camera, Sparkles, Upload, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, upsertMyProfile, buildProfileFromCv } from "@/lib/api/profile.functions";
import { extractPdfText } from "@/lib/pdf-parse";
import { AutoApplyCard } from "@/components/profile/AutoApplyCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type Experience = { title: string; company: string; location: string; start: string; end: string; description: string; bullets: string[] };
type Education = { degree: string; school: string; location: string; start: string; end: string; description: string };
type Project = { name: string; description: string; url: string };
type Cert = { name: string; issuer: string; year: string };

const emptyExp: Experience = { title: "", company: "", location: "", start: "", end: "", description: "", bullets: [] };
const emptyEdu: Education = { degree: "", school: "", location: "", start: "", end: "", description: "" };

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const upsert = useServerFn(upsertMyProfile);
  const buildFromCv = useServerFn(buildProfileFromCv);
  const [importing, setImporting] = useState(false);
  const [cvPaste, setCvPaste] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [emailContact, setEmailContact] = useState("");
  const [website, setWebsite] = useState("");
  const [years, setYears] = useState<number>(0);
  const [skillsTxt, setSkillsTxt] = useState("");
  const [langsTxt, setLangsTxt] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState<"modern" | "classic" | "executive" | "sidebar" | "latex">("modern");
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [educations, setEducations] = useState<Education[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchProfile({ data: undefined as unknown as never }).then((res) => {
      const p = (res as { profile: Record<string, unknown> | null }).profile;
      if (!p) { setLoaded(true); return; }
      setFullName((p.full_name as string) ?? "");
      setHeadline((p.headline as string) ?? "");
      setBio((p.bio as string) ?? "");
      setTargetRole((p.target_role as string) ?? "");
      setLocation((p.location as string) ?? "");
      setPhone((p.phone as string) ?? "");
      setEmailContact((p.email_contact as string) ?? "");
      setWebsite((p.website as string) ?? "");
      setYears(((p.experience_years as number) ?? 0));
      setSkillsTxt(((p.skills as string[]) ?? []).join(", "));
      setLangsTxt(((p.languages as string[]) ?? []).join(", "));
      const links = (p.links as Record<string, string>) ?? {};
      setLinkedin(links.linkedin ?? "");
      setGithub(links.github ?? "");
      setAvatarUrl((p.avatar_url as string) ?? null);
      setTemplate(((p.preferred_template as "modern" | "classic" | "executive" | "sidebar" | "latex") ?? "modern"));
      const cv = (p.cv_structured as { experiences?: Experience[]; educations?: Education[]; projects?: Project[]; certifications?: Cert[] } | null) ?? {};
      setExperiences(cv.experiences ?? []);
      setEducations(cv.educations ?? []);
      setProjects(cv.projects ?? []);
      setCerts(cv.certifications ?? []);
      setLoaded(true);
    }).catch((e) => { toast.error((e as Error).message); setLoaded(true); });
  }, [user, fetchProfile]);

  const handleAvatar = async (file: File) => {
    if (!user) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Image trop lourde (4 Mo max)"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Photo uploadée");
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  };

  const applyParsed = (p: Record<string, unknown>) => {
    if (p.full_name) setFullName(p.full_name as string);
    if (p.headline) setHeadline(p.headline as string);
    if (p.bio) setBio(p.bio as string);
    if (p.target_role) setTargetRole(p.target_role as string);
    if (p.location) setLocation(p.location as string);
    if (p.phone) setPhone(p.phone as string);
    if (p.email_contact) setEmailContact(p.email_contact as string);
    if (p.website) setWebsite(p.website as string);
    if (p.experience_years) setYears(Number(p.experience_years));
    const sk = (p.skills as string[]) ?? []; if (sk.length) setSkillsTxt(sk.join(", "));
    const lg = (p.languages as string[]) ?? []; if (lg.length) setLangsTxt(lg.join(", "));
    const links = (p.links as Record<string, string>) ?? {};
    if (links.linkedin) setLinkedin(links.linkedin);
    if (links.github) setGithub(links.github);
    const cv = (p.cv_structured as { experiences?: Experience[]; educations?: Education[]; projects?: Project[]; certifications?: Cert[] }) ?? {};
    if (cv.experiences?.length) setExperiences(cv.experiences);
    if (cv.educations?.length) setEducations(cv.educations);
    if (cv.projects?.length) setProjects(cv.projects);
    if (cv.certifications?.length) setCerts(cv.certifications);
  };

  const importFromText = async (text: string) => {
    if (text.trim().length < 100) { toast.error("CV trop court", { description: "Au moins 100 caractères." }); return; }
    setImporting(true);
    try {
      const res = await buildFromCv({ data: { cvText: text, language: "fr" } });
      applyParsed((res as { profile: Record<string, unknown> }).profile);
      toast.success("Profil rempli depuis ton CV", { description: "Vérifie puis enregistre." });
    } catch (e) { toast.error("Échec de l'analyse", { description: (e as Error).message }); }
    finally { setImporting(false); }
  };

  const importFromPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast.error("Importe un PDF"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Fichier trop lourd (10 Mo max)"); return; }
    setImporting(true);
    try {
      const text = await extractPdfText(file);
      setImporting(false);
      await importFromText(text);
    } catch (e) {
      setImporting(false);
      toast.error("Extraction impossible", { description: (e as Error).message });
    }
  };

  const save = async () => {
    if (!fullName.trim()) { toast.error("Le nom complet est requis"); return; }
    setSaving(true);
    try {
      await upsert({ data: {
        full_name: fullName.trim(),
        headline: headline || null,
        bio: bio || null,
        target_role: targetRole || null,
        location: location || null,
        country_code: null,
        phone: phone || null,
        email_contact: emailContact || null,
        website: website || null,
        experience_years: Number(years) || 0,
        skills: skillsTxt.split(",").map(s => s.trim()).filter(Boolean),
        languages: langsTxt.split(",").map(s => s.trim()).filter(Boolean),
        links: { linkedin, github },
        cv_structured: { experiences, educations, projects, certifications: certs },
        preferred_template: template,
        avatar_url: avatarUrl,
      }});
      toast.success("Profil enregistré");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  if (loading || !user || !loaded) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-24 max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
        <header>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--hyper-cyan)] mb-3"><UserIcon className="size-3.5" /> Mon profil</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter">Construis le CV qui te ressemble</h1>
          <p className="text-sm text-muted-foreground mt-2">Toutes ces infos alimentent automatiquement tes CV générés et ta visibilité côté recruteur.</p>
        </header>

        <section className="glass-panel rounded-2xl p-6">
          <h2 className="font-bold mb-4">Photo & identité</h2>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="size-9 rounded-xl bg-[color:var(--hyper-cyan)]/10 flex items-center justify-center shrink-0">
              <Wand2 className="size-4 text-[color:var(--hyper-cyan)]" />
            </div>
            <div>
              <h2 className="font-bold">Profil automatique depuis ton CV</h2>
              <p className="text-sm text-muted-foreground">Importe ton CV : l'IA remplit identité, compétences, expériences, formations, projets et certifications.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className={`flex items-center justify-center gap-2 h-24 rounded-2xl border-2 border-dashed border-border bg-card/50 cursor-pointer hover:border-[color:var(--hyper-cyan)]/50 transition-colors ${importing ? "opacity-60 pointer-events-none" : ""}`}>
              {importing ? <><Loader2 className="size-4 animate-spin" /> <span className="text-sm">Analyse en cours…</span></>
                : <><Upload className="size-4 text-muted-foreground" /> <span className="text-sm text-muted-foreground">Importer un CV PDF (max 10 Mo)</span></>}
              <input type="file" accept=".pdf" className="hidden" disabled={importing} onChange={e => e.target.files?.[0] && importFromPdf(e.target.files[0])} />
            </label>
            <div className="space-y-2">
              <Textarea value={cvPaste} onChange={e => setCvPaste(e.target.value)} rows={3} placeholder="… ou colle le texte de ton CV ici" className="font-mono text-xs" />
              <Button size="sm" variant="outline" className="rounded-full font-bold" disabled={importing || cvPaste.trim().length < 100} onClick={() => importFromText(cvPaste)}>
                {importing ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />} Remplir mon profil
              </Button>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <h2 className="font-bold mb-4">Photo & identité</h2>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="size-32 rounded-2xl bg-muted overflow-hidden flex items-center justify-center">
                {avatarUrl ? <img src={avatarUrl} alt="avatar" className="size-full object-cover" /> : <UserIcon className="size-12 text-muted-foreground" />}
              </div>
              <label className="cursor-pointer text-xs font-bold inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border hover:border-foreground/30">
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                Changer la photo
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && handleAvatar(e.target.files[0])} />
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 flex-1 w-full">
              <Field label="Nom complet *" value={fullName} onChange={setFullName} />
              <Field label="Titre / Headline" value={headline} onChange={setHeadline} placeholder="ex: Ingénieur Full-Stack Senior" />
              <Field label="Poste recherché" value={targetRole} onChange={setTargetRole} />
              <Field label="Localisation" value={location} onChange={setLocation} />
              <Field label="Téléphone" value={phone} onChange={setPhone} />
              <Field label="Email de contact" value={emailContact} onChange={setEmailContact} />
              <Field label="Site / Portfolio" value={website} onChange={setWebsite} />
              <div>
                <Label className="mb-1.5 block text-xs font-bold uppercase">Années d'expérience</Label>
                <Input type="number" min={0} max={60} value={years} onChange={e => setYears(Number(e.target.value))} />
              </div>
              <Field label="LinkedIn" value={linkedin} onChange={setLinkedin} />
              <Field label="GitHub" value={github} onChange={setGithub} />
            </div>
          </div>
          <div className="mt-4">
            <Label className="mb-1.5 block text-xs font-bold uppercase">À propos</Label>
            <Textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Présente-toi en quelques lignes…" />
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <h2 className="font-bold mb-4">Compétences & langues</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase">Skills (séparées par virgule)</Label>
              <Textarea value={skillsTxt} onChange={e => setSkillsTxt(e.target.value)} rows={2} placeholder="React, TypeScript, Node, AWS…" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase">Langues</Label>
              <Textarea value={langsTxt} onChange={e => setLangsTxt(e.target.value)} rows={2} placeholder="Français, Anglais, Arabe…" />
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Expériences</h2>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setExperiences([...experiences, { ...emptyExp }])}><Plus className="size-3.5 mr-1" /> Ajouter</Button>
          </div>
          <div className="space-y-4">
            {experiences.length === 0 && <p className="text-sm text-muted-foreground">Aucune expérience. Clique sur "Ajouter".</p>}
            {experiences.map((exp, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-border space-y-3">
                <div className="flex justify-end"><button onClick={() => setExperiences(experiences.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Poste" value={exp.title} onChange={(v) => setExperiences(experiences.map((e, i) => i === idx ? { ...e, title: v } : e))} />
                  <Field label="Entreprise" value={exp.company} onChange={(v) => setExperiences(experiences.map((e, i) => i === idx ? { ...e, company: v } : e))} />
                  <Field label="Lieu" value={exp.location} onChange={(v) => setExperiences(experiences.map((e, i) => i === idx ? { ...e, location: v } : e))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Début" value={exp.start} onChange={(v) => setExperiences(experiences.map((e, i) => i === idx ? { ...e, start: v } : e))} placeholder="01/2022" />
                    <Field label="Fin" value={exp.end} onChange={(v) => setExperiences(experiences.map((e, i) => i === idx ? { ...e, end: v } : e))} placeholder="Présent" />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-bold uppercase">Description / Réalisations (1 par ligne)</Label>
                  <Textarea rows={4} value={exp.bullets.join("\n")} onChange={(e) => setExperiences(experiences.map((x, i) => i === idx ? { ...x, bullets: e.target.value.split("\n").filter(Boolean) } : x))} placeholder="• Mené la migration vers React 19…" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Formation</h2>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEducations([...educations, { ...emptyEdu }])}><Plus className="size-3.5 mr-1" /> Ajouter</Button>
          </div>
          <div className="space-y-4">
            {educations.length === 0 && <p className="text-sm text-muted-foreground">Aucune formation.</p>}
            {educations.map((ed, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-border space-y-3">
                <div className="flex justify-end"><button onClick={() => setEducations(educations.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Diplôme" value={ed.degree} onChange={(v) => setEducations(educations.map((e, i) => i === idx ? { ...e, degree: v } : e))} />
                  <Field label="École" value={ed.school} onChange={(v) => setEducations(educations.map((e, i) => i === idx ? { ...e, school: v } : e))} />
                  <Field label="Lieu" value={ed.location} onChange={(v) => setEducations(educations.map((e, i) => i === idx ? { ...e, location: v } : e))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Début" value={ed.start} onChange={(v) => setEducations(educations.map((e, i) => i === idx ? { ...e, start: v } : e))} />
                    <Field label="Fin" value={ed.end} onChange={(v) => setEducations(educations.map((e, i) => i === idx ? { ...e, end: v } : e))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Projets</h2>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setProjects([...projects, { name: "", description: "", url: "" }])}><Plus className="size-3.5 mr-1" /> Ajouter</Button>
          </div>
          <div className="space-y-3">
            {projects.map((pr, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-border space-y-2">
                <div className="flex justify-end"><button onClick={() => setProjects(projects.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></div>
                <Field label="Nom du projet" value={pr.name} onChange={(v) => setProjects(projects.map((p, i) => i === idx ? { ...p, name: v } : p))} />
                <Field label="URL" value={pr.url} onChange={(v) => setProjects(projects.map((p, i) => i === idx ? { ...p, url: v } : p))} />
                <Textarea rows={2} value={pr.description} onChange={(e) => setProjects(projects.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))} placeholder="Description courte" />
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Certifications</h2>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setCerts([...certs, { name: "", issuer: "", year: "" }])}><Plus className="size-3.5 mr-1" /> Ajouter</Button>
          </div>
          <div className="space-y-3">
            {certs.map((c, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-border grid sm:grid-cols-3 gap-2 relative">
                <button onClick={() => setCerts(certs.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                <Field label="Nom" value={c.name} onChange={(v) => setCerts(certs.map((x, i) => i === idx ? { ...x, name: v } : x))} />
                <Field label="Organisme" value={c.issuer} onChange={(v) => setCerts(certs.map((x, i) => i === idx ? { ...x, issuer: v } : x))} />
                <Field label="Année" value={c.year} onChange={(v) => setCerts(certs.map((x, i) => i === idx ? { ...x, year: v } : x))} />
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2"><Sparkles className="size-4 text-[color:var(--hyper-cyan)]" /> Template CV préféré</h2>
          <div className="grid grid-cols-3 gap-3">
            {(["modern", "classic", "executive", "sidebar", "latex"] as const).map(t => (
              <button key={t} onClick={() => setTemplate(t)} className={`p-4 rounded-xl border-2 text-sm font-bold capitalize ${template === t ? "border-[color:var(--hyper-cyan)] bg-[color:var(--hyper-cyan)]/10" : "border-border text-muted-foreground"}`}>{t}</button>
            ))}
          </div>
        </section>

        <div className="sticky bottom-4 z-20">
          <Button onClick={save} disabled={saving} size="lg" className="w-full rounded-2xl font-bold h-14 shadow-lg">
            {saving ? <><Loader2 className="size-4 mr-2 animate-spin" /> Enregistrement…</> : <><Save className="size-4 mr-2" /> Enregistrer mon profil</>}
          </Button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-bold uppercase">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}