import type { Metadata } from "next";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export const metadata: Metadata = { title: "Sign in | Spot Finder Admin" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="center-page">
      <section className="auth-card">
        <span className="brand-mark" aria-hidden="true">◆</span>
        <h1>Spot Finder Admin</h1>
        <p>Restricted area. Sign in with Google. Only accounts marked as superadmin can continue.</p>
        {error && <p className="alert">{error}</p>}
        <GoogleSignInButton />
      </section>
    </main>
  );
}
