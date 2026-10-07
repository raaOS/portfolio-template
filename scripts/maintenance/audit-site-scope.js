const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const requiredRoutes = [
  'src/app/api/about/route.ts',
  'src/app/api/about/labels/route.ts',
  'src/app/api/about/philosophy/route.ts',
  'src/app/api/about/wallpaper-collection/route.ts',
  'src/app/api/contact/route.ts',
  'src/app/api/experience/route.ts',
  'src/app/api/gallery/featured/route.ts',
  'src/app/api/hard-skills/route.ts',
  'src/app/api/hard-skills/[id]/route.ts',
  'src/app/api/hard-skills/concepts/route.ts',
  'src/app/api/hard-skills/concepts/[id]/route.ts',
  'src/app/api/sticky-notes/route.ts',
  'src/app/api/testimonial/route.ts',
  'src/app/api/testimonial/[id]/route.ts',
];

const requiredSnippets = [
  {
    file: 'src/lib/about.ts',
    snippets: ['loadAboutData(siteId', 'getCachedAboutData(siteId)', 'loadOSConfig(siteId'],
  },
  {
    file: 'src/lib/experience.ts',
    snippets: ['loadExperienceData(siteId', 'experienceService.getExperienceData(false, false, siteId)'],
  },
  {
    file: 'src/lib/labels.ts',
    snippets: ['allLabelsAsync(siteId', 'service.getData(false, false, siteId)'],
  },
  {
    file: 'src/app/api/homepage/route.ts',
    snippets: ['resolveRequestSiteId', 'assertKnownSite(siteId)', 'loadHomepageData(siteId)'],
  },
  {
    file: 'src/app/api/admin/wallpaper-poster-backfill/route.ts',
    snippets: [
      'resolveRequestSiteId',
      'aboutService.getAboutData(true, false, siteId)',
      'aboutService.updateAboutData(',
      'revalidateSiteContentPaths(siteId',
      "clean.indexOf('sites/')",
    ],
  },
];

const failures = [];

for (const route of requiredRoutes) {
  const absolute = path.join(root, route);
  const source = fs.readFileSync(absolute, 'utf8');

  if (!source.includes('resolveRequestSiteId')) {
    failures.push(`${route}: missing resolveRequestSiteId`);
  }

  if (/(export\s+async\s+function\s+(POST|PUT|PATCH|DELETE))/.test(source)) {
    if (!source.includes('validateSiteMutationRequest')) {
      failures.push(`${route}: mutation route missing validateSiteMutationRequest`);
    }
    if (!source.includes('revalidateSiteContentPaths')) {
      failures.push(`${route}: mutation route missing tenant revalidation`);
    }
  }
}

for (const check of requiredSnippets) {
  const absolute = path.join(root, check.file);
  const source = fs.readFileSync(absolute, 'utf8');

  for (const snippet of check.snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${check.file}: missing ${snippet}`);
    }
  }
}

if (failures.length > 0) {
  console.error('[site-scope:audit] FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `[site-scope:audit] OK: ${requiredRoutes.length} content routes and ${requiredSnippets.length} site helpers are scoped.`
);
