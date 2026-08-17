#!/usr/bin/env node
/**
 * Dev orchestrator for the sellable template repo.
 *
 * Starts only the Next.js dev server. Personal bot pollers and webhook helpers
 * are intentionally not part of this template.
 */

const { spawn } = require('child_process');
const net = require('net');

function shouldFilterKnownDevNotice(line) {
  return line.includes('The "middleware" file convention is deprecated. Please use "proxy" instead.');
}

function pipeFilteredOutput(stream, target) {
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!shouldFilterKnownDevNotice(line)) {
        target.write(`${line}\n`);
      }
    }
  });

  stream.on('end', () => {
    if (buffer && !shouldFilterKnownDevNotice(buffer)) {
      target.write(buffer);
    }
  });
}

function resolveNextCli() {
  try {
    return require.resolve('next/dist/bin/next');
  } catch {
    console.error(
      'Next.js belum terpasang dengan benar. Jalankan ulang `npm install` agar dependency sinkron.'
    );
    process.exit(1);
  }
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

async function findPort() {
  const preferred = Number(process.env.PORT || 3000);
  const candidates = [preferred, 3001, 3002, 3100, 3101];

  for (const port of candidates) {
    if (await isPortAvailable(port)) return port;
  }

  throw new Error(`Tidak menemukan port kosong dari kandidat: ${candidates.join(', ')}`);
}

async function main() {
  const port = await findPort().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });

  const forwardedArgs = process.argv.slice(2);
  const hasBundlerFlag = forwardedArgs.some((arg) =>
    ['--webpack', '--turbopack', '--turbo'].includes(arg)
  );
  const defaultBundlerArgs = process.platform === 'win32' && !hasBundlerFlag ? ['--webpack'] : [];

  const child = spawn(
    process.execPath,
    [resolveNextCli(), 'dev', '-p', String(port), ...defaultBundlerArgs, ...forwardedArgs],
    {
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
    }
  );

  pipeFilteredOutput(child.stdout, process.stdout);
  pipeFilteredOutput(child.stderr, process.stderr);

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

void main();
