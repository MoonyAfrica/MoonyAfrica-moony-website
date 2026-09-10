import { AdminWorkspace } from "@/components/admin-workspace";
import { MarketingEditor } from "@/components/marketing-editor";

export default function PopupsPage() {
  return (
    <AdminWorkspace
      active="Pop-ups & bandeaux"
      title="Pop-ups & bandeaux"
      subtitle="Créez, programmez, activez et désactivez les messages contextuels du site public avec aperçu en direct."
    >
      <MarketingEditor kindFilter={["popup", "banner"]} />
    </AdminWorkspace>
  );
}
