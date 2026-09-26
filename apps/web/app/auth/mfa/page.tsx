import { MfaClient } from "./mfa-client";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function MfaPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : "/network";

  return (
    <main style={{minHeight:"100vh",background:"#06101d",color:"#eaf5ff",display:"grid",placeItems:"center",padding:24}}>
      <MfaClient next={next} />
    </main>
  );
}
