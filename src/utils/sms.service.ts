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
  const cleanMobile = sanitizeMobileNumber(mobileNumber);

  // Always log formatted fallback message to terminal
  console.log(
    "\n[FALLBACK OTP LOG] Destination:",
    cleanMobile,
    "| OTP: >>>",
    otpCode,
    "<<<\n"
  );

  try {
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      console.warn(
        "[Fast2SMS Notice] FAST2SMS_API_KEY is not configured. Proceeding with terminal fallback OTP."
      );
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
      console.warn(
        "[Fast2SMS Warning] Provider rejected SMS dispatch:",
        response.data?.message || response.data
      );
      return true;
    }

    console.log(
      "[Fast2SMS Dispatch Success] Request ID:",
      response?.data?.request_id || "OK"
    );
    return true;
  } catch (error: any) {
    const errDetails =
      error?.response?.data?.message ||
      error?.response?.data ||
      error?.message ||
      error;
    console.warn(
      "[Fast2SMS Fallback Notice] SMS gateway error or insufficient balance (continuing with fallback OTP):",
      errDetails
    );
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

