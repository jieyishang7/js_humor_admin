import type { Metadata } from "next";

export const metadata: Metadata = { title: "Access denied | Spot Finder Admin" };

export default function DeniedPage() {
  return (
    <main className="center-page">
      <section className="auth-card">
        <span className="brand-mark brand-mark-danger" aria-hidden="true">✕</span>
        <h1>Access denied</h1>
        <p>You&apos;re signed in, but this account isn&apos;t a superadmin. Ask the project owner for access.</p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn btn-dark">Sign out</button>
        </form>
      </section>
    </main>
  );
}
