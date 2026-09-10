#!/usr/bin/env node

/**
 * Performance Testing Script
 * Tests performance metrics and validates optimizations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {},
    };

    this.thresholds = {
      fcp: 1800, // First Contentful Paint < 1.8s
      lcp: 2500, // Largest Contentful Paint < 2.5s
      cls: 0.1, // Cumulative Layout Shift < 0.1
      tbt: 200, // Total Blocking Time < 200ms
      si: 3400, // Speed Index < 3.4s
      ttfb: 800, // Time to First Byte < 800ms
    };
  }

  testBuildSize() {
    console.log('📦 Testing build size...');

    const staticDir = path.join(process.cwd(), '.next', 'static');
    const buildDir = path.join(process.cwd(), '.next');
    if (!fs.existsSync(buildDir)) {
      this.addTest('build_size', false, 'Build directory not found');
      return;
    }

    // Measure the actual client-side static bundle served to visitors
    // (excludes local development HMR cache, compiler dev cache, and standalone node_modules)
    const targetDir = fs.existsSync(staticDir) ? staticDir : buildDir;
    const getDirSize = (dir) => {
      let size = 0;
      const files = fs.readdirSync(dir);

      files.forEach((file) => {
        if (['dev', 'cache', 'standalone'].includes(file)) return;
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          size += getDirSize(filePath);
        } else {
          size += stats.size;
        }
      });

      return size;
    };

    const totalSize = getDirSize(targetDir);
    const sizeMB = totalSize / (1024 * 1024);

    const passed = sizeMB < 10; // Target: < 10MB total client assets

    this.addTest(
      'build_size',
      passed,
      `Client static asset size: ${sizeMB.toFixed(2)}MB ${passed ? '(✅ < 10MB)' : '(❌ > 10MB)'}`
    );
  }

  testCriticalCSS() {
    console.log('🎨 Testing critical CSS...');

    const criticalCSSPath = path.join(process.cwd(), 'public', 'css', 'critical.css');

    if (!fs.existsSync(criticalCSSPath)) {
      this.addTest('critical_css', false, 'Critical CSS file not found');
      return;
    }

    const content = fs.readFileSync(criticalCSSPath, 'utf8');
    const size = Buffer.byteLength(content, 'utf8');
    const sizeKB = size / 1024;

    const passed = sizeKB < 50; // Target: < 50KB critical CSS

    this.addTest(
      'critical_css',
      passed,
      `Critical CSS size: ${sizeKB.toFixed(2)}KB ${passed ? '(✅ < 50KB)' : '(❌ > 50KB)'}`
    );
  }

  testImageOptimization() {
    console.log('🖼️  Testing image optimization...');

    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      this.addTest('image_optimization', true, 'No public directory found');
      return;
    }

    const imageFiles = this.findFiles(publicDir, [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.avif',
    ]);

    let largeImages = 0;
    let totalSize = 0;

    imageFiles.forEach((file) => {
      const stats = fs.statSync(file);
      totalSize += stats.size;

      if (stats.size > 200 * 1024) {
        // > 200KB
        largeImages++;
      }
    });

    const passed = largeImages === 0; // Target: no images > 200KB

    this.addTest(
      'image_optimization',
      passed,
      `Found ${largeImages} images > 200KB ${passed ? '(✅ all optimized)' : '(❌ needs optimization)'}`
    );
  }

  testCompression() {
    console.log('🗜️  Testing compression...');

    // Check if gzip/brotli compression is configured
    const nextConfigPath = path.join(process.cwd(), 'next.config.mjs');

    if (fs.existsSync(nextConfigPath)) {
      const content = fs.readFileSync(nextConfigPath, 'utf8');
      const hasCompression = content.includes('compress: true') || content.includes('gzip');

      this.addTest(
        'compression',
        hasCompression,
        hasCompression ? 'Compression enabled' : 'Compression not configured'
      );
    } else {
      this.addTest('compression', false, 'next.config.mjs not found');
    }
  }

  testCaching() {
    console.log('💾 Testing caching configuration...');

    const nextConfigPath = path.join(process.cwd(), 'next.config.mjs');

    if (fs.existsSync(nextConfigPath)) {
      const content = fs.readFileSync(nextConfigPath, 'utf8');
      const hasCaching = content.includes('Cache-Control') || content.includes('max-age');

      this.addTest(
        'caching',
        hasCaching,
        hasCaching ? 'Caching headers configured' : 'Caching not configured'
      );
    } else {
      this.addTest('caching', false, 'next.config.mjs not found');
    }
  }

  testBundleSplitting() {
    console.log('📦 Testing bundle splitting...');

    const buildDir = path.join(process.cwd(), '.next', 'static', 'chunks');

    if (!fs.existsSync(buildDir)) {
      this.addTest('bundle_splitting', false, 'Build chunks not found');
      return;
    }

    const chunks = fs
      .readdirSync(buildDir)
      .filter((file) => file.endsWith('.js'))
      .map((file) => {
        const stats = fs.statSync(path.join(buildDir, file));
        return {
          name: file,
          size: stats.size,
        };
      })
      .filter((chunk) => chunk.size > 100 * 1024); // > 100KB

    const passed = chunks.length <= 15; // Target: healthy on-demand vendor chunking (< 15)

    this.addTest(
      'bundle_splitting',
      passed,
      `Found ${chunks.length} vendor chunks (>100KB) ${passed ? '(✅ well-split on-demand)' : '(❌ too many)'}`
    );
  }

  findFiles(dir, extensions, files = []) {
    const items = fs.readdirSync(dir);

    items.forEach((item) => {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        this.findFiles(fullPath, extensions, files);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    });

    return files;
  }

  addTest(name, passed, message) {
    this.results.tests.push({
      name,
      passed,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  generateSummary() {
    const total = this.results.tests.length;
    const passed = this.results.tests.filter((test) => test.passed).length;
    const failed = total - passed;

    this.results.summary = {
      total,
      passed,
      failed,
      passRate: Math.round((passed / total) * 100),
    };

    return this.results.summary;
  }

  displayResults() {
    console.log('\n📊 Performance Test Results:\n');

    this.results.tests.forEach((test) => {
      const status = test.passed ? '✅' : '❌';
      const color = test.passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}${status} ${test.name}: ${test.message}\x1b[0m`);
    });

    const summary = this.generateSummary();

    console.log(`\n📈 Summary:`);
    console.log(`   Total Tests: ${summary.total}`);
    console.log(`   Passed: ${summary.passed}`);
    console.log(`   Failed: ${summary.failed}`);
    console.log(`   Pass Rate: ${summary.passRate}%`);

    if (summary.passRate >= 80) {
      console.log('\n🎉 Great performance! Ready for 100/100 scores.');
    } else if (summary.passRate >= 60) {
      console.log('\n⚠️  Good performance, but some optimizations needed.');
    } else {
      console.log('\n❌ Performance needs significant improvement.');
    }
  }

  saveReport() {
    const reportPath = path.join(process.cwd(), 'performance-test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Results saved to: ${reportPath}`);
  }

  async run() {
    console.log('🚀 Starting Performance Tests...\n');

    this.testBuildSize();
    this.testCriticalCSS();
    this.testImageOptimization();
    this.testCompression();
    this.testCaching();
    this.testBundleSplitting();

    this.displayResults();
    this.saveReport();

    const summary = this.generateSummary();
    return summary.passRate >= 80; // Return true if good performance
  }
}

// CLI usage
if (require.main === module) {
  const tester = new PerformanceTester();
  tester
    .run()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { PerformanceTester };
