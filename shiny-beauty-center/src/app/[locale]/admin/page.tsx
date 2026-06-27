/**
 * Admin portal root — redirects to /admin/dashboard.
 */
import { redirect } from "next/navigation";

interface AdminHomeProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminHome({ params }: AdminHomeProps) {
  const { locale } = await params;
  redirect(`/${locale}/admin/dashboard`);
}
