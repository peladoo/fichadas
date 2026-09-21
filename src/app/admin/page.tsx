import { redirect } from "next/navigation";
import { DEFAULT_MUNICIPIO_SLUG } from "@/lib/tenant";

export default function AdminRedirectPage() {
  redirect(`/m/${DEFAULT_MUNICIPIO_SLUG}/admin`);
}
