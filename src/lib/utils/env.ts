/**
 * Shared environment variable utilities.
 * Extracted to avoid duplication across auth, CLOUDFLARE_D1, and provider modules.
 */

/**
 * Cleans environment variables by removing surrounding quotes and trimming whitespace.
 * Handles both single and double quotes commonly present in .env files.
 *
 * @param name - The environment variable name to read.
 * @returns The cleaned value, or undefined if the variable is not set.
 */
export function cleanEnvVar(name: string): string | undefined {
  const val = process.env[name]?.trim();
  return val ? val.replace(/^["']|["']$/g, '') : undefined;
}
