"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Columns3,
  CalendarDays,
  Target,
  ChartNoAxesCombined,
  Settings,
  Plus,
  Menu,
  LogOut,
  Search,
  ArrowUpRight,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { browserClient } from "@/lib/supabase/client";
import { ProfileContext } from "@/hooks/use-crm";
import type { Profile } from "@/types/crm";
import { LeadForm } from "./leads/lead-form";
import { BrandLogo } from "./brand-logo";
const items = [
  ["/dashboard", "Visão geral", LayoutDashboard],
  ["/agenda", "Agenda de hoje", CalendarDays],
  ["/leads", "Meus leads", Users],
  ["/pipeline", "Pipeline", Columns3],
  ["/placar", "Placar comercial", Target],
  ["/relatorios", "Relatórios", ChartNoAxesCombined],
  ["/configuracoes", "Configurações", Settings],
] as const;
export function Shell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const cache = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [quick, setQuick] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    const { error } = await browserClient().auth.signOut();
    if (error) {
      setError("Não foi possível sair. Tente novamente.");
      return;
    }
    cache.clear();
    router.replace("/login");
    router.refresh();
  }
  return (
    <ProfileContext.Provider value={profile}>
      <div className="app">
        {menu && (
          <button
            className="nav-backdrop"
            aria-label="Fechar navegação"
            onClick={() => setMenu(false)}
          />
        )}
        <aside className={`sidebar ${menu ? "is-open" : ""}`}>
          <Link className="brand" href="/dashboard">
            <BrandLogo />
          </Link>
          <button
            className="mobile-close icon-btn"
            aria-label="Fechar menu"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
          <div className="workspace">
            <span className="workspace-icon">IL</span>
            <div>
              InovaLogix<small>Seu espaço de negócios</small>
            </div>
          </div>
          <p className="nav-label">OPERAÇÃO COMERCIAL</p>
          <nav>
            {items.map(([href, label, Icon]) => (
              <Link
                onClick={() => setMenu(false)}
                className={path.startsWith(href) ? "active" : ""}
                href={href}
                key={href}
              >
                <Icon size={19} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="side-note">
            <ArrowUpRight size={21} />
            <strong>
              Um próximo passo.
              <br />
              Todos os dias.
            </strong>
            <p>Novos contatos e boas conversas constroem resultados.</p>
          </div>
          <div className="profile">
            <span className="avatar">
              {(profile.display_name || "IL").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{profile.display_name || "Minha conta"}</strong>
              <small>
                {profile.role === "ADMIN" ? "Administrador" : "Vendedor"}
              </small>
            </div>
            <button onClick={logout} className="icon-btn" aria-label="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <div className="actions">
              <button
                className="icon-btn menu-button"
                aria-label="Abrir menu"
                onClick={() => setMenu(true)}
              >
                <Menu />
              </button>
              <span className="breadcrumb">
                Workspace <span>/</span>{" "}
                <strong>
                  {items.find(([href]) => path.startsWith(href))?.[1] ||
                    "Lead 360°"}
                </strong>
              </span>
            </div>
            <div className="actions">
              <form className="global-search" action="/leads">
                <Search size={17} />
                <input
                  name="q"
                  aria-label="Busca global"
                  placeholder="Buscar empresa, contato…"
                />
              </form>
              <button className="btn primary" onClick={() => setQuick(true)}>
                <Plus size={18} />
                <span>Novo lead</span>
              </button>
            </div>
          </header>
          <div className="content">
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {children}
          </div>
          <footer className="app-footer">
            INOVALOGIX <span>Relacionamento. Consistência. Resultado.</span>
          </footer>
        </main>
        <LeadForm open={quick} onClose={() => setQuick(false)} />
      </div>
    </ProfileContext.Provider>
  );
}
