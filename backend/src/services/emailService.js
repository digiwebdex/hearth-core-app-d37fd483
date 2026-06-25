/**
 * Centralized SMTP email service using nodemailer.
 * All email sending goes through this module.
 * If SMTP is not configured, emails are logged to console.
 */
const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

function getFrom() {
  return process.env.SMTP_FROM || "noreply@travelagencyweb.com";
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || "https://travelagencyweb.com";
}

/**
 * Send an email. Falls back to console.log if SMTP not configured.
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 * @returns {Promise<boolean>} true if sent, false if logged only
 */
async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (t) {
    try {
      await t.sendMail({ from: getFrom(), to, subject, html, text });
      return true;
    } catch (err) {
      console.error("[EMAIL] Send error:", err.message);
      return false;
    }
  }
  console.log(`[EMAIL-LOG] To: ${to} | Subject: ${subject}`);
  console.log(`[EMAIL-LOG] Body: ${text || html.substring(0, 200)}`);
  return false;
}

// ── Pre-built email templates ──

async function sendPasswordReset(email, resetToken) {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${resetToken}`;
  return sendEmail({
    to: email,
    subject: "Password Reset - Travel Agency Web",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Password Reset Request</h2>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <p style="margin:30px 0;">
          <a href="${resetUrl}" style="background:#3b82f6;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;display:inline-block;">
            Reset Password
          </a>
        </p>
        <p style="color:#666;font-size:14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #eee;" />
        <p style="color:#999;font-size:12px;">Travel Agency Website & Software Solution</p>
      </div>
    `,
    text: `Reset your password: ${resetUrl} (expires in 1 hour)`,
  });
}

async function sendDemoRequestConfirmation(data) {
  return sendEmail({
    to: data.email,
    subject: "Demo Request Received - Travel Agency Web",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Thank You, ${data.name}!</h2>
        <p>We've received your demo request. Our team will contact you within 24 hours to schedule a personalized walkthrough.</p>
        <p><strong>Company:</strong> ${data.company || "N/A"}<br/>
        <strong>Team size:</strong> ${data.teamSize || "N/A"}</p>
        <p>In the meantime, feel free to explore our features at <a href="${getFrontendUrl()}/features">${getFrontendUrl()}/features</a>.</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #eee;" />
        <p style="color:#999;font-size:12px;">Travel Agency Website & Software Solution</p>
      </div>
    `,
  });
}

async function sendDemoRequestNotification(data) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;
  return sendEmail({
    to: adminEmail,
    subject: `New Demo Request from ${data.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px;">
        <h3>New Demo Request</h3>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone || "N/A"}</p>
        <p><strong>Company:</strong> ${data.company || "N/A"}</p>
        <p><strong>Team Size:</strong> ${data.teamSize || "N/A"}</p>
        <p><strong>Message:</strong> ${data.message || "N/A"}</p>
      </div>
    `,
  });
}

async function sendContactConfirmation(data) {
  return sendEmail({
    to: data.email,
    subject: "We Received Your Message - Travel Agency Web",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Thank You, ${data.name}!</h2>
        <p>We've received your message and will respond within 24 hours.</p>
        <p style="color:#666;"><strong>Subject:</strong> ${data.subject || "General inquiry"}</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #eee;" />
        <p style="color:#999;font-size:12px;">Travel Agency Website & Software Solution</p>
      </div>
    `,
  });
}

async function sendContactNotification(data) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;
  return sendEmail({
    to: adminEmail,
    subject: `New Contact Form: ${data.subject || "General"}`,
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px;">
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone || "N/A"}</p>
        <p><strong>Subject:</strong> ${data.subject || "N/A"}</p>
        <p><strong>Message:</strong> ${data.message}</p>
        ${data.tenantSlug ? `<p><strong>Tenant:</strong> ${data.tenantSlug}</p>` : ""}
      </div>
    `,
  });
}

async function sendBookingConfirmation(booking, clientEmail) {
  return sendEmail({
    to: clientEmail,
    subject: `Booking Confirmed: ${booking.title || booking.destination || "Your Trip"}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Booking Confirmation</h2>
        <p>Your booking has been confirmed!</p>
        <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
          <p><strong>Destination:</strong> ${booking.destination || "N/A"}</p>
          <p><strong>Travel Date:</strong> ${booking.travelDateFrom || "TBD"}</p>
          <p><strong>Travelers:</strong> ${booking.travelerCount || "N/A"}</p>
        </div>
        <hr style="margin-top:30px;border:none;border-top:1px solid #eee;" />
        <p style="color:#999;font-size:12px;">Travel Agency Website & Software Solution</p>
      </div>
    `,
  });
}

async function sendInvoiceEmail(invoice, clientEmail) {
  return sendEmail({
    to: clientEmail,
    subject: `Invoice ${invoice.invoiceNumber || ""} - Payment Due`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Invoice</h2>
        <p>Please find your invoice details below:</p>
        <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
          <p><strong>Invoice #:</strong> ${invoice.invoiceNumber || "N/A"}</p>
          <p><strong>Total Amount:</strong> ৳${invoice.totalAmount?.toLocaleString() || "0"}</p>
          <p><strong>Due Amount:</strong> ৳${invoice.dueAmount?.toLocaleString() || "0"}</p>
          <p><strong>Due Date:</strong> ${invoice.dueDate || "N/A"}</p>
        </div>
        <hr style="margin-top:30px;border:none;border-top:1px solid #eee;" />
        <p style="color:#999;font-size:12px;">Travel Agency Website & Software Solution</p>
      </div>
    `,
  });
}

// SMTP config management (for tenant settings UI)
async function testSmtpConnection(config) {
  try {
    const t = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port || "587"),
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
    await t.verify();
    return { success: true, message: "SMTP connection successful" };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function sendEmailVerification(email, name, token) {
  const { getTrialDays } = require("../lib/trialConfig");
  const trialDays = getTrialDays();
  const verifyUrl = `${getFrontendUrl()}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    subject: "Verify your email — Travel Agency Web",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Welcome${name ? `, ${name}` : ""}!</h2>
        <p>Please confirm your email address to activate full access to your ${trialDays}-day Pro trial.</p>
        <p style="margin:30px 0;">
          <a href="${verifyUrl}" style="background:#3b82f6;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;display:inline-block;">
            Verify Email
          </a>
        </p>
        <p style="color:#666;font-size:14px;">Or copy this link: <br/><span style="color:#3b82f6">${verifyUrl}</span></p>
        <p style="color:#666;font-size:13px;">This link expires in 24 hours.</p>
        <hr style="margin-top:30px;border:none;border-top:1px solid #eee;" />
        <p style="color:#999;font-size:12px;">Travel Agency Website & Software Solution</p>
      </div>
    `,
    text: `Verify your email: ${verifyUrl} (expires in 24 hours)`,
  });
}

module.exports = {
  sendEmail,
  sendPasswordReset,
  sendEmailVerification,
  sendDemoRequestConfirmation,
  sendDemoRequestNotification,
  sendContactConfirmation,
  sendContactNotification,
  sendBookingConfirmation,
  sendInvoiceEmail,
  testSmtpConnection,
};
