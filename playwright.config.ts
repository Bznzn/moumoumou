import{defineConfig}from'@playwright/test';
export default defineConfig({testDir:'tests/e2e',workers:1,timeout:60000,reporter:'list',outputDir:'.superpowers/sdd/2026-11-04-salary-float/e2e-results',use:{trace:'retain-on-failure'}});
