import axios from "axios";

/**
 * Sanitize mobile number to extract clean 10-digit Indian mobile number
 * Strips '+91', leading '91' country prefix (when 12 digits), spaces, and dashes.
 */
export const sanitizeMobileNumber = (mobileNumber: string): string => {
  const trimmed = (mobileNumber || "").trim();
  // Strip '+91', spaces, and dashes first
  let cleaned = trimmed
    .replace(/^\+91[\s-]*/, "")
    .replace(/[\s-]/g, "")
    .replace(/\D/g, "");

  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    cleaned = cleaned.slice(2);
  }

  cleaned = cleaned.replace(/^0+/, "");

  return cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
};

/**
 * Ensure console.log output is flushed immediately to process.stdout
 * so container log collectors (such as Render) capture OTP logs without buffering delays.
 */
export const flushStdout = (): void => {
  try {
    if (
      process.stdout &&
      typeof (process.stdout as any)._handle?.setBlocking === "function"
    ) {
      (process.stdout as any)._handle.setBlocking(true);
    }
    if (process.stdout && typeof process.stdout.write === "function") {
      process.stdout.write("");
    }
  } catch {
    // Ignore stdout handle errors in non-standard environments
  }
};

/**
 * Send 6-digit OTP to Indian mobile number via Fast2SMS Quick Route (route = 'q')
 *
 * - Always prints formatted fallback OTP log to terminal for local development & testing.
 * - Never throws 500 error or crashes on Fast2SMS API error / insufficient wallet balance;
 *   returns true so frontend verification flow never gets blocked.
 */
export async function sendMobileOtp(
  mobileNumber: string,
  otpCode: string
): Promise<boolean> {
  const cleanMobile = String(mobileNumber || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .slice(-10) || sanitizeMobileNumber(mobileNumber);

  // Force immediate output via process.stdout.write in normal attempt block
  const attemptBanner = `\n========================================\n[FALLBACK OTP LOG]\nDestination: ${cleanMobile}\nOTP: >>> ${otpCode} <<<\nTimestamp: ${new Date().toISOString()}\n========================================\n`;
  process.stdout.write(attemptBanner);
  console.log(attemptBanner);
  flushStdout();

  try {
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      const noKeyLog = `\n[Fast2SMS Notice] FAST2SMS_API_KEY is not configured. Using terminal fallback OTP for ${cleanMobile}: >>> ${otpCode} <<<\n`;
      process.stdout.write(noKeyLog);
      console.warn(noKeyLog);
      flushStdout();
      return true;
    }

    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "q",
        message: `Your SocietySphere verification code is ${otpCode}. Valid for 10 minutes.`,
        language: "english",
        flash: 0,
        numbers: cleanMobile,
      },
      {
        headers: {
          authorization: apiKey,
        },
        timeout: 15000,
      }
    );

    if (response?.data?.return === false) {
      const rejectLog = `\n[Fast2SMS Warning] Provider rejected SMS dispatch (${JSON.stringify(
        response.data?.message || response.data
      )}). Terminal fallback OTP for ${cleanMobile}: >>> ${otpCode} <<<\n`;
      process.stdout.write(rejectLog);
      console.warn(rejectLog);
      flushStdout();
      return true;
    }

    const successLog = `\n[Fast2SMS Dispatch Success] Destination: ${cleanMobile} | OTP: >>> ${otpCode} <<< | Request ID: ${
      response?.data?.request_id || "OK"
    }\n`;
    process.stdout.write(successLog);
    console.log(successLog);
    flushStdout();
    return true;
  } catch (error: any) {
    const errDetails =
      error?.response?.data?.message ||
      error?.response?.data ||
      error?.message ||
      error;
    const catchFallbackBanner = `\n========================================\n[Fast2SMS Fallback Notice] SMS gateway error or insufficient balance.\nDestination: ${cleanMobile}\nFallback OTP: >>> ${otpCode} <<<\nError: ${
      typeof errDetails === "string" ? errDetails : JSON.stringify(errDetails)
    }\nTimestamp: ${new Date().toISOString()}\n========================================\n`;
    process.stdout.write(catchFallbackBanner);
    console.warn(catchFallbackBanner);
    flushStdout();
    // Do NOT throw 500 error or crash; return true so frontend verification flow is not blocked
    return true;
  }
}

export class SmsService {
  public async sendMobileOtp(
    mobileNumber: string,
    otpCode: string
  ): Promise<boolean> {
    return sendMobileOtp(mobileNumber, otpCode);
  }
}

export const smsService = new SmsService();
export default smsService;

