import i18next from "i18next"
import ICU from "i18next-icu"
import { initReactI18next } from "react-i18next"

import commonEn from "@workspace/shared/locales/en/common.json"
import errorsEn from "@workspace/shared/locales/en/errors.json"
import validationEn from "@workspace/shared/locales/en/validation.json"
import emailsEn from "@workspace/shared/locales/en/emails.json"
import blueprintsEn from "@workspace/shared/locales/en/blueprints.json"

import { env } from "@/lib/Env"

const resources = {
  en: {
    common: commonEn,
    errors: errorsEn,
    validation: validationEn,
    emails: emailsEn,
    blueprints: blueprintsEn,
  },
} as const

let bootstrapped = false

/**
 * Initialise i18next with the en bundles bundled out of @workspace/shared.
 * Idempotent — safe to call from `main.tsx` and from tests. ICU plugin is
 * loaded so emails/blueprints can use {plural} and {select} where needed.
 *
 * The single namespace `common` is the default; consumers reach for
 * `useTranslation("errors")` etc. when resolving an API error code.
 */
export const bootstrapI18n = async (): Promise<void> => {
  if (bootstrapped) {
    return
  }
  bootstrapped = true
  await i18next
    .use(ICU)
    .use(initReactI18next)
    .init({
      resources,
      lng: env.defaultLocale,
      fallbackLng: "en",
      ns: ["common", "errors", "validation", "emails", "blueprints"],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      returnNull: false,
    })
}

export { i18next }
