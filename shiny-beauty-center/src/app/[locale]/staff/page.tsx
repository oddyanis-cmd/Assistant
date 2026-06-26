/**
 * Staff Portal home — redirects to /staff/schedule by default.
 */
import { redirect } from "next/navigation";

interface StaffHomeProps {
  params: Promise<{ locale: string }>;
}

export default async function StaffHome({ params }: StaffHomeProps) {
  const { locale } = await params;
  redirect(`/${locale}/staff/schedule`);
}
