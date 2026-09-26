import { IntegrationDetail } from "../../components/integration-detail";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <IntegrationDetail slug={slug} />;
}
