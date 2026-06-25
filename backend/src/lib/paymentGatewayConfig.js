/**
 * Platform payment gateway + manual MFS/bank receiver config (env-driven).
 */

function env(key, fallback = "") {
  return String(process.env[key] || fallback).trim();
}

function isBkashOnlineConfigured() {
  return Boolean(
    env("BKASH_APP_KEY") &&
    env("BKASH_APP_SECRET") &&
    env("BKASH_USERNAME") &&
    env("BKASH_PASSWORD"),
  );
}

function isSslcommerzConfigured() {
  return Boolean(env("SSLCOMMERZ_STORE_ID") && env("SSLCOMMERZ_STORE_PASSWORD"));
}

function getGatewayStatus() {
  return {
    bkash: {
      configured: isBkashOnlineConfigured(),
      sandbox: env("BKASH_SANDBOX", "true") !== "false",
      mode: isBkashOnlineConfigured()
        ? (env("BKASH_SANDBOX", "true") !== "false" ? "sandbox" : "live")
        : "disabled",
    },
    sslcommerz: {
      configured: isSslcommerzConfigured(),
      sandbox: env("SSLCOMMERZ_SANDBOX", "true") !== "false",
      mode: isSslcommerzConfigured()
        ? (env("SSLCOMMERZ_SANDBOX", "true") !== "false" ? "sandbox" : "live")
        : "disabled",
    },
    manual: {
      configured: getDefaultManualPaymentMethods().some((m) => m.enabled && m.accountNumber),
      methodsEnabled: getDefaultManualPaymentMethods().filter((m) => m.enabled && m.accountNumber).length,
    },
  };
}

function getGatewayStatusDetailed() {
  const apiBase = env("API_BASE_URL") || `http://localhost:${process.env.PORT || 4000}/api`;
  const status = getGatewayStatus();
  return {
    ...status,
    apiBaseUrl: apiBase,
    callbacks: {
      sslcommerz: {
        success: `${apiBase}/payments/sslcommerz/success`,
        fail: `${apiBase}/payments/sslcommerz/fail`,
        cancel: `${apiBase}/payments/sslcommerz/cancel`,
        ipn: `${apiBase}/payments/sslcommerz/ipn`,
      },
      bkash: {
        callback: `${apiBase}/payments/bkash/callback`,
      },
    },
    manualMethods: getDefaultManualPaymentMethods().map((m) => ({
      methodCode: m.methodCode,
      label: m.label,
      enabled: m.enabled,
      hasAccount: Boolean(m.accountNumber),
    })),
  };
}

/** Manual proof payment receivers (bKash send-money number, bank, etc.) */
function getDefaultManualPaymentMethods() {
  const methods = [
    {
      methodCode: "bkash",
      label: "bKash",
      sortOrder: 1,
      accountName: env("BKASH_ACCOUNT_NAME"),
      accountNumber: env("BKASH_ACCOUNT_NUMBER"),
      bankName: null,
      branchName: null,
      instructions: env(
        "BKASH_INSTRUCTIONS",
        "Send money to this bKash number from your account, then submit the transaction ID.",
      ),
    },
    {
      methodCode: "nagad",
      label: "Nagad",
      sortOrder: 2,
      accountName: env("NAGAD_ACCOUNT_NAME"),
      accountNumber: env("NAGAD_ACCOUNT_NUMBER"),
      bankName: null,
      branchName: null,
      instructions: env(
        "NAGAD_INSTRUCTIONS",
        "Send money to this Nagad number from your account, then submit the transaction ID.",
      ),
    },
    {
      methodCode: "rocket",
      label: "Rocket",
      sortOrder: 3,
      accountName: env("ROCKET_ACCOUNT_NAME"),
      accountNumber: env("ROCKET_ACCOUNT_NUMBER"),
      bankName: null,
      branchName: null,
      instructions: env(
        "ROCKET_INSTRUCTIONS",
        "Send money to this Rocket number from your account, then submit the transaction ID.",
      ),
    },
    {
      methodCode: "bank_transfer",
      label: "Bank Transfer",
      sortOrder: 4,
      accountName: env("BANK_ACCOUNT_NAME"),
      accountNumber: env("BANK_ACCOUNT_NUMBER"),
      bankName: env("BANK_NAME") || null,
      branchName: env("BANK_BRANCH") || null,
      instructions: env(
        "BANK_TRANSFER_INSTRUCTIONS",
        "Transfer to the bank account below and submit the transfer reference number.",
      ),
    },
  ];

  return methods.map((m) => ({
    ...m,
    enabled: Boolean(m.accountNumber),
  }));
}

function isOnlinePaymentMethod(methodCode) {
  return String(methodCode || "").startsWith("online_");
}

module.exports = {
  getGatewayStatus,
  getGatewayStatusDetailed,
  getDefaultManualPaymentMethods,
  isBkashOnlineConfigured,
  isSslcommerzConfigured,
  isOnlinePaymentMethod,
};
