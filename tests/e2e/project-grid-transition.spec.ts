import { expect, test, type Page } from '@playwright/test';

type VisibleProjectCard = {
  href: string;
  left: number;
  top: number;
  width: number;
  height: number;
  visibleArea: number;
};

async function getPrimaryVisibleProjectCard(page: Page): Promise<VisibleProjectCard | null> {
  return page.locator('a[data-project-card][href^="/projects/"]').evaluateAll((elements) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    return (
      elements
        .map((element) => {
          const htmlElement = element as HTMLAnchorElement;
          const rect = htmlElement.getBoundingClientRect();
          const style = window.getComputedStyle(htmlElement);
          const intersectWidth = Math.max(
            0,
            Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
          );
          const intersectHeight = Math.max(
            0,
            Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
          );

          return {
            href: htmlElement.href,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            visibleArea: intersectWidth * intersectHeight,
            display: style.display,
            visibility: style.visibility,
            opacity: Number(style.opacity),
          };
        })
        .filter(
          (item) =>
            item.display !== 'none' &&
            item.visibility !== 'hidden' &&
            item.opacity > 0.01 &&
            item.width > 0 &&
            item.height > 0 &&
            item.visibleArea > 1000
        )
        .sort((a, b) => b.visibleArea - a.visibleArea)[0] ?? null
    );
  });
}

async function getPrimaryVisibleProjectCardExcluding(
  page: Page,
  excludedHref: string
): Promise<VisibleProjectCard | null> {
  return page
    .locator('a[data-project-card][href^="/projects/"]')
    .evaluateAll((elements, excluded) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      return (
        elements
          .map((element) => {
            const htmlElement = element as HTMLAnchorElement;
            const rect = htmlElement.getBoundingClientRect();
            const style = window.getComputedStyle(htmlElement);
            const href = htmlElement.getAttribute('href') ?? '';
            const intersectWidth = Math.max(
              0,
              Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
            );
            const intersectHeight = Math.max(
              0,
              Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
            );

            return {
              href,
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              visibleArea: intersectWidth * intersectHeight,
              display: style.display,
              visibility: style.visibility,
              opacity: Number(style.opacity),
            };
          })
          .filter(
            (item) =>
              item.href !== excluded &&
              item.display !== 'none' &&
              item.visibility !== 'hidden' &&
              item.opacity > 0.01 &&
              item.width > 0 &&
              item.height > 0 &&
              item.visibleArea > 1000
          )
          .sort((a, b) => b.visibleArea - a.visibleArea)[0] ?? null
      );
    }, excludedHref);
}

async function measureAnimationFrameFps(page: Page, durationMs = 900): Promise<number> {
  return page.evaluate(async (duration) => {
    return new Promise<number>((resolve) => {
      let frames = 0;
      const start = performance.now();

      function tick() {
        frames += 1;
        const elapsed = performance.now() - start;
        if (elapsed >= duration) {
          resolve((frames * 1000) / elapsed);
        } else {
          requestAnimationFrame(tick);
        }
      }

      requestAnimationFrame(tick);
    });
  }, durationMs);
}

function isIgnoredConsoleWarning(warning: string): boolean {
  return (
    warning.includes('Download the React DevTools') ||
    warning.includes('was preloaded using link preload but not used')
  );
}

