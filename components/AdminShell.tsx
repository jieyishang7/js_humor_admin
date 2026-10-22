import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

const NAV = [
  { href: "/", label: "Overview", icon: "◧" },
  { href: "/users", label: "Users", icon: "◉" },
  { href: "/media", label: "AI media", icon: "✦" },
  { href: "/votes", label: "Votes", icon: "♥" },
];

/** Sidebar layout for every admin page. Calls requireAdmin(), so nothing renders for non-admins. */
export async function AdminShell({ active, title, subtitle, children }: {
  active: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { profile, user } = await requireAdmin();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">◆</span>
          <div>
            <strong>Spot Finder</strong>
            <span>Admin</span>
          </div>
        </div>
        <nav aria-label="Admin">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link" data-active={active === item.href}>
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="who">
            {profile.first_name ?? "Admin"}
            <span>{user.email}</span>
          </p>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="content">
        <header className="page-head">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </header>
        {children}
      </main>
    </div>
  );
}
