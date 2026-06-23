#!/usr/bin/env node
/**
 * Full agency bootstrap: services + demo packages for a tenant slug.
 * Usage: node scripts/bootstrap-tenant.js [tenant-slug]
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { execSync } = require("child_process");
const path = require("path");

const slug = process.argv[2] || "true-end-travels";
const scriptsDir = __dirname;

function run(script, args = "") {
  const cmd = `node ${path.join(scriptsDir, script)} ${args}`.trim();
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: path.join(scriptsDir, "..") });
}

async function main() {
  console.log(`Bootstrapping tenant: ${slug}`);
  run("provision-full-services-tenant.js", slug);
  run("seed-demo-packages.js", slug);
  console.log("\nBootstrap complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
