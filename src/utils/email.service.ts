import nodemailer, { Transporter } from "nodemailer";
import { AppError } from "./apiResponse";

/**
 * Interface for OTP Email options when passed as a structured object
 */
export interface SendOtpEmailOptions {
  to: string;
  otp: string;
  recipientName?: string;
}

/**
 * Check if real SMTP credentials are configured or using placeholders
 */
export const isSmtpConfigured = (): boolean => {
  const pass = (process.env.SMTP_PASS || "").trim();
  const user = (process.env.SMTP_USER || "").trim();

  if (!pass || !user) return false;
  if (
    pass === "your_google_app_password_here" ||
    pass === "your_google_app_password" ||
    pass.includes("your_google_app") ||
    pass.length < 8
  ) {
    return false;
  }
  return true;
};

/**
 * Reusable Singleton Transporter Holder
 */
let transporterInstance: Transporter | null = null;

/**
 * Get or initialize the reusable Nodemailer SMTP transporter.
 * Configured for Port 587 (STARTTLS) to prevent cloud firewall blocking on Render/AWS.
 */
export const getEmailTransporter = (): Transporter => {
  if (transporterInstance) {
    return transporterInstance;
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  // Port 587 is the cloud-standard port for STARTTLS (bypasses outbound port 465 blocks on Render/AWS)
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  // Port 587 requires secure: false; Port 465 requires secure: true
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  const user = (process.env.SMTP_USER || "testingrvg@gmail.com").trim();
  const pass = (process.env.SMTP_PASS || "").trim();

  if (!isSmtpConfigured()) {
    console.warn(
      `[EmailService] ⚠️ Notice: SMTP_PASS is unconfigured or using a default placeholder. ` +
      `Email dispatch will operate in graceful SIMULATION mode so API calls never hang. ` +
      `Configure a 16-character Google App Password in SMTP_PASS to enable live delivery.`
    );
  }

  transporterInstance = nodemailer.createTransport({
    host,
    port,
    secure, // false for port 587 (STARTTLS), true for port 465 (SSL)
    auth: {
      user,
      pass,
    },
    // Non-blocking timeouts: fail fast instead of hanging indefinitely on cloud platforms
    connectionTimeout: 8000, // 8s connection timeout
    greetingTimeout: 5000,   // 5s greeting timeout
    socketTimeout: 10000,    // 10s socket timeout
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    tls: {
      // Prevents SSL/TLS handshake failures across containerized cloud proxies
      rejectUnauthorized: false,
    },
  });

  // Safe, non-blocking startup diagnostic check
  if (isSmtpConfigured()) {
    transporterInstance.verify((error) => {
      if (error) {
        console.warn(`[EmailService] ⚠️ Startup SMTP check on ${host}:${port}: ${error.message}`);
      } else {
        console.info(`✅ [EmailService] Startup SMTP transporter verified on ${host}:${port} (STARTTLS ready).`);
      }
    });
  }

  return transporterInstance;
};

/**
 * Optional helper to verify SMTP transporter connection on demand
 */
export const verifyTransporterConnection = async (): Promise<boolean> => {
  if (!isSmtpConfigured()) {
    console.info(
      "[EmailService] ℹ️ SMTP credentials are unconfigured or using placeholders. " +
      "Live SMTP verification skipped; running in simulated fallback mode."
    );
    return false;
  }

  try {
    const transporter = getEmailTransporter();
    await transporter.verify();
    console.info("✅ [EmailService] SMTP transporter verified and ready to dispatch messages.");
    return true;
  } catch (err: any) {
    console.error("❌ [EmailService] Transporter verification failed:", err?.message || err);
    console.warn(
      "[EmailService] ⚠️ Emails may fail to dispatch until valid SMTP settings (Google App Password) are provided."
    );
    return false;
  }
};

/**
 * Generate luxury Imperial Obsidian branded HTML email template
 */
export const generateOtpEmailHtml = (otpCode: string, recipientName?: string): string => {
  const name = recipientName ? recipientName.trim() : "Valued Resident";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AURA Security Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f15; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f15; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #131922; border: 1px solid #242e3e; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.75);">
          
          <!-- Top Metallic Gold Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #b8860b 0%, #e6b74a 50%, #f3cd7e 75%, #b8860b 100%);"></td>
          </tr>

          <!-- Society Sphere / AURA Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center;">
              <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 16px; background-color: #1a2230; border: 1px solid rgba(230, 183, 74, 0.4); text-align: center; margin-bottom: 16px; box-shadow: 0 0 20px rgba(230, 183, 74, 0.15);">
                <span style="font-size: 26px; color: #e6b74a; font-weight: bold;">✦</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 3px;">
                AURA <span style="font-weight: 300; color: #94a3b8; font-size: 18px;">| SocietySphere</span>
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 700; color: #e6b74a; letter-spacing: 3px; text-transform: uppercase;">
                Imperial Obsidian Residence Network
              </p>
            </td>
          </tr>

          <!-- Subtle Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="height: 1px; background-color: #242e3e;"></div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 36px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
                Authentication Verification
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #94a3b8;">
                Greetings, <strong style="color: #f8fafc;">${name}</strong>. A verification request was initiated for your residence account. Use the one-time passcode below to verify your identity:
              </p>

              <!-- High-Contrast 6-Digit Monospace Highlight Box -->
              <div style="background-color: #0b0f15; border: 2px solid #e6b74a; border-radius: 16px; padding: 26px 16px; text-align: center; margin: 28px 0; box-shadow: 0 0 30px rgba(230, 183, 74, 0.2);">
                <div style="font-size: 11px; font-weight: 800; color: #a1a1aa; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 12px;">
                  Your 6-Digit Verification Code
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 900; letter-spacing: 12px; color: #f3cd7e; padding-left: 12px;">
                  ${otpCode}
                </div>
              </div>

              <!-- 10-Minute Validity Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="background-color: #1a2230; border: 1px solid #2d394e; border-radius: 12px; padding: 14px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="28" valign="top" style="font-size: 18px; line-height: 1;">⏱</td>
                        <td style="font-size: 13px; color: #cbd5e1; line-height: 20px; padding-left: 8px;">
                          This code will expire in <strong style="color: #e6b74a;">10 minutes</strong>. Once expired, you will need to request a new verification code.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Disclaimer -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px; padding: 14px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="28" valign="top" style="font-size: 18px; line-height: 1;">🔒</td>
                        <td style="font-size: 12px; color: #fca5a5; line-height: 18px; padding-left: 8px;">
                          <strong>Security Disclaimer:</strong> If you did not request this OTP, please ignore this email. AURA staff and security personnel will never ask for your verification passcode.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0b0f15; padding: 24px 36px; border-top: 1px solid #1a2230; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 18px;">
                &copy; 2026 SocietySphere / AURA Technologies. All rights reserved.<br>
                Enterprise Society Operations & Access Governance Infrastructure.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Dispatch 6-digit OTP code to recipient's email address
 *
 * Supports both signatures:
 * 1. sendOtpEmail("resident@example.com", "123456", "John Doe")
 * 2. sendOtpEmail({ to: "resident@example.com", otp: "123456", recipientName: "John Doe" })
 *
 * Guarantees:
 * - Gracefully simulated if SMTP credentials are missing/placeholder (never hangs).
 * - Enforces a 4.5-second timeout on live SMTP dispatch to prevent hanging cloud connections.
 */
export async function sendOtpEmail(
  toEmailOrOptions: string | SendOtpEmailOptions,
  otpCode?: string,
  recipientName?: string
): Promise<boolean> {
  let to: string;
  let code: string;
  let name: string | undefined;

  if (typeof toEmailOrOptions === "object" && toEmailOrOptions !== null) {
    to = toEmailOrOptions.to;
    code = toEmailOrOptions.otp;
    name = toEmailOrOptions.recipientName;
  } else {
    to = toEmailOrOptions;
    code = otpCode || "";
    name = recipientName;
  }

  if (!to || !code) {
    throw new AppError(400, "Recipient email and OTP code are required for email dispatch.");
  }

  const cleanEmail = to.trim().toLowerCase();

  // 1. Graceful fallback if SMTP credentials are placeholder or unconfigured
  // This guarantees the API NEVER hangs or times out in preview / testing environments
  if (!isSmtpConfigured()) {
    console.warn(
      `[EmailService] ⚠️ SIMULATION MODE: SMTP credentials not properly configured. ` +
      `Simulated OTP [${code}] dispatched to ${cleanEmail}. ` +
      `To send live emails, set a valid 16-character Google App Password in SMTP_PASS.`
    );
    return true;
  }

  const transporter = getEmailTransporter();

  const fromAddress =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    `"AURA Society" <${process.env.SMTP_USER || "testingrvg@gmail.com"}>`;

  const htmlContent = generateOtpEmailHtml(code, name);
  const textContent =
    `Your AURA verification passcode is: ${code}\n\n` +
    `This code will expire in 10 minutes.\n` +
    `If you did not request this OTP, please ignore this email. AURA staff will never ask for your verification code.`;

  try {
    // 2. Fail-safe timeout wrapper (4500ms) ensuring dispatch never stalls past 5 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Email dispatch timed out after 4500ms"));
      }, 4500);
      if (typeof timer.unref === "function") timer.unref();
    });

    const sendPromise = transporter.sendMail({
      from: fromAddress,
      to: cleanEmail,
      subject: `${code} is your AURA Verification Passcode`,
      text: textContent,
      html: htmlContent,
    });

    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.info(`[EmailService] Real OTP email delivered to ${cleanEmail}. MessageId: ${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error(`[EmailService] Failed to send email to ${cleanEmail}:`, err?.message || err);
    throw new AppError(
      500,
      `Failed to deliver verification code: ${err?.message || "Email dispatch failed."}`
    );
  }
}

/**
 * Class-based wrapper for backwards-compatibility
 */
export class EmailService {
  public async sendOtpEmail(
    toEmailOrOptions: string | SendOtpEmailOptions,
    otpCode?: string,
    recipientName?: string
  ): Promise<boolean> {
    return sendOtpEmail(toEmailOrOptions, otpCode, recipientName);
  }
}

export const emailService = new EmailService();
export default emailService;
