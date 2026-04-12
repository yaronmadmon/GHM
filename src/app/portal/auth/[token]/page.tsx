import { redirect } from "next/navigation";

export default async function PortalAuthPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/api/portal/auth/${token}`);
}
