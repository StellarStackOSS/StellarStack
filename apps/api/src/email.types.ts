/**
 * Parameters supported by `sendEmail`. `subjectKey` and `bodyKey` are
 * translation keys resolved from the user's locale bundle (or `en` as
 * fallback). `params` carry interpolation values.
 */
export type SendEmailParams = {
  to: string
  subjectKey: string
  bodyKey: string
  params?: Record<string, string | number>
  /** ISO-639 locale code; defaults to `en`. */
  locale?: string
}
