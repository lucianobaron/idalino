import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { checkAdminRole, roleDeniedResponse } from "@/lib/auth";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR = path.join(process.cwd(), "public", "tortas", "upload");

/** Identifica o formato real pelo conteúdo (magic bytes), não pelo nome/MIME. */
function sniffType(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpg";
  }
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/**
 * POST /api/admin/products/image
 * Recebe um arquivo de imagem (multipart, campo "file") e salva em
 * public/tortas/upload/, retornando o caminho público (ex.: "/tortas/upload/abc.png").
 * Requer sessão de admin com papel ADMIN.
 */
export async function POST(request: Request) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Envie um arquivo de imagem." },
      { status: 400 },
    );
  }
  if (file.size === 0 || file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "A imagem deve ter até 5 MB." },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffType(buf);
  if (!type) {
    return NextResponse.json(
      { error: "Formato não suportado. Use JPG, PNG ou WebP." },
      { status: 400 },
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${type}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buf);

  return NextResponse.json(
    { imageUrl: `/tortas/upload/${filename}` },
    { status: 201 },
  );
}
