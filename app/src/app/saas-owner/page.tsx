import { notFound } from "next/navigation";

/** `/saas-owner` intentionally 404s so the real path is not revealed. Use `/saas-owner/Jane2788Eyre`. */
export default function SaasOwnerIndexPage() {
  notFound();
}

