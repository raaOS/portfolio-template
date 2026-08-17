const fs = require('node:fs');
const path = require('node:path');
const { syncBuiltinESMExports } = require('node:module');

if (process.platform === 'win32') {
  const originalSymlinkSync = fs.symlinkSync.bind(fs);
  const originalSymlink = fs.promises.symlink.bind(fs.promises);

  function canFallback(error) {
    return error && (error.code === 'EPERM' || error.code === 'EACCES');
  }

  function resolveExistingTarget(target, linkPath) {
    const candidates = [
      path.resolve(String(target)),
      path.resolve(path.dirname(String(linkPath)), String(target)),
      path.resolve(process.cwd(), String(target)),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
  }

  function ensureParent(linkPath) {
    fs.mkdirSync(path.dirname(String(linkPath)), { recursive: true });
  }

  function fallbackSync(target, linkPath, originalError) {
    const resolvedTarget = resolveExistingTarget(target, linkPath);
    if (!resolvedTarget) {
      throw originalError;
    }

    ensureParent(linkPath);
    const stats = fs.statSync(resolvedTarget);

    if (stats.isDirectory()) {
      try {
        return originalSymlinkSync(resolvedTarget, linkPath, 'junction');
      } catch (junctionError) {
        if (!canFallback(junctionError)) {
          throw junctionError;
        }
        fs.cpSync(resolvedTarget, linkPath, { recursive: true, force: false });
        return undefined;
      }
    }

    fs.copyFileSync(resolvedTarget, linkPath);
    return undefined;
  }

  async function fallbackAsync(target, linkPath, originalError) {
    const resolvedTarget = resolveExistingTarget(target, linkPath);
    if (!resolvedTarget) {
      throw originalError;
    }

    await fs.promises.mkdir(path.dirname(String(linkPath)), { recursive: true });
    const stats = await fs.promises.stat(resolvedTarget);

    if (stats.isDirectory()) {
      try {
        return await originalSymlink(resolvedTarget, linkPath, 'junction');
      } catch (junctionError) {
        if (!canFallback(junctionError)) {
          throw junctionError;
        }
        await fs.promises.cp(resolvedTarget, linkPath, { recursive: true, force: false });
        return undefined;
      }
    }

    await fs.promises.copyFile(resolvedTarget, linkPath);
    return undefined;
  }

  fs.symlinkSync = function symlinkSyncWithWindowsFallback(target, linkPath, type) {
    try {
      return originalSymlinkSync(target, linkPath, type);
    } catch (error) {
      if (!canFallback(error)) {
        throw error;
      }
      return fallbackSync(target, linkPath, error);
    }
  };

  fs.promises.symlink = async function symlinkWithWindowsFallback(target, linkPath, type) {
    try {
      return await originalSymlink(target, linkPath, type);
    } catch (error) {
      if (!canFallback(error)) {
        throw error;
      }
      return fallbackAsync(target, linkPath, error);
    }
  };

  syncBuiltinESMExports();
}
