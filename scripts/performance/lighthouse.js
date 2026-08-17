#!/usr/bin/env node

/**
 * Extract Lighthouse Scores from JSON Report
 */

const fs = require('fs');
const path = require('path');

function extractScores(reportPath) {
  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    const data = JSON.parse(content);

    // Find category scores
    const categories = data.categories || {};

    const scores = {
      performance: Math.round((categories.performance?.score || 0) * 100),
      accessibility: Math.round((categories.accessibility?.score || 0) * 100),
      'best-practices': Math.round((categories['best-practices']?.score || 0) * 100),
      seo: Math.round((categories.seo?.score || 0) * 100),
    };

    // Find individual metrics
    const audits = data.audits || {};
    const metrics = {
      fcp: Math.round((audits['first-contentful-paint']?.score || 0) * 100),
      lcp: Math.round((audits['largest-contentful-paint']?.score || 0) * 100),
      cls: Math.round((audits['cumulative-layout-shift']?.score || 0) * 100),
      tbt: Math.round((audits['total-blocking-time']?.score || 0) * 100),
      si: Math.round((audits['speed-index']?.score || 0) * 100),
    };

    return { scores, metrics };
  } catch (error) {
    console.error('Error reading report:', error.message);
    return null;
  }
}

function main() {
  const reports = ['lighthouse-home-cloudflare.json', 'lighthouse-about-cloudflare.json'];

  console.log('📊 Current Lighthouse Scores\n');

  reports.forEach((report) => {
    const result = extractScores(report);
    if (result) {
      const page = report.includes('home') ? 'Homepage' : 'About Page';
      console.log(`\n🎯 ${page}:`);
      console.log(`   Performance:    ${result.scores.performance}/100`);
      console.log(`   Accessibility:  ${result.scores.accessibility}/100`);
      console.log(`   Best Practices: ${result.scores['best-practices']}/100`);
      console.log(`   SEO:           ${result.scores.seo}/100`);
      console.log(`   \n   Core Metrics:`);
      console.log(`   FCP: ${result.metrics.fcp}/100 (First Contentful Paint)`);
      console.log(`   LCP: ${result.metrics.lcp}/100 (Largest Contentful Paint)`);
      console.log(`   CLS: ${result.metrics.cls}/100 (Cumulative Layout Shift)`);
      console.log(`   TBT: ${result.metrics.tbt}/100 (Total Blocking Time)`);
      console.log(`   SI:  ${result.metrics.si}/100 (Speed Index)`);
    }
  });
}

if (require.main === module) {
  main();
}
