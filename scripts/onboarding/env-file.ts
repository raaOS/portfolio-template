import fs from 'fs';
import path from 'path';

/**
 * Parser env sederhana yang dipakai portal onboarding.
 * Nilai boleh dibungkus tanda kutip tunggal/ganda.
 */
export function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

export function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return parseEnv(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Tulis/ubah beberapa kunci tanpa menghapus isi lain di file env.
 * Nilai yang ditulis di sini hanya hash/salt, bukan password asli.
 */
export function upsertEnvFile(
  filePath: string,
  values: Record<string, string>
): void {
  const exists = fs.existsSync(filePath);
  const raw = exists ? fs.readFileSync(filePath, 'utf-8') : '';
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const hadTrailingNewline = raw === '' || /(?:\r?\n)$/.test(raw);
  const lines = raw === '' ? [] : raw.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  for (const [key, value] of Object.entries(values)) {
    const lineIndex = lines.findIndex((line) => {
      const trimmed = line.trim();
      return trimmed.startsWith(`${key}=`);
    });

    const nextLine = `${key}=${value}`;
    if (lineIndex === -1) lines.push(nextLine);
    else lines[lineIndex] = nextLine;
  }

  const content = lines.join(eol) + (hadTrailingNewline ? eol : '');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o600 });
}
