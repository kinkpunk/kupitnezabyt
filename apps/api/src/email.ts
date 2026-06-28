import type { ApiConfig } from "./env.js";

type ResendErrorResponse = {
  message?: string;
};

export type MagicLinkEmailResult = {
  devMagicLink?: string;
};

export type WorkspaceInvitationEmailResult = {
  devInvitationLink?: string;
};

export async function sendMagicLinkEmail(input: {
  config: ApiConfig;
  email: string;
  magicLink: string;
}): Promise<MagicLinkEmailResult> {
  if (input.config.nodeEnv !== "production" && !input.config.emailProviderApiKey) {
    return {
      devMagicLink: input.magicLink
    };
  }

  if (!input.config.emailProviderApiKey || !input.config.emailFrom) {
    throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.config.emailProviderApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: input.config.emailFrom,
      to: input.email,
      subject: "Вход в kupitnezabyt",
      text: [
        "Откройте эту ссылку, чтобы войти в kupitnezabyt:",
        "",
        input.magicLink,
        "",
        "Если вы не запрашивали вход, просто проигнорируйте это письмо."
      ].join("\n")
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ResendErrorResponse | null;
    throw new Error(
      payload?.message
        ? `EMAIL_SEND_FAILED: ${payload.message}`
        : "EMAIL_SEND_FAILED"
    );
  }

  return {};
}

export async function sendWorkspaceInvitationEmail(input: {
  config: ApiConfig;
  email: string;
  invitationLink: string;
  workspaceName: string;
}): Promise<WorkspaceInvitationEmailResult> {
  if (input.config.nodeEnv !== "production" && !input.config.emailProviderApiKey) {
    return {
      devInvitationLink: input.invitationLink
    };
  }

  if (!input.config.emailProviderApiKey || !input.config.emailFrom) {
    throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.config.emailProviderApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: input.config.emailFrom,
      to: input.email,
      subject: "Приглашение в kupitnezabyt",
      text: [
        `Вас пригласили в список "${input.workspaceName}" в kupitnezabyt.`,
        "",
        "Откройте эту ссылку, чтобы принять приглашение:",
        "",
        input.invitationLink,
        "",
        "Если вы не ожидали приглашение, просто проигнорируйте это письмо."
      ].join("\n")
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ResendErrorResponse | null;
    throw new Error(
      payload?.message ? `EMAIL_SEND_FAILED: ${payload.message}` : "EMAIL_SEND_FAILED"
    );
  }

  return {};
}
