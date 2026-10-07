import { Panel } from "@/components/admin/DossierParts";
import { DocumentsList } from "./DocumentsList";

/** Admin dossier "Documents" panel: every signed agreement and NDA. */
export function AdminSignatures({ filter }: { filter: { userId?: string; companyId?: string } }) {
  const scope = filter.userId ? { userId: filter.userId } : { companyId: filter.companyId! };
  return (
    <Panel title="Documents">
      <DocumentsList scope={scope} showSigner />
    </Panel>
  );
}

export function MySignatures({ companyId }: { companyId?: string }) {
  return companyId ? <DocumentsList scope={{ companyId }} showSigner /> : <DocumentsList scope={{ mine: true }} />;
}
