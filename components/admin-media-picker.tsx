"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Image as ImageIcon, Loader2, Search, X } from "lucide-react";

type MediaAsset = {
  id: string;
  file_name: string;
  public_url: string;
  mime_type: string | null;
  alt_text: string | null;
  folder: string;
};

type PickerKind = "image" | "document" | "all";

type Props = {
  value?: string;
  label?: string;
  kind?: PickerKind;
  onSelect: (asset: { url: string; altText: string; fileName: string }) => void;
};

export function AdminMediaPicker({ value = "", label = "Choisir dans la bibliothèque", kind = "image", onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(search = query) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    try {
      const response = await fetch(`/api/admin/media?${params.toString()}`, { cache: "no-store" });
      if (response.status === 401) {
        location.href = "/admin/login";
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Bibliothèque indisponible.");
      const rows = (data.media ?? []) as MediaAsset[];
      setAssets(rows.filter((item) => {
        const image = item.mime_type?.startsWith("image/") ?? false;
        if (kind === "image") return image;
        if (kind === "document") return !image;
        return true;
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bibliothèque indisponible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load("");
  }, [open, kind]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selectedId = useMemo(() => assets.find((item) => item.public_url === value)?.id, [assets, value]);
  const noun = kind === "image" ? "image" : kind === "document" ? "document" : "média";
  const Icon = kind === "document" ? FileText : ImageIcon;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#5b2f22]/12 bg-[#fffaf6] px-3 py-2.5 text-xs font-semibold text-[#7e3518] transition hover:border-[#b9693d]/45 hover:bg-white"
      >
        <Icon size={14} /> {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#2c1711]/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] border border-white/20 bg-[#fbf8f4] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-[#5b2f22]/10 bg-white px-5 py-4">
              <div>
                <h2 className="moony-serif text-2xl text-[#5b2f22]">Bibliothèque de médias</h2>
                <p className="mt-0.5 text-[11px] text-[#5b2f22]/48">Sélectionnez un {noun} déjà importé dans le Control Center.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-full p-2 text-[#5b2f22]/55 hover:bg-[#f5e8df]" aria-label="Fermer"><X size={18} /></button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-[#5b2f22]/8 px-5 py-3">
              <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[#5b2f22]/10 bg-white px-3">
                <Search size={14} className="text-[#5b2f22]/45" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} placeholder={`Rechercher un ${noun}…`} className="w-full bg-transparent py-2.5 text-xs outline-none" />
              </div>
              <button type="button" onClick={() => void load()} className="rounded-lg border border-[#5b2f22]/10 bg-white px-4 py-2.5 text-xs font-medium">Rechercher</button>
              <a href="/admin/medias" target="_blank" className="rounded-lg bg-[#7e3518] px-4 py-2.5 text-xs font-medium text-white">Importer un média ↗</a>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {loading ? <div className="grid min-h-[280px] place-items-center text-sm text-[#5b2f22]/48"><span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={17} /> Chargement des médias…</span></div> : null}
              {!loading && error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
              {!loading && !error && !assets.length ? <div className="grid min-h-[280px] place-items-center text-center"><div><Icon className="mx-auto text-[#5b2f22]/22" size={38} /><p className="mt-3 text-sm text-[#5b2f22]/48">Aucun {noun} trouvé.</p><a href="/admin/medias" target="_blank" className="mt-3 inline-block text-xs font-semibold text-[#8d3b19]">Ouvrir la bibliothèque pour importer →</a></div></div> : null}
              {!loading && assets.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{assets.map((asset) => {
                const image = asset.mime_type?.startsWith("image/") ?? false;
                return <button key={asset.id} type="button" onClick={() => { onSelect({ url: asset.public_url, altText: asset.alt_text ?? "", fileName: asset.file_name }); setOpen(false); }} className={`group overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md ${selectedId === asset.id ? "border-[#b65e39] ring-2 ring-[#b65e39]/20" : "border-[#5b2f22]/9 hover:border-[#b65e39]/35"}`}>
                  <div className="relative h-40 bg-[#efe4dc]">{image?<img src={asset.public_url} alt={asset.alt_text ?? ""} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center"><FileText size={42} className="text-[#9b5a3c]"/></div>}{selectedId === asset.id ? <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[#7e3518] text-white"><Check size={14} /></span> : null}</div>
                  <div className="p-3"><strong className="block truncate text-xs">{asset.file_name}</strong><span className="mt-1 block truncate text-[10px] text-[#5b2f22]/42">{asset.folder}{asset.alt_text ? ` · ${asset.alt_text}` : ""}</span></div>
                </button>;
              })}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