test('grid project card uses deck shuffle, root slide, and cover morph when navigating to slug', async ({
  page,
}) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });

  await page.goto('/projects?view=grid', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-projects-grid]').first()).toBeVisible();

  await expect
    .poll(
      async () => {
        const card = await getPrimaryVisibleProjectCard(page);
        return card?.visibleArea ?? 0;
      },
      { timeout: 15000 }
    )
    .toBeGreaterThan(1000);

  await page.evaluate(() => {
    window.__gridTransitionSamples = [];
    document.addEventListener(
      'click',
      () => {
        let frames = 0;

        function sampleTransitionState() {
          const rootOldStyle = window.getComputedStyle(
            document.documentElement,
            '::view-transition-old(root)'
          );
          const rootNewStyle = window.getComputedStyle(
            document.documentElement,
            '::view-transition-new(root)'
          );

          window.__gridTransitionSamples.push({
            origin: document.documentElement.getAttribute('data-project-cover-origin'),
            morphActive: document.documentElement.getAttribute('data-vt-morph-active'),
            activeCards: document.querySelectorAll('[data-project-card-transition-active="true"]')
              .length,
            transitionTargets: document.querySelectorAll('[data-project-cover-transition]').length,
            rootOldAnimationName: rootOldStyle.animationName,
            rootNewAnimationName: rootNewStyle.animationName,
          });

          frames += 1;
          if (frames < 12) {
            requestAnimationFrame(sampleTransitionState);
          }
        }

        requestAnimationFrame(sampleTransitionState);
      },
      { capture: true, once: true }
    );
  });

  const targetCard = await getPrimaryVisibleProjectCard(page);
  if (!targetCard) {
    throw new Error('No visible grid project card available for transition test.');
  }

  const navigationStartedAt = Date.now();
  await page.mouse.click(
    targetCard.left + targetCard.width / 2,
    targetCard.top + targetCard.height / 2
  );
  await page.waitForURL(/\/projects\/[^/?#]+$/, { timeout: 10000 });
  expect(Date.now() - navigationStartedAt).toBeLessThan(5000);

  const transitionSamples = await page.evaluate(() => window.__gridTransitionSamples);
  expect(transitionSamples).toContainEqual(
    expect.objectContaining({
      origin: 'grid',
      morphActive: 'true',
      activeCards: 1,
    })
  );
  expect(transitionSamples[0]?.transitionTargets).toBeGreaterThanOrEqual(1);
  expect(
    transitionSamples.some((sample) => sample.rootOldAnimationName.includes('vt-slide-out-left'))
  ).toBe(true);
  expect(
    transitionSamples.some((sample) => sample.rootNewAnimationName.includes('vt-slide-in-right'))
  ).toBe(true);

  const cover = page.locator('[data-project-cover-transition]').first();
  await expect(cover).toBeVisible();

  await page.waitForTimeout(1500);
  const htmlState = await page.evaluate(() => ({
    origin: document.documentElement.getAttribute('data-project-cover-origin'),
    morphActive: document.documentElement.getAttribute('data-vt-morph-active'),
  }));
  expect(htmlState).toEqual({ origin: null, morphActive: null });

  const detailFps = await measureAnimationFrameFps(page);
  expect(detailFps).toBeGreaterThan(40);

  expect(errors).toEqual([]);
  expect(warnings.filter((warning) => !isIgnoredConsoleWarning(warning))).toEqual([]);
});

