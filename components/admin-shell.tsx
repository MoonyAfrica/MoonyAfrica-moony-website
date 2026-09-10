import { AdminAccountMenu } from "./admin-account-menu";
import { AdminGlobalSearch } from "./admin-global-search";
import { AdminNotifications } from "./admin-notifications";
import { AdminRoleNavigation } from "./admin-role-navigation";
import { MoonyLogo } from "./moony-logo";

export function AdminShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fbf8f4] text-[#301b15]">
      <div className="grid min-h-screen lg:grid-cols-[214px_1fr]">
        <aside className="border-r border-[#5b2f22]/10 bg-[linear-gradient(180deg,#f8efe6_0%,#f5eadf_100%)] px-3 py-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <div className="px-3"><MoonyLogo compact /></div>
          <AdminRoleNavigation active={active} />

          <div className="relative mt-7 overflow-hidden border-t border-[#5b2f22]/10 px-3 pb-4 pt-5">
            <div className="absolute -bottom-7 -left-8 h-24 w-24 rounded-full border border-[#b97955]/22" />
            <div className="absolute -bottom-12 left-3 h-28 w-28 rounded-full border border-[#b97955]/14" />
            <p className="moony-serif relative text-[18px] leading-[1.15] text-[#8a4a31]">Un monde où<br />chaque femme<br />peut s’épanouir</p>
            <span className="relative mt-3 block h-px w-8 bg-[#a95832]/65" />
            <p className="relative mt-5 text-[9px] leading-4 text-[#5b2f22]/42">MOONY<br />Web Studio<br />Control Center</p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-30 flex h-[66px] items-center border-b border-[#5b2f22]/10 bg-[#fffdf9]/94 px-5 backdrop-blur-xl lg:px-7">
            <div className="moony-serif hidden shrink-0 text-[23px] text-[#5b2f22] xl:block">Control Center</div>
            <AdminGlobalSearch />
            <div className="ml-4 flex items-center gap-4">
              <AdminNotifications />
              <AdminAccountMenu />
            </div>
          </header>
          <div className="p-4 sm:p-5 lg:p-7">{children}</div>
        </section>
      </div>
    </main>
  );
}
