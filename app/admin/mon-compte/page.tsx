"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, LogOut, MonitorSmartphone, ShieldCheck, UserRound } from "lucide-react";
import { AdminCard, AdminWorkspace } from "@/components/admin-workspace";

type Account = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  legacy?: boolean;
  mfaRequired: boolean;
  mustChangePassword?: boolean;
  lastLoginAt: string | null;
};

type SessionInfo = { sid?: string | null; exp: number; mfa: boolean };
type DeviceSession = { id:string; created_at:string; last_seen_at:string; expires_at:string; device_label:string|null; current:boolean };

const roleNames: Record<string, string> = {
  founder: "Founder / Super Admin",
  admin: "Administrateur",
  sales: "Commercial",
  marketing: "Marketing",
  content: "Contenu",
  support: "Support",
  analytics: "Lecture analytique",
};

function formatDate(value:string){return new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [devices,setDevices]=useState<DeviceSession[]>([]);
  const [sessionsAvailable,setSessionsAvailable]=useState(false);
  const [fullName, setFullName] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const sessionEnds = useMemo(() => session?.exp ? new Date(session.exp * 1000) : null, [session]);
  const forcedChange = Boolean(account?.mustChangePassword);

  useEffect(() => { void load(); }, []);

  async function loadSessions(){
    const response=await fetch("/api/admin/account/sessions",{cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(response.ok){setDevices(data.sessions??[]);setSessionsAvailable(Boolean(data.available))}
  }

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/account", { cache: "no-store" });
    if (response.status === 401) { location.href = "/admin/login"; return; }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error ?? "Compte indisponible."); setLoading(false); return; }
    setAccount(data.account);
    setSession(data.session ?? null);
    setFullName(data.account?.fullName ?? "");
    setMfaRequired(Boolean(data.account?.mfaRequired));
    setLoading(false);
    if(!data.account?.legacy) await loadSessions();
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setNotice(""); setError("");
    const response = await fetch("/api/admin/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, mfaRequired }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error ?? "Modification impossible."); setSaving(false); return; }
    setAccount(data.account);
    setNotice("Profil et préférences de sécurité enregistrés.");
    setSaving(false);
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setNotice(""); setError("");
    if (newPassword.length < 12) { setError("Le nouveau mot de passe doit contenir au moins 12 caractères."); return; }
    if (newPassword !== confirmPassword) { setError("Les deux nouveaux mots de passe ne correspondent pas."); return; }
    setSaving(true);
    const response = await fetch("/api/admin/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error ?? "Modification impossible."); setSaving(false); return; }
    if (data.reauthenticate) { location.href = "/admin/login?passwordChanged=1"; return; }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    setNotice("Mot de passe modifié."); setSaving(false);
  }

  async function revoke(target:string){
    const query=target==="others"?"mode=others":target==="all"?"mode=all":`id=${encodeURIComponent(target)}`;
    const response=await fetch(`/api/admin/account/sessions?${query}`,{method:"DELETE"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){setError(data.error??"Impossible de déconnecter cette session.");return}
    if(data.signedOut){location.href="/admin/login";return}
    setNotice(target==="others"?"Les autres appareils ont été déconnectés.":"Session déconnectée.");
    await loadSessions();
  }

  return (
    <AdminWorkspace active="Mon compte" title="Mon compte" subtitle="Gérez votre identité, votre mot de passe, la double authentification et vos appareils connectés.">
      {forcedChange ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900"><strong className="block">Choisissez votre mot de passe personnel pour continuer</strong>Ce compte utilise encore un mot de passe temporaire. Les autres modules du Control Center restent verrouillés jusqu’à ce que vous le remplaciez ci-dessous.</div> : null}
      {notice ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_.8fr]">
        <AdminCard title="Profil Control Center">
          {loading ? <div className="flex items-center gap-2 py-8 text-sm text-[#5b2f22]/45"><Loader2 className="animate-spin" size={16}/>Chargement…</div> : account ? (
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl bg-[#fbf4ee] p-4">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[#ead1bf] text-[#7e3518]"><UserRound size={18}/></div>
                <div><strong className="block text-sm">{account.fullName}</strong><span className="text-xs text-[#5b2f22]/45">{account.email} · {roleNames[account.role] ?? account.role}</span></div>
              </div>
              <label className="block text-xs font-semibold">Nom affiché<input disabled={account.legacy} value={fullName} onChange={event => setFullName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#5b2f22]/10 bg-white px-3 py-3 text-sm font-normal disabled:bg-zinc-50 disabled:text-zinc-400" /></label>
              <label className="flex items-start gap-3 rounded-2xl border border-[#5b2f22]/10 p-4">
                <input disabled={account.legacy} type="checkbox" checked={mfaRequired} onChange={event => setMfaRequired(event.target.checked)} className="mt-1 h-4 w-4 accent-[#7e3518]" />
                <span><strong className="block text-sm">Code e-mail à chaque connexion</strong><span className="mt-1 block text-xs leading-5 text-[#5b2f22]/50">Après le mot de passe, MOONY envoie un code à 6 chiffres sur votre adresse e-mail. L’envoi nécessite Brevo configuré.</span></span>
              </label>
              {account.legacy ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">Vous utilisez l’accès fondateur de secours. Son identité et son mot de passe sont gérés par les variables d’environnement. Créez un compte nominatif dans Équipe & rôles pour utiliser ces réglages.</p> : null}
              <div className="flex justify-end"><button disabled={saving || account.legacy || !fullName.trim()} className="rounded-lg bg-[#7e3518] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer"}</button></div>
            </form>
          ) : null}
        </AdminCard>

        <div className="space-y-4">
          <AdminCard title="Sécurité de la session">
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3"><ShieldCheck size={22} className="text-emerald-700"/><div><strong className="block">Session signée</strong><span className="text-xs text-[#5b2f22]/45">Cookie HTTP-only, signature serveur et révocation côté base</span></div></div>
              <div className="flex items-center gap-3"><CheckCircle2 size={22} className={session?.mfa ? "text-emerald-700" : "text-[#5b2f22]/25"}/><div><strong className="block">Double authentification</strong><span className="text-xs text-[#5b2f22]/45">{session?.mfa ? "Cette session a été validée par code e-mail" : mfaRequired ? "Sera demandée à la prochaine connexion" : "Non requise pour ce compte"}</span></div></div>
              <div className="rounded-xl bg-[#fbf4ee] px-4 py-3 text-xs leading-5 text-[#5b2f22]/55">Expiration de la session : <strong>{sessionEnds ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(sessionEnds) : "—"}</strong></div>
            </div>
          </AdminCard>

          <AdminCard title={forcedChange?"Créer votre mot de passe personnel":"Changer le mot de passe"}>
            <form onSubmit={changePassword} className="space-y-3">
              <label className="block text-xs font-semibold">{forcedChange?"Mot de passe temporaire":"Mot de passe actuel"}<input disabled={account?.legacy} required type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#5b2f22]/10 px-3 py-3 text-sm font-normal" /></label>
              <label className="block text-xs font-semibold">Nouveau mot de passe<input disabled={account?.legacy} required minLength={12} type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#5b2f22]/10 px-3 py-3 text-sm font-normal" /></label>
              <label className="block text-xs font-semibold">Confirmer<input disabled={account?.legacy} required minLength={12} type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#5b2f22]/10 px-3 py-3 text-sm font-normal" /></label>
              <button disabled={saving || account?.legacy} className="inline-flex items-center gap-2 rounded-lg bg-[#7e3518] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><KeyRound size={14}/>{saving ? "Modification…" : forcedChange?"Activer mon mot de passe":"Modifier le mot de passe"}</button>
              <p className="text-[11px] leading-5 text-[#5b2f22]/40">La modification déconnecte immédiatement toutes les sessions et demande une nouvelle connexion.</p>
            </form>
          </AdminCard>
        </div>
      </div>

      {!account?.legacy ? <div className="mt-4"><AdminCard title="Appareils connectés" action={sessionsAvailable&&devices.length>1?<button onClick={()=>void revoke("others")} className="inline-flex items-center gap-2 rounded-lg border border-[#5b2f22]/10 bg-white px-3 py-2 text-xs font-semibold"><LogOut size={13}/>Déconnecter les autres</button>:undefined}>
        {!sessionsAvailable?<p className="rounded-xl bg-[#fbf4ee] px-4 py-3 text-xs leading-5 text-[#5b2f22]/50">Le registre des sessions sera disponible dès que la migration « control_center_sessions » sera appliquée.</p>:devices.length?<div className="divide-y divide-[#5b2f22]/8">{devices.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f3e5db] text-[#7e3518]"><MonitorSmartphone size={18}/></div><div><div className="flex items-center gap-2"><strong className="text-sm">{item.device_label||"Navigateur"}</strong>{item.current?<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Cet appareil</span>:null}</div><p className="mt-1 text-[11px] text-[#5b2f22]/45">Dernière activité {formatDate(item.last_seen_at)} · expire {formatDate(item.expires_at)}</p></div></div><button onClick={()=>void revoke(item.id)} className="rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-700">{item.current?"Se déconnecter":"Déconnecter"}</button></div>)}</div>:<p className="py-5 text-sm text-[#5b2f22]/45">Aucune session active enregistrée.</p>}
      </AdminCard></div>:null}
    </AdminWorkspace>
  );
}
