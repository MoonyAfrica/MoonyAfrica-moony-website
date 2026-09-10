import { AdminShell } from "./admin-shell";

export function AdminWorkspace({
  active,
  title,
  subtitle,
  actions,
  children,
}: {
  active: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AdminShell active={active}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="moony-serif text-4xl tracking-[-.035em] text-[#5b2f22]">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#5b2f22]/50">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </AdminShell>
  );
}

export function AdminCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="admin-card admin-shadow p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="moony-serif text-2xl text-[#5b2f22]">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
