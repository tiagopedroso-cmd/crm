"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowLeft, ArrowRight, LoaderCircle, Inbox } from "lucide-react";
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={`modal ${wide ? "modal-wide" : ""}`}
          aria-describedby={description ? "modal-description" : undefined}
        >
          <div className="modal-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id="modal-description">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-btn" aria-label="Fechar">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  title = "Nenhum resultado",
  text = "Tente ajustar os filtros ou cadastre um novo lead.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      Carregando sua operação…
    </div>
  );
}
export function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <div className="notice error" role="alert">
      <strong>Não foi possível carregar os dados.</strong>
      <p>Confira sua conexão e a configuração do Supabase.</p>
      {retry && (
        <button className="btn" onClick={retry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
export function Pagination({
  page,
  count,
  onChange,
  size = 25,
}: {
  page: number;
  count: number;
  onChange: (n: number) => void;
  size?: number;
}) {
  return (
    <div className="pagination">
      <span>
        {count} registro{count !== 1 ? "s" : ""} · Página {page + 1} de{" "}
        {Math.max(1, Math.ceil(count / size))}
      </span>
      <div className="actions">
        <button
          className="icon-btn"
          aria-label="Página anterior"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          className="icon-btn"
          aria-label="Próxima página"
          disabled={(page + 1) * size >= count}
          onClick={() => onChange(page + 1)}
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function Progress({ value, max }: { value: number; max: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.min(value, max)}
      aria-valuemin={0}
      aria-valuemax={max || 1}
    >
      <span
        style={{
          width: `${Math.min(100, Math.max(0, max ? (value / max) * 100 : 0))}%`,
        }}
      />
    </div>
  );
}
export function Notice({ text }: { text: string }) {
  return text ? (
    <div role="status" className="notice">
      {text}
    </div>
  ) : null;
}
