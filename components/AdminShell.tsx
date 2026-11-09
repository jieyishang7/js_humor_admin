import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
  { label: "", items: [{ href: "/", label: "Overview", icon: "◧" }] },
  { label: "Users", items: [{ href: "/users", label: "Users", icon: "◉" }] },
  {
    label: "AI Media",
    items: [
      { href: "/media", label: "AI media", icon: "✦" },
      { href: "/requests", label: "Generation requests", icon: "↳" },
      { href: "/r/generation-examples", label: "Generation examples", icon: "❝" },
      { href: "/images", label: "Images", icon: "▣" },
      { href: "/votes", label: "Votes", icon: "♥" },
    ],
  },
  {
    label: "Prompt Pipeline",
    items: [
      { href: "/prompt-chains", label: "Prompt chains & mix", icon: "⛓" },
      { href: "/r/prompt-chain-steps", label: "Prompt chain steps", icon: "≡" },
    ],
  },
  {
    label: "LLM",
    items: [
      { href: "/r/llm-models", label: "LLM models", icon: "◆" },
      { href: "/r/llm-providers", label: "LLM providers", icon: "◇" },
      { href: "/r/prompt-chain-runs", label: "LLM prompt chains", icon: "⟳" },
      { href: "/r/llm-responses", label: "LLM responses", icon: "✎" },
    ],
  },
  { label: "Terms", items: [{ href: "/r/terms", label: "Terms", icon: "Aa" }] },
  {
    label: "Whitelist",
    items: [
      { href: "/r/domains", label: "Domains", icon: "@" },
      { href: "/r/emails", label: "E-mail addresses", icon: "✉" },
    ],
  },
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
          {NAV_GROUPS.map((group) => (
            <div key={group.label || "top"} className="nav-group">
              {group.label && <p className="nav-group-label">{group.label}</p>}
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className="nav-link" data-active={active === item.href}>
                  <span aria-hidden="true" className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
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
