import Link from "next/link";
export default function NotFound() {
  return (
    <main className="setup">
      <h1>Página não encontrada</h1>
      <p>Este endereço não está disponível.</p>
      <Link className="btn primary" href="/dashboard">
        Voltar ao CRM
      </Link>
    </main>
  );
}