test('project detail back to grid does not create a reverse card morph', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });

  await page.goto('/projects?view=grid', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-projects-grid]').first()).toBeVisible();

  await expect
    .poll(
      async () => {
        const card = await getPrimaryVisibleProjectCard(page);
        return card?.visibleArea ?? 0;
      },
      { timeout: 15000 }
    )
    .toBeGreaterThan(1000);

  const targetCard = await getPrimaryVisibleProjectCard(page);
  if (!targetCard) {
    throw new Error('No visible grid project card available for reverse transition test.');
  }

  await page.waitForTimeout(1500);
  const baselineGridFps = await measureAnimationFrameFps(page);

  await page.mouse.click(
    targetCard.left + targetCard.width / 2,
    targetCard.top + targetCard.height / 2
  );
  await page.waitForURL(/\/projects\/[^/?#]+$/, { timeout: 10000 });

  await page.waitForTimeout(1500);
  const detailCleanupState = await page.evaluate(() => ({
    origin: document.documentElement.getAttribute('data-project-cover-origin'),
    morphActive: document.documentElement.getAttribute('data-vt-morph-active'),
    activeCards: document.querySelectorAll('[data-project-card-transition-active="true"]').length,
  }));
  expect(detailCleanupState).toEqual({
    origin: null,
    morphActive: null,
    activeCards: 0,
  });

  await expect(page.getByText('Back to Projects')).toBeVisible();
  await page.evaluate(() => {
    window.__gridBackClickState = null;
    document.addEventListener(
      'click',
      () => {
        window.setTimeout(() => {
          const coverParticipants = Array.from(
            document.querySelectorAll<HTMLElement>('[data-project-cover-transition]')
          );

          window.__gridBackClickState = {
            coverParticipants: coverParticipants.length,
            namedProjectCovers: coverParticipants.filter(
              (element) =>
                element.style.getPropertyValue('view-transition-name') === 'project-cover'
            ).length,
            origin: document.documentElement.getAttribute('data-project-cover-origin'),
            morphActive: document.documentElement.getAttribute('data-vt-morph-active'),
          };
        }, 0);
      },
      { capture: true, once: true }
    );
  });

  const reverseSamplesPromise = page.evaluate(() => {
    window.__gridBackTransitionSamples = [];

    return new Promise<typeof window.__gridBackTransitionSamples>((resolve) => {
      let frames = 0;

      function sample() {
        const activeCard = document.querySelector<HTMLAnchorElement>(
          '[data-project-card-transition-active="true"]'
        );

        window.__gridBackTransitionSamples.push({
          origin: document.documentElement.getAttribute('data-project-cover-origin'),
          morphActive: document.documentElement.getAttribute('data-vt-morph-active'),
          transitionTargets: document.querySelectorAll('[data-project-cover-transition]').length,
          activeCards: document.querySelectorAll('[data-project-card-transition-active="true"]')
            .length,
          activeHref: activeCard?.getAttribute('href') ?? null,
        });

        frames += 1;
        if (frames < 90) {
          requestAnimationFrame(sample);
        } else {
          resolve(window.__gridBackTransitionSamples);
        }
      }

      requestAnimationFrame(sample);
    });
  });

  const backStartedAt = Date.now();
  await page.getByText('Back to Projects').click();
  await page.waitForURL(/\/projects$/, { timeout: 10000 });
  expect(Date.now() - backStartedAt).toBeLessThan(5000);
  await expect(page.locator('[data-projects-grid]').first()).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => window.__gridBackClickState), { timeout: 5000 })
    .not.toBeNull();
  const clickState = await page.evaluate(() => window.__gridBackClickState);
  expect(clickState).toEqual({
    coverParticipants: 0,
    namedProjectCovers: 0,
    origin: null,
    morphActive: null,
  });

  const reverseSamples = await reverseSamplesPromise;
  expect(
    reverseSamples.some(
      (sample) =>
        sample.origin === 'grid' ||
        sample.morphActive === 'true' ||
        sample.activeCards > 0 ||
        sample.activeHref !== null
    )
  ).toBe(false);

  await page.waitForTimeout(1500);
  const cleanupState = await page.evaluate(() => ({
    origin: document.documentElement.getAttribute('data-project-cover-origin'),
    morphActive: document.documentElement.getAttribute('data-vt-morph-active'),
    activeCards: document.querySelectorAll('[data-project-card-transition-active="true"]').length,
    transitionTargets: document.querySelectorAll(
      '[data-project-card] [data-project-cover-transition]'
    ).length,
  }));
  expect(cleanupState).toEqual({
    origin: null,
    morphActive: null,
    activeCards: 0,
    transitionTargets: 0,
  });

  const gridFps = await measureAnimationFrameFps(page);
  expect(gridFps).toBeGreaterThan(25);
  expect(gridFps).toBeGreaterThanOrEqual(baselineGridFps - 8);

  expect(errors).toEqual([]);
  expect(warnings.filter((warning) => !isIgnoredConsoleWarning(warning))).toEqual([]);
});

