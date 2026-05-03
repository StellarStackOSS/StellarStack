/**
 * One blueprint variable merged with its current server value.
 */
export type ServerVariable = {
  key: string
  name: string | { key: string; params?: Record<string, string | number | boolean> }
  description?: string | { key: string; params?: Record<string, string | number | boolean> }
  default: string
  userViewable: boolean
  userEditable: boolean
  rules: string
  currentValue: string
}

export type ServerVariablesResponse = {
  variables: ServerVariable[]
  startupCommand: string
  dockerImage: string
  startupExtra: string
  /** label → image URI map from the blueprint */
  dockerImages: Record<string, string>
  /** feature-name → console patterns (empty array = UI-only flag) */
  features: Record<string, string[]>
}
