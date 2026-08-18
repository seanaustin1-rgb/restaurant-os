import { redirect } from "next/navigation";

export default function MisspelledSpiritVaultEditPage({ params }: { params: { id: string } }) {
  redirect(`/admin/spirit-vault/${params.id}`);
}
