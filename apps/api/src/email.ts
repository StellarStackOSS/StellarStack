import { createRequire } from "node:module"

import nodemailer, { type Transporter } from "nodemailer"

import type { Env } from "@/env"
import type { SendEmailParams } from "@/email.types"

const requireFromHere = createRequire(import.meta.url)

type Bundle = Record<string, string>

const loadEmailBundle = (locale: string): Bundle => {
  try {
    return requireFromHere(
      `@workspace/shared/locales/${locale}/emails.json`
    ) as Bundle
  } catch {
    return requireFromHere(
      "@workspace/shared/locales/en/emails.json"
    ) as Bundle
  }
}

const interpolate = (
  template: string,
  params?: Record<string, string | number>
): string => {
  if (params === undefined) {
    return template
  }
  return template.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}

let cachedTransporter: Transporter | null = null

const getTransporter = (env: Env): Transporter => {
  if (cachedTransporter !== null) {
    return cachedTransporter
  }
  cachedTransporter = nodemailer.createTransport(env.SMTP_URL)
  return cachedTransporter
}

/**
 * Render and send a transactional email. Subject and body templates come from
 * the locale-specific email bundle; missing locales fall back to `en`. The
 * SMTP transporter is cached for the process lifetime.
 */
export const sendEmail = async (
  env: Env,
  options: SendEmailParams
): Promise<void> => {
  const locale = options.locale ?? "en"
  const bundle = loadEmailBundle(locale)
  const subjectTemplate = bundle[options.subjectKey] ?? options.subjectKey
  const bodyTemplate = bundle[options.bodyKey] ?? options.bodyKey

  await getTransporter(env).sendMail({
    from: env.EMAIL_FROM,
    to: options.to,
    subject: interpolate(subjectTemplate, options.params),
    text: interpolate(bodyTemplate, options.params),
  })
}
