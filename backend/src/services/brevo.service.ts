import { env } from "../config/env";
import { AppError } from "../utils/errors";

interface SendOtpEmailInput {
  email: string;
  otp: string;
  expiresInMinutes: number;
  purpose: "email_verification" | "email_change" | "admin_login" | "password_reset";
}

const subjectByPurpose: Record<SendOtpEmailInput["purpose"], string> = {
  email_verification: "Verify your Bondera account",
  email_change: "Verify your new Bondera email",
  admin_login: "Your Bondera admin login code",
  password_reset: "Reset your Bondera password"
};

export const sendOtpEmail = async ({
  email,
  otp,
  expiresInMinutes,
  purpose
}: SendOtpEmailInput): Promise<void> => {
  let response: Response;

  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          email: env.BREVO_SENDER_EMAIL,
          name: env.BREVO_SENDER_NAME
        },
        to: [{ email }],
        subject: subjectByPurpose[purpose],
        htmlContent: `
          <div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">
            <h2 style="margin-bottom:12px">Bondera verification</h2>
            <p>Use this one-time code to continue:</p>
            <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:20px 0">${otp}</p>
            <p>This code expires in ${expiresInMinutes} minutes. Do not share it with anyone.</p>
          </div>
        `
      })
    });
  } catch {
    throw new AppError(
      502,
      "EMAIL_PROVIDER_UNAVAILABLE",
      "Verification email could not be sent. Please try again."
    );
  }

  if (!response.ok) {
    throw new AppError(
      502,
      "EMAIL_DELIVERY_FAILED",
      "Verification email could not be delivered. Please try again."
    );
  }
};