test('project detail related card morphs to another slug without root slide', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });

  await page.goto('/projects?view=grid', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-projects-grid]').first()).toBeVisible();

  await expect
    .poll(
      async () => {
        const card = await getPrimaryVisibleProjectCard(page);
        return card?.visibleArea ?? 0;
      },
      { timeout: 15000 }
    )
    .toBeGreaterThan(1000);

  const gridCard = await getPrimaryVisibleProjectCard(page);
  if (!gridCard) {
    throw new Error('No visible grid card available for related transition test.');
  }

  await page.mouse.click(gridCard.left + gridCard.width / 2, gridCard.top + gridCard.height / 2);
  await page.waitForURL(/\/projects\/[^/?#]+$/, { timeout: 10000 });
  await page.waitForTimeout(1500);

  const currentPath = new URL(page.url()).pathname;
  const relatedCard = await getPrimaryVisibleProjectCardExcluding(page, currentPath);
  if (!relatedCard) {
    throw new Error('No visible related card available for slug-to-slug transition test.');
  }

  await page.evaluate(() => {
    window.__relatedSlugTransitionSamples = [];
    document.addEventListener(
      'click',
      () => {
        let frames = 0;

        function sampleTransitionState() {
          const rootOldStyle = window.getComputedStyle(
            document.documentElement,
            '::view-transition-old(root)'
          );
          const rootNewStyle = window.getComputedStyle(
            document.documentElement,
            '::view-transition-new(root)'
          );

          window.__relatedSlugTransitionSamples.push({
            origin: document.documentElement.getAttribute('data-project-cover-origin'),
            morphActive: document.documentElement.getAttribute('data-vt-morph-active'),
            activeCards: document.querySelectorAll('[data-project-card-transition-active="true"]')
              .length,
            transitionTargets: document.querySelectorAll('[data-project-cover-transition]').length,
            rootOldAnimationName: rootOldStyle.animationName,
            rootNewAnimationName: rootNewStyle.animationName,
          });

          frames += 1;
          if (frames < 12) {
            requestAnimationFrame(sampleTransitionState);
          }
        }

        requestAnimationFrame(sampleTransitionState);
      },
      { capture: true, once: true }
    );
  });

  await page.mouse.click(
    relatedCard.left + relatedCard.width / 2,
    relatedCard.top + relatedCard.height / 2
  );
  await page.waitForURL(
    (url) => url.pathname !== currentPath && /^\/projects\/[^/]+$/.test(url.pathname),
    {
      timeout: 10000,
    }
  );

  const transitionSamples = await page.evaluate(() => window.__relatedSlugTransitionSamples);
  expect(transitionSamples).toContainEqual(
    expect.objectContaining({
      origin: 'slug-related',
      morphActive: 'true',
      activeCards: 1,
    })
  );
  expect(transitionSamples[0]?.transitionTargets).toBeGreaterThanOrEqual(1);
  expect(
    transitionSamples.some(
      (sample) =>
        sample.rootOldAnimationName.includes('vt-slide') ||
        sample.rootNewAnimationName.includes('vt-slide')
    )
  ).toBe(false);

  await page.waitForTimeout(1500);
  const htmlState = await page.evaluate(() => ({
    origin: document.documentElement.getAttribute('data-project-cover-origin'),
    morphActive: document.documentElement.getAttribute('data-vt-morph-active'),
  }));
  expect(htmlState).toEqual({ origin: null, morphActive: null });

  const detailFps = await measureAnimationFrameFps(page);
  expect(detailFps).toBeGreaterThan(25);

  expect(errors).toEqual([]);
  expect(warnings.filter((warning) => !isIgnoredConsoleWarning(warning))).toEqual([]);
});

declare global {
  interface Window {
    __gridTransitionSamples: Array<{
      origin: string | null;
      morphActive: string | null;
      activeCards: number;
      transitionTargets: number;
      rootOldAnimationName: string;
      rootNewAnimationName: string;
    }>;
    __gridBackTransitionSamples: Array<{
      origin: string | null;
      morphActive: string | null;
      transitionTargets: number;
      activeCards: number;
      activeHref: string | null;
    }>;
    __gridBackClickState: {
      coverParticipants: number;
      namedProjectCovers: number;
      origin: string | null;
      morphActive: string | null;
    } | null;
    __relatedSlugTransitionSamples: Array<{
      origin: string | null;
      morphActive: string | null;
      activeCards: number;
      transitionTargets: number;
      rootOldAnimationName: string;
      rootNewAnimationName: string;
    }>;
  }
}
