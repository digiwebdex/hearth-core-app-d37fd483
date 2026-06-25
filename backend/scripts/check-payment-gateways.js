#!/usr/bin/env node
/**
 * Quick check: which payment gateways are configured in .env
 * Usage: node scripts/check-payment-gateways.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { getGatewayStatusDetailed } = require("../src/lib/paymentGatewayConfig");

const s = getGatewayStatusDetailed();
console.log("Payment gateway status\n");
console.log("  SSLCommerz:", s.sslcommerz.configured ? s.sslcommerz.mode : "not configured");
console.log("  bKash:     ", s.bkash.configured ? s.bkash.mode : "not configured");
console.log("  Manual:    ", s.manual.methodsEnabled, "method(s) with account numbers");
console.log("\nCallbacks:");
console.log("  bKash:    ", s.callbacks.bkash.callback);
console.log("  SSL IPN:  ", s.callbacks.sslcommerz.ipn);
if (s.manualMethods?.length) {
  console.log("\nManual methods:");
  for (const m of s.manualMethods) {
    console.log(`  - ${m.label}: ${m.enabled && m.hasAccount ? "ready" : "missing account"}`);
  }
}
