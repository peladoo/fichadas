import { redirect } from "next/navigation";
import { DEFAULT_MUNICIPIO_SLUG } from "@/lib/tenant";

export default function Home() {
  redirect(`/m/${DEFAULT_MUNICIPIO_SLUG}`);
}
