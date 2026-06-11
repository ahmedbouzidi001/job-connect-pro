import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listConversations, listMessages, sendMessage } from "@/lib/server/recruiter.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({ component: MessagesPage });

type Conv = { id: string; subject: string | null; updated_at: string; otherUserId: string; other: { full_name: string | null; avatar_url: string | null }; meIsRecruiter: boolean };
type Msg = { id: string; sender_id: string; body: string; created_at: string };

function MessagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const listConvs = useServerFn(listConversations);
  const listMsgs = useServerFn(listMessages);
  const send = useServerFn(sendMessage);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    listConvs({ data: undefined as never }).then((r) => {
      const list = (r as { conversations: Conv[] }).conversations;
      setConvs(list);
      if (list[0] && !active) setActive(list[0]);
    }).catch(e => toast.error((e as Error).message));
  }, [user]);

  useEffect(() => {
    if (!active) return;
    listMsgs({ data: { conversationId: active.id }}).then((r) => {
      setMsgs((r as { messages: Msg[] }).messages);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    });
    const ch = supabase
      .channel(`conv-${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${active.id}` }, (payload) => {
        setMsgs(m => [...m, payload.new as Msg]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  const submit = async () => {
    if (!active || !body.trim()) return;
    setBusy(true);
    try { await send({ data: { conversationId: active.id, body }}); setBody(""); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6">
        <header className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter">Messagerie</h1>
        </header>

        <div className="grid md:grid-cols-[300px_1fr] gap-4 h-[70vh]">
          <aside className="glass-panel rounded-2xl p-2 overflow-y-auto">
            {convs.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center">Aucune conversation.</div>}
            {convs.map(c => (
              <button key={c.id} onClick={() => setActive(c)}
                className={`w-full text-left p-3 rounded-xl mb-1 transition-colors ${active?.id===c.id ? "bg-hyper-cyan/10 border border-hyper-cyan/40" : "hover:bg-muted/50"}`}>
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">{c.other.full_name?.[0] ?? "?"}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{c.other.full_name ?? "Utilisateur"}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.subject ?? "—"}</div>
                  </div>
                </div>
              </button>
            ))}
          </aside>

          <section className="glass-panel rounded-2xl flex flex-col overflow-hidden">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground"><MessageSquare className="size-5 me-2" /> Sélectionne une conversation</div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-border">
                  <div className="font-bold">{active.other.full_name}</div>
                  <div className="text-xs text-muted-foreground">{active.subject}</div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                  {msgs.map(m => {
                    const mine = m.sender_id === user.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-hyper-cyan text-black" : "bg-muted"}`}>
                          <div className="whitespace-pre-wrap">{m.body}</div>
                          <div className={`text-[10px] mt-1 ${mine ? "text-black/60" : "text-muted-foreground"}`}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="p-3 border-t border-border flex gap-2">
                  <Input value={body} onChange={e => setBody(e.target.value)} placeholder="Écris un message…" />
                  <Button type="submit" disabled={busy || !body.trim()} className="rounded-full"><Send className="size-4" /></Button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
