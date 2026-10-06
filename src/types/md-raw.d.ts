// Impor file Markdown mentah ala Vite (`?raw`) — hanya dipakai unit test (vitest),
// tidak pernah masuk bundle runtime Worker.
declare module '*.md?raw' {
  const content: string;
  export default content;
}
