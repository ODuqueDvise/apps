import { BaseError } from "../../../errors";
import { createLogger } from "../../../logger";
import { type SmtpEncryptionType } from "../configuration/smtp-config-schema";

export interface SendMailArgs {
  smtpSettings: {
    host: string;
    port: number;
    auth?: {
      user: string;
      pass: string | undefined;
    };
    encryption: SmtpEncryptionType;
  };
  mailData: {
    from: string;
    to: string;
    text: string;
    html: string;
    subject: string;
    headers?: Record<string, string>;
  };
}

export interface ISMTPEmailSender {
  sendEmailWithSmtp({ smtpSettings, mailData }: SendMailArgs): Promise<{ response: unknown }>;
}

export class SmtpEmailSender implements ISMTPEmailSender {
  private logger = createLogger("SmtpEmailSender");

  static SmtpEmailSenderError = BaseError.subclass("SmtpEmailSenderError");
  static SmtpEmailSenderTimeoutError = this.SmtpEmailSenderError.subclass(
    "SmtpEmailSenderTimeoutError",
  );

  async sendEmailWithSmtp({ smtpSettings, mailData }: SendMailArgs) {
    this.logger.debug("Sending an email via Resend REST API");

    // Use Resend REST API instead of SMTP to avoid Railway's outbound SMTP restrictions
    const apiKey = smtpSettings.auth?.pass;

    if (!apiKey) {
      throw new SmtpEmailSender.SmtpEmailSenderError("Missing API key (SMTP password)");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailData.from,
        to: mailData.to,
        subject: mailData.subject,
        html: mailData.html,
        text: mailData.text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      this.logger.error("Resend API error", { status: response.status, body: errorBody });
      throw new SmtpEmailSender.SmtpEmailSenderError(
        `Resend API returned ${response.status}: ${errorBody}`,
      );
    }

    const result = await response.json();

    this.logger.debug("Email sent via Resend API", { result });

    return { response: result };
  }
}
