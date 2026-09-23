import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

type Props = {
  searchParams: Promise<{ intent?: string }>;
};

export default async function ContinueAfterAuth({ searchParams }: Props) {
  const { intent = "signup" } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1);

  const hasWorkspace = Boolean(memberships?.length);

  if (!hasWorkspace) {
    redirect("/onboarding");
  }

  if (intent === "signin") {
    redirect("/network");
  }

  redirect("/onboarding/welcome");
}
