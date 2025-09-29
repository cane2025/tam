#!/usr/bin/env tsx

/**
 * Complete System Audit for Ungdomsstöd V2
 * Comprehensive audit that works even without backend running
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Typdefinitioner
interface AuditResult {
  score: number; // 0-100
  criticalIssues: string[];
  warnings: string[];
  passed: string[];
  notes: string[];
}

interface AuditReport {
  timestamp: string;
  totalScore: number;
  results: {
    security: AuditResult;
    performance: AuditResult;
    codeQuality: AuditResult;
    dataIntegrity: AuditResult;
    errorHandling: AuditResult;
    deployment: AuditResult;
  };
  criticalIssues: string[];
  warnings: string[];
  productionReady: boolean;
}

// 1. SÄKERHETSAUDIT (25% vikt)
async function auditSecurity(): Promise<AuditResult> {
  const result: AuditResult = {
    score: 0,
    criticalIssues: [],
    warnings: [],
    passed: [],
    notes: []
  };

  // Test 1: Kontrollera security headers i kod
  const indexPath = 'server/index.ts';
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf-8');
    if (content.includes('helmet')) {
      result.passed.push('Helmet security headers configured');
      result.score += 20;
    } else {
      result.warnings.push('No helmet configuration found');
    }
  } else {
    result.notes.push('Server file not found - N/A');
    result.score = 60; // Neutral baseline
  }

  // Test 2: Kontrollera för hårdkodade secrets
  try {
    const srcFiles = execSync('find . -name "*.ts" -o -name "*.tsx" 2>/dev/null || true', { encoding: 'utf-8' });
    const secretPatterns = [
      /api[_-]?key\s*=\s*["'][^"']+["']/gi,
      /password\s*=\s*["'][^"']+["']/gi,
      /secret\s*=\s*["'][^"']+["']/gi
    ];
    
    let hardcodedSecrets = 0;
    srcFiles.split('\n').forEach(file => {
      if (file && fs.existsSync(file) && !file.includes('node_modules')) {
        const content = fs.readFileSync(file, 'utf-8');
        secretPatterns.forEach(pattern => {
          if (pattern.test(content)) hardcodedSecrets++;
        });
      }
    });

    if (hardcodedSecrets > 0) {
      result.criticalIssues.push(`Found ${hardcodedSecrets} potential hardcoded secrets`);
    } else {
      result.passed.push('No hardcoded secrets detected');
      result.score += 20;
    }
  } catch {
    result.notes.push('Could not scan for secrets');
  }

  // Test 3: GDPR compliance check
  if (fs.existsSync('server/utils/audit-logger.ts')) {
    const auditContent = fs.readFileSync('server/utils/audit-logger.ts', 'utf-8');
    if (auditContent.includes('anonymize') || auditContent.includes('hash')) {
      result.passed.push('GDPR: Audit logs are anonymized');
      result.score += 20;
    } else {
      result.warnings.push('GDPR: Audit logs may contain PII');
    }
  }

  // Test 4: Auth implementation
  if (fs.existsSync('server/routes/auth.ts')) {
    const authContent = fs.readFileSync('server/routes/auth.ts', 'utf-8');
    if (authContent.includes('bcrypt') && authContent.includes('jwt')) {
      result.passed.push('Authentication properly implemented');
      result.score += 20;
    }
  }

  // Test 5: Migration safety
  if (fs.existsSync('scripts/v1-to-v2-migration.ts')) {
    const migrationContent = fs.readFileSync('scripts/v1-to-v2-migration.ts', 'utf-8');
    if (migrationContent.includes('BEGIN TRANSACTION') && migrationContent.includes('ROLLBACK')) {
      result.passed.push('Migration has transaction safety');
      result.score += 20;
    } else {
      result.criticalIssues.push('Migration lacks transaction safety');
    }
  }

  return result;
}

// 2. PERFORMANCE ANALYS (20% vikt)
async function analyzePerformance(): Promise<AuditResult> {
  const result: AuditResult = {
    score: 0,
    criticalIssues: [],
    warnings: [],
    passed: [],
    notes: []
  };

  // Test 1: Bundle size check
  try {
    execSync('npm run build', { stdio: 'ignore' });
    const distPath = 'dist';
    if (fs.existsSync(distPath)) {
      const getDirSize = (dir: string): number => {
        let size = 0;
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            size += getDirSize(filePath);
          } else {
            size += stat.size;
          }
        });
        return size;
      };
      
      const bundleSize = getDirSize(distPath) / (1024 * 1024); // MB
      if (bundleSize < 1) {
        result.passed.push(`Bundle size optimal: ${bundleSize.toFixed(2)}MB`);
        result.score += 40;
      } else if (bundleSize < 5) {
        result.warnings.push(`Bundle size large: ${bundleSize.toFixed(2)}MB`);
        result.score += 20;
      } else {
        result.criticalIssues.push(`Bundle too large: ${bundleSize.toFixed(2)}MB`);
      }
    }
  } catch {
    result.notes.push('Build failed - cannot measure bundle size');
  }

  // Test 2: Check for N+1 queries
  try {
    const apiFiles = execSync('find . -path "*/server/*" -name "*.ts" 2>/dev/null || true', { encoding: 'utf-8' });
    let n1Patterns = 0;
    apiFiles.split('\n').forEach(file => {
      if (file && fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        // Look for loops with DB queries
        if (/for.*await.*db\.|\.map.*async.*db\./g.test(content)) {
          n1Patterns++;
        }
      }
    });

    if (n1Patterns > 0) {
      result.warnings.push(`Found ${n1Patterns} potential N+1 query patterns`);
      result.score += 20;
    } else {
      result.passed.push('No N+1 query patterns detected');
      result.score += 40;
    }
  } catch {
    result.notes.push('Could not analyze query patterns');
  }

  // Test 3: React optimization
  try {
    const componentFiles = execSync('find src -name "*.tsx" 2>/dev/null || true', { encoding: 'utf-8' });
    let optimizedComponents = 0;
    let totalComponents = 0;
    
    componentFiles.split('\n').forEach(file => {
      if (file && fs.existsSync(file)) {
        totalComponents++;
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('useMemo') || content.includes('useCallback') || content.includes('React.memo')) {
          optimizedComponents++;
        }
      }
    });

    if (totalComponents > 0) {
      const optimizationRate = (optimizedComponents / totalComponents) * 100;
      if (optimizationRate > 30) {
        result.passed.push(`${optimizationRate.toFixed(0)}% components optimized`);
        result.score += 20;
      } else {
        result.warnings.push(`Only ${optimizationRate.toFixed(0)}% components optimized`);
      }
    }
  } catch {
    result.notes.push('Could not analyze React components');
  }

  return result;
}

// 3. KOD KVALITET (20% vikt)
async function analyzeCodeQuality(): Promise<AuditResult> {
  const result: AuditResult = {
    score: 0,
    criticalIssues: [],
    warnings: [],
    passed: [],
    notes: []
  };

  // Test 1: TypeScript strictness
  if (fs.existsSync('tsconfig.json')) {
    const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf-8'));
    if (tsconfig.compilerOptions?.strict === true) {
      result.passed.push('TypeScript strict mode enabled');
      result.score += 30;
    } else {
      result.warnings.push('TypeScript strict mode disabled');
    }
  }

  // Test 2: Count 'any' types
  try {
    const tsFiles = execSync('find . -name "*.ts" -o -name "*.tsx" 2>/dev/null || true', { encoding: 'utf-8' });
    let anyCount = 0;
    tsFiles.split('\n').forEach(file => {
      if (file && fs.existsSync(file) && !file.includes('node_modules')) {
        const content = fs.readFileSync(file, 'utf-8');
        const matches = content.match(/:\s*any\b/g);
        if (matches) anyCount += matches.length;
      }
    });

    if (anyCount === 0) {
      result.passed.push('No "any" types found');
      result.score += 30;
    } else if (anyCount < 10) {
      result.warnings.push(`Found ${anyCount} "any" types`);
      result.score += 15;
    } else {
      result.criticalIssues.push(`Too many "any" types: ${anyCount}`);
    }
  } catch {
    result.notes.push('Could not analyze TypeScript types');
  }

  // Test 3: ESLint
  try {
    const lintResult = execSync('npm run lint 2>&1 || true', { encoding: 'utf-8' });
    if (lintResult.includes('0 errors')) {
      result.passed.push('No ESLint errors');
      result.score += 20;
    } else {
      const errorMatch = lintResult.match(/(\d+) error/);
      if (errorMatch) {
        result.warnings.push(`ESLint: ${errorMatch[1]} errors`);
      }
    }
  } catch {
    result.notes.push('ESLint not configured');
  }

  // Test 4: Test coverage
  if (fs.existsSync('coverage/coverage-summary.json')) {
    const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf-8'));
    const lines = coverage.total?.lines?.pct || 0;
    if (lines > 80) {
      result.passed.push(`Test coverage: ${lines}%`);
      result.score += 20;
    } else if (lines > 50) {
      result.warnings.push(`Low test coverage: ${lines}%`);
      result.score += 10;
    } else {
      result.criticalIssues.push(`Very low test coverage: ${lines}%`);
    }
  } else {
    result.notes.push('No test coverage data available');
  }

  return result;
}

// 4. DATA INTEGRITET (15% vikt)
async function checkDataIntegrity(): Promise<AuditResult> {
  const result: AuditResult = {
    score: 60, // Start med neutral
    criticalIssues: [],
    warnings: [],
    passed: [],
    notes: []
  };

  // Test migration script
  if (fs.existsSync('scripts/v1-to-v2-migration.ts')) {
    try {
      const dryRun = execSync('npm run migrate:v1-to-v2 -- --dry-run 2>&1', { encoding: 'utf-8' });
      if (dryRun.includes('success') || dryRun.includes('complete')) {
        result.passed.push('Migration dry-run successful');
        result.score = 80;
      }
    } catch {
      result.warnings.push('Migration dry-run failed');
      result.score = 40;
    }
  }

  // Check for LocalStorage cleanup
  try {
    const storageFiles = execSync('grep -r "localStorage" src 2>/dev/null || true', { encoding: 'utf-8' });
    if (storageFiles.includes('cleanup') || storageFiles.includes('clear')) {
      result.passed.push('LocalStorage cleanup implemented');
      result.score += 20;
    }
  } catch {
    result.notes.push('Could not check LocalStorage usage');
  }

  return result;
}

// 5. ERROR HANDLING (10% vikt)
async function auditErrorHandling(): Promise<AuditResult> {
  const result: AuditResult = {
    score: 0,
    criticalIssues: [],
    warnings: [],
    passed: [],
    notes: []
  };

  // Count try-catch blocks
  try {
    const codeFiles = execSync('find . -name "*.ts" -o -name "*.tsx" 2>/dev/null || true', { encoding: 'utf-8' });
    let tryCatchCount = 0;
    let asyncFunctionCount = 0;
    
    codeFiles.split('\n').forEach(file => {
      if (file && fs.existsSync(file) && !file.includes('node_modules')) {
        const content = fs.readFileSync(file, 'utf-8');
        tryCatchCount += (content.match(/try\s*{/g) || []).length;
        asyncFunctionCount += (content.match(/async\s+(function|\()/g) || []).length;
      }
    });

    if (asyncFunctionCount > 0) {
      const errorHandlingRate = (tryCatchCount / asyncFunctionCount) * 100;
      if (errorHandlingRate > 50) {
        result.passed.push(`Good error handling: ${errorHandlingRate.toFixed(0)}% async functions protected`);
        result.score = 80;
      } else {
        result.warnings.push(`Poor error handling: only ${errorHandlingRate.toFixed(0)}% async functions protected`);
        result.score = 40;
      }
    }
  } catch {
    result.notes.push('Could not analyze error handling');
  }

  // Check for Error Boundary
  try {
    const errorBoundary = execSync('grep -r "ErrorBoundary" src 2>/dev/null || true', { encoding: 'utf-8' });
    if (errorBoundary) {
      result.passed.push('React ErrorBoundary implemented');
      result.score += 20;
    }
  } catch {
    result.notes.push('Could not check for ErrorBoundary');
  }

  return result;
}

// 6. DEPLOYMENT READINESS (10% vikt)
async function checkDeploymentReadiness(): Promise<AuditResult> {
  const result: AuditResult = {
    score: 0,
    criticalIssues: [],
    warnings: [],
    passed: [],
    notes: []
  };

  // Check build
  try {
    execSync('npm run build', { stdio: 'ignore' });
    result.passed.push('Build successful');
    result.score += 30;
  } catch {
    result.criticalIssues.push('Build failed');
  }

  // Check env setup
  if (fs.existsSync('.env.example')) {
    result.passed.push('Environment variables documented');
    result.score += 20;
  }

  // Check for CI/CD
  if (fs.existsSync('.github/workflows')) {
    result.passed.push('CI/CD configured');
    result.score += 30;
  }

  // Check Docker
  if (fs.existsSync('Dockerfile')) {
    result.passed.push('Docker ready');
    result.score += 20;
  }

  return result;
}

// HUVUD RAPPORT GENERATOR
async function generateCompleteReport() {
  console.log('🔍 Starting Ungdomsstöd V2 System Audit...\n');
  
  // Kör alla audits
  const results = {
    security: await auditSecurity(),
    performance: await analyzePerformance(),
    codeQuality: await analyzeCodeQuality(),
    dataIntegrity: await checkDataIntegrity(),
    errorHandling: await auditErrorHandling(),
    deployment: await checkDeploymentReadiness()
  };
  
  // Beräkna total score med vikter
  const totalScore = Math.round(
    results.security.score * 0.25 +
    results.performance.score * 0.20 +
    results.codeQuality.score * 0.20 +
    results.dataIntegrity.score * 0.15 +
    results.errorHandling.score * 0.10 +
    results.deployment.score * 0.10
  );
  
  // Visa resultat i konsolen
  console.log('═══════════════════════════════════════════════════');
  console.log('     UNGDOMSSTÖD V2 - SYSTEM AUDIT RESULTAT       ');
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log(`📊 TOTAL SCORE: ${getColoredScore(totalScore)}%\n`);
  
  console.log(`🔒 SÄKERHET: ${getColoredScore(results.security.score)}%`);
  console.log(`   ✅ ${results.security.passed.length} passed`);
  console.log(`   ⚠️  ${results.security.warnings.length} warnings`);
  console.log(`   ❌ ${results.security.criticalIssues.length} critical\n`);
  
  console.log(`⚡ PERFORMANCE: ${getColoredScore(results.performance.score)}%`);
  console.log(`   ✅ ${results.performance.passed.length} passed`);
  console.log(`   ⚠️  ${results.performance.warnings.length} warnings\n`);
  
  console.log(`📝 KOD KVALITET: ${getColoredScore(results.codeQuality.score)}%`);
  console.log(`   ✅ ${results.codeQuality.passed.length} passed`);
  console.log(`   ⚠️  ${results.codeQuality.warnings.length} warnings\n`);
  
  // Samla alla kritiska problem
  const allCritical: string[] = [];
  const allWarnings: string[] = [];
  
  Object.values(results).forEach(r => {
    allCritical.push(...r.criticalIssues);
    allWarnings.push(...r.warnings);
  });
  
  if (allCritical.length > 0) {
    console.log('❌ KRITISKA PROBLEM:');
    allCritical.forEach(issue => console.log(`   - ${issue}`));
    console.log('');
  }
  
  if (allWarnings.length > 0 && allWarnings.length <= 5) {
    console.log('⚠️  TOP VARNINGAR:');
    allWarnings.slice(0, 5).forEach(warning => console.log(`   - ${warning}`));
    console.log('');
  }
  
  // Production readiness
  console.log('═══════════════════════════════════════════════════');
  if (totalScore >= 80) {
    console.log('✅ SYSTEMET ÄR REDO FÖR PRODUKTION');
  } else if (totalScore >= 60) {
    console.log('⚠️  KAN DEPLOYAS MED FÖRSIKTIGHET');
  } else {
    console.log('❌ INTE REDO FÖR PRODUKTION');
  }
  console.log('═══════════════════════════════════════════════════\n');
  
  // Spara JSON rapport
  const report = {
    timestamp: new Date().toISOString(),
    totalScore,
    results,
    criticalIssues: allCritical,
    warnings: allWarnings,
    productionReady: totalScore >= 80
  };
  
  fs.writeFileSync('audit-report.json', JSON.stringify(report, null, 2));
  console.log('📄 Detaljerad rapport sparad: audit-report.json');
  
  // Generera HTML dashboard
  generateHTMLDashboard(report);
  console.log('📊 HTML Dashboard genererad: audit-dashboard.html');
}

function getColoredScore(score: number): string {
  if (score >= 80) return `\x1b[32m${score}\x1b[0m`; // Green
  if (score >= 60) return `\x1b[33m${score}\x1b[0m`; // Yellow
  return `\x1b[31m${score}\x1b[0m`; // Red
}

function generateHTMLDashboard(report: AuditReport) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Ungdomsstöd V2 - Audit Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
    .score-card { display: inline-block; padding: 20px; margin: 10px; border-radius: 8px; text-align: center; min-width: 150px; }
    .score-high { background: #d4edda; color: #155724; }
    .score-medium { background: #fff3cd; color: #856404; }
    .score-low { background: #f8d7da; color: #721c24; }
    .score-number { font-size: 48px; font-weight: bold; }
    .score-label { font-size: 14px; text-transform: uppercase; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    .passed { color: #28a745; }
    .warning { color: #ffc107; }
    .critical { color: #dc3545; }
    .timestamp { color: #6c757d; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Ungdomsstöd V2 - System Audit Dashboard</h1>
    <p class="timestamp">Generated: ${report.timestamp}</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <div class="score-card ${report.totalScore >= 80 ? 'score-high' : report.totalScore >= 60 ? 'score-medium' : 'score-low'}">
        <div class="score-number">${report.totalScore}%</div>
        <div class="score-label">Total Score</div>
      </div>
    </div>
    
    <h2>📊 Delresultat</h2>
    <table>
      <thead>
        <tr>
          <th>Kategori</th>
          <th>Score</th>
          <th>✅ Passed</th>
          <th>⚠️ Warnings</th>
          <th>❌ Critical</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(report.results).map(([key, value]: [string, AuditResult]) => `
          <tr>
            <td>${key.charAt(0).toUpperCase() + key.slice(1)}</td>
            <td><strong>${value.score}%</strong></td>
            <td class="passed">${value.passed.length}</td>
            <td class="warning">${value.warnings.length}</td>
            <td class="critical">${value.criticalIssues.length}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    ${report.criticalIssues.length > 0 ? `
      <h2>❌ Kritiska Problem</h2>
      <ul>
        ${report.criticalIssues.map((issue: string) => `<li>${issue}</li>`).join('')}
      </ul>
    ` : ''}
    
    <h2>📈 Production Readiness</h2>
    <p style="font-size: 24px; font-weight: bold; color: ${report.productionReady ? '#28a745' : '#dc3545'}">
      ${report.productionReady ? '✅ Ready for Production' : '❌ Not Ready for Production'}
    </p>
  </div>
</body>
</html>`;
  
  fs.writeFileSync('audit-dashboard.html', html);
}

// Kör audit
generateCompleteReport().catch(console.error);
