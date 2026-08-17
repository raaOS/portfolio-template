const fs = require('node:fs');
const path = require('node:path');

const PATCH_MARKER = 'portfolio-template Windows Turbopack path patch';

function patchOpenNextWindowsTurbopackPlugin() {
  if (process.platform !== 'win32') return;

  const pluginPath = path.join(
    process.cwd(),
    'node_modules',
    '@opennextjs',
    'cloudflare',
    'dist',
    'cli',
    'build',
    'patches',
    'plugins',
    'turbopack.js'
  );

  if (!fs.existsSync(pluginPath)) {
    throw new Error(`OpenNext Turbopack patch target not found: ${pluginPath}`);
  }

  const source = fs.readFileSync(pluginPath, 'utf8');
  if (source.includes(PATCH_MARKER)) return;

  let patched = source;

  patched = patched.replace(
    `        if (file === "[turbopack]_runtime.js") {
            continue;
        }
        if (file.includes(".next/server/chunks/")) {
            chunks.add(file);
        }`,
    `        // ${PATCH_MARKER}: OpenNext 1.20.x receives Windows backslash
        // paths in tracedFiles, while this plugin searches POSIX paths.
        const normalizedFile = file.replaceAll("\\\\", "/");
        if (normalizedFile.endsWith("[turbopack]_runtime.js")) {
            continue;
        }
        if (normalizedFile.includes(".next/server/chunks/")) {
            chunks.add(normalizedFile);
        }`
  );

  patched = patched.replace(
    `    const wasmFiles = tracedFiles.filter((f) => f.endsWith(".wasm"));
    const cases = wasmFiles
        .map((absPath) => ({ absPath, relPath: absPath.replace(/.*\\/\\.next\\//, "") }))
        .map(({ absPath, relPath }) => \`      case "\${relPath}": return (await import("\${absPath}")).default;\`)
        .join("\\n");`,
    `    const wasmFiles = tracedFiles.filter((f) => f.endsWith(".wasm"));
    const cases = wasmFiles
        .map((absPath) => {
        const normalizedAbsPath = absPath.replaceAll("\\\\", "/");
        return { absPath: normalizedAbsPath, relPath: normalizedAbsPath.replace(/.*\\/\\.next\\//, "") };
    })
        .map(({ absPath, relPath }) => \`      case "\${relPath}": return (await import("\${absPath}")).default;\`)
        .join("\\n");`
  );

  if (patched === source) {
    throw new Error('OpenNext Turbopack Windows patch did not match the installed package.');
  }

  fs.writeFileSync(pluginPath, patched);
  console.log('[cloudflare-build] Patched OpenNext Turbopack plugin for Windows path normalization.');
}

function patchOpenNextOptimizeCss() {
  const copyTracedFilesPath = path.join(
    process.cwd(),
    'node_modules',
    '@opennextjs',
    'aws',
    'dist',
    'build',
    'copyTracedFiles.js'
  );
  if (!fs.existsSync(copyTracedFilesPath)) return;

  const source = fs.readFileSync(copyTracedFilesPath, 'utf8');
  const OPTIMIZE_CSS_PATCH_MARKER = 'portfolio-template optimizeCss safe cpSync patch';
  if (source.includes(OPTIMIZE_CSS_PATCH_MARKER)) return;

  const target = `    if (config.experimental.optimizeCss) {
        cpSync(path.join(standaloneNextDir, "static", "css"), path.join(outputNextDir, "static", "css"), { recursive: true });
    }`;

  const replacement = `    if (config.experimental.optimizeCss) {
        // ${OPTIMIZE_CSS_PATCH_MARKER}
        const cssSrc = path.join(standaloneNextDir, "static", "css");
        if (existsSync(cssSrc)) {
            cpSync(cssSrc, path.join(outputNextDir, "static", "css"), { recursive: true });
        }
    }`;

  if (source.includes(target)) {
    const patched = source.replace(target, replacement);
    fs.writeFileSync(copyTracedFilesPath, patched);
    console.log('[cloudflare-build] Patched OpenNext AWS copyTracedFiles for safe optimizeCss handling.');
  }
}

function patchAllOpenNext() {
  patchOpenNextWindowsTurbopackPlugin();
  patchOpenNextOptimizeCss();
}

module.exports = { patchOpenNextWindowsTurbopackPlugin: patchAllOpenNext };

