import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  adminPartnerCheck,
  adminPartnerDelete,
  adminPartnerSave,
  adminPartnerSend,
  adminPartners,
} from "@/lib/api.functions";
import { useAppState } from "./useApp";
import { Card, Field, GhostButton, GoldButton, Guide, Pill, SectionTitle } from "./ui";

const LANGS = [
  { id: "en", label: "English" },
  { id: "si", label: "සිංහල" },
  { id: "ru", label: "Русский" },
  { id: "hi", label: "हिन्दी" },
  { id: "bn", label: "বাংলা" },
];

type Admin = { initData: string; password: string };

export function PartnersAdmin({ admin }: { admin: Admin }) {
  const { run, busy } = useAppState();
  const { data, refetch } = useQuery({
    queryKey: ["admin-partners"],
    queryFn: () => adminPartners({ data: admin }),
  });
  const [chat, setChat] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState("en");
  const [photo, setPhoto] = useState("");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [editLang, setEditLang] = useState("en");

  const send = (id?: string) =>
    run(
      () => adminPartnerSend({ data: { ...admin, id, texts, photo } }),
      (r) => `📨 Sent to ${r?.sent}/${r?.total} channel(s)`
    ).then(() => refetch());

  return (
    <div className="space-y-4">
      <Guide>
        Add partner channels where the bot is admin. Each channel gets the message in its own
        language with a button using your admin referral link. Leave a language text empty to use
        the built-in promo. Channels where the bot is not admin are skipped.
      </Guide>

      <Card>
        <SectionTitle icon="➕" title="Add partner channel" />
        <div className="space-y-2">
          <Field label="Channel (@username or t.me link)" value={chat} onChange={(e) => setChat(e.target.value)} />
          <Field label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="block text-[11px] font-bold text-muted-foreground">
            Language
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background/60 p-2 text-xs text-foreground"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </label>
          <GoldButton
            disabled={busy || !chat}
            onClick={() =>
              void run(() => adminPartnerSave({ data: { ...admin, chat, name, lang, active: true } }), () => "✅ Partner saved").then(
                () => {
                  setChat("");
                  setName("");
                  void refetch();
                }
              )
            }
          >
            💾 Save partner
          </GoldButton>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="✍️" title="Message per language" />
        <div className="mb-2 flex flex-wrap gap-1">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => setEditLang(l.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${editLang === l.id ? "bg-gold-gradient text-primary-foreground" : "border border-border text-muted-foreground"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <textarea
          rows={6}
          value={texts[editLang] ?? ""}
          onChange={(e) => setTexts({ ...texts, [editLang]: e.target.value })}
          placeholder="HTML supported. Empty = built-in promo for this language."
          className="w-full rounded-xl border border-border bg-background/60 p-3 text-xs"
        />
        <Field label="Image URL (optional, https)" value={photo} onChange={(e) => setPhoto(e.target.value)} />
        <GoldButton className="mt-3" disabled={busy || !data?.length} onClick={() => void send()}>
          🚀 Send to ALL active partners
        </GoldButton>
      </Card>

      <Card>
        <SectionTitle icon="🤝" title={`Partner channels (${data?.length ?? 0})`} />
        <div className="space-y-2">
          {(data ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-background/40 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{p.name}{p.fromTask ? " · 🧩 partner task" : ""}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.chat} · {LANGS.find((l) => l.id === p.lang)?.label}
                    {p.lastSentAt ? ` · last ${new Date(p.lastSentAt).toISOString().slice(5, 16).replace("T", " ")}` : ""}
                  </p>
                </div>
                <Pill tone={p.active ? "success" : "warn"}>{p.active ? "active" : "paused"}</Pill>
              </div>
              {p.lastStatus && <p className="mt-1 text-[10px]">{p.lastStatus}</p>}
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                <GhostButton disabled={busy} onClick={() => void run(() => adminPartnerCheck({ data: { ...admin, id: p.id } }), (r) => (r?.ok ? "✅ Bot is admin" : "❌ Bot is not admin")).then(() => refetch())}>🔍</GhostButton>
                <GhostButton disabled={busy} onClick={() => void send(p.id)}>📨</GhostButton>
                <GhostButton disabled={busy} onClick={() => void run(() => adminPartnerSave({ data: { ...admin, chat: p.chat, name: p.name, lang: p.lang, active: !p.active } })).then(() => refetch())}>{p.active ? "⏸" : "▶️"}</GhostButton>
                <GhostButton disabled={busy} onClick={() => { if (confirm(`Remove ${p.name}?`)) void run(() => adminPartnerDelete({ data: { ...admin, id: p.id } })).then(() => refetch()); }}>🗑</GhostButton>
              </div>
            </div>
          ))}
          {!data?.length && <p className="py-4 text-center text-xs text-muted-foreground">No partner channels yet.</p>}
        </div>
      </Card>
    </div>
  );
}
