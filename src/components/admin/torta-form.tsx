"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TortaDraft = {
  id?: string;
  name: string;
  description: string;
  priceCents: number;
  weightGrams: number | null;
  imageUrl: string | null;
  available: boolean;
};

const inputClass =
  "w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

/** Formulário de criar/editar torta (nome, peso, descrição, preço, imagem). */
export function TortaForm({ torta }: { torta?: TortaDraft }) {
  const router = useRouter();
  const editing = Boolean(torta?.id);

  const [name, setName] = useState(torta?.name ?? "");
  const [description, setDescription] = useState(torta?.description ?? "");
  const [price, setPrice] = useState(
    torta ? (torta.priceCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [weight, setWeight] = useState(
    torta?.weightGrams ? String(torta.weightGrams) : "",
  );
  const [imageUrl, setImageUrl] = useState(torta?.imageUrl ?? "");
  const [available, setAvailable] = useState(torta?.available ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canPreview =
    imageUrl.trim().startsWith("/") || /^https?:\/\//i.test(imageUrl.trim());

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/products/image", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao enviar a imagem.");
      }
      setImageUrl(data.imageUrl);
      setPreviewFailed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    const weightGrams = Number(weight.replace(",", "."));

    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      setError("Informe um preço válido (ex.: 89,90).");
      return;
    }
    if (!Number.isInteger(weightGrams) || weightGrams <= 0) {
      setError("Informe o peso em gramas (número inteiro, ex.: 1200).");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        editing ? `/api/admin/products/${torta!.id}` : "/api/admin/products",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            priceCents,
            weightGrams,
            imageUrl: imageUrl.trim(),
            available,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao salvar a torta.");
      }
      router.push("/admin/tortas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-rule bg-paper-2 p-6"
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-muted">
          Nome da torta
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder="Ex.: Torta de Chocolate Belga"
          className={inputClass}
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-muted">
          Descrição
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          maxLength={1000}
          placeholder="Ex.: Camadas generosas de ganache de chocolate belga 70%…"
          className={`${inputClass} resize-y`}
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">
            Peso (gramas)
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
            min={1}
            step={1}
            placeholder="Ex.: 1200"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">
            Preço (R$)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            placeholder="Ex.: 89,90"
            className={inputClass}
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-muted">
          Imagem
        </span>
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => {
            setImageUrl(e.target.value);
            setPreviewFailed(false);
          }}
          placeholder="https://… ou /tortas/cenoura.jpg"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-faint">
          Envie uma foto do computador ou cole o endereço de uma imagem
          (ex.:{" "}
          <code className="rounded bg-paper-3 px-1">/tortas/cenoura.jpg</code>
          ).
        </span>
      </label>

      <div className="mt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-rule bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper-3 disabled:opacity-60"
        >
          {uploading ? "Enviando…" : "Enviar imagem do computador"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-rule bg-paper">
          {canPreview && !previewFailed ? (
            <Image
              key={imageUrl}
              src={imageUrl}
              alt="Prévia da imagem da torta"
              fill
              sizes="96px"
              unoptimized
              className="object-cover"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-4xl"
              aria-hidden
            >
              🍰
            </span>
          )}
        </div>
        <p className="text-sm text-muted">Prévia da imagem</p>
      </div>

      <label className="mt-5 flex items-center gap-3">
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
          className="h-4 w-4 rounded accent-[var(--color-accent)]"
        />
        <span className="text-sm font-medium text-muted">
          Disponível para encomenda
        </span>
      </label>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent px-6 py-3 font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
        >
          {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar torta"}
        </button>
        <Link
          href="/admin/tortas"
          className="text-sm font-medium text-muted transition hover:text-ink"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
