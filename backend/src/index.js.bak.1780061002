require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
const normalizeOrigin = (value) => value?.trim().replace(/\/$/, "");
const defaultOrigins = [
  "https://travelagencyweb.com",
  "https://www.travelagencyweb.com",
  "https://app.travelagencyweb.com",
  "https://portal.travelagencyweb.com",
  "http://localhost:5173",
];
const allowedOrigins = (process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : defaultOrigins
).map(normalizeOrigin);

const isTravelAgencyWebOrigin = (origin) => {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "https:" && (
      hostname === "travelagencyweb.com" || hostname.endsWith(".travelagencyweb.com")
    );
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    const requestOrigin = normalizeOrigin(origin);
    if (
      !requestOrigin ||
      allowedOrigins.includes("*") ||
      allowedOrigins.includes(requestOrigin) ||
      isTravelAgencyWebOrigin(requestOrigin)
    ) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/tenants", require("./routes/tenants"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/clients", require("./routes/clients"));
app.use("/api/agents", require("./routes/crud")("agent"));
app.use("/api/vendors", require("./routes/vendors"));
app.use("/api/leads", require("./routes/leads"));
app.use("/api/tasks", require("./routes/crud")("task"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/quotations", require("./routes/quotations"));
app.use("/api/accounts", require("./routes/accounts"));
app.use("/api/transactions", require("./routes/crud")("transaction"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/hajj", require("./routes/hajj"));
app.use("/api/subscriptions", require("./routes/crud")("subscription"));
// Payment requests — dedicated tenant-isolated route (replaces generic CRUD)
app.use("/api/payment-requests", require("./routes/paymentRequests"));
app.use("/api/audit-logs", require("./routes/auditLogs"));

// Admin routes
app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin/domains", require("./routes/domains"));

// Public form routes (no auth)
app.use("/api/contact", require("./routes/contact"));
app.use("/api/demo-requests", require("./routes/demo"));
app.use("/api/public", require("./routes/public"));

// Customer / Supplier portal (separate JWT audience)
app.use("/api/portal", require("./routes/portal"));

// Email routes (authenticated)
app.use("/api/email", require("./routes/email"));

// Cron routes (protected by CRON_SECRET, not JWT)
app.use("/api/cron", require("./routes/cron"));

// Health check
app.get("/api/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`✅ TAWSS API running on port ${PORT}`));
