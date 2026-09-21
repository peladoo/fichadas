import { MunicipioProvider } from "@/components/MunicipioProvider";

export default async function MunicipioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MunicipioProvider slug={slug}>{children}</MunicipioProvider>;
}
