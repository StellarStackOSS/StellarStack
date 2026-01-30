/**
 * StellarStack Plugin UI Schema Definitions
 *
 * Declarative schemas for common plugin UI patterns.
 * Plugins define their UIs using these schemas instead of React components,
 * enabling dynamic rendering and better security.
 */

// ============================================
// Base Field Types
// ============================================

export type FieldType = "string" | "number" | "boolean" | "select" | "textarea" | "password";

export interface BaseField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: unknown;
}

export interface StringField extends BaseField {
  type: "string";
  minLength?: number;
  maxLength?: number;
  pattern?: string; // regex
}

export interface NumberField extends BaseField {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanField extends BaseField {
  type: "boolean";
}

export interface SelectField extends BaseField {
  type: "select";
  options: Array<{
    label: string;
    value: string | number | boolean;
  }>;
  multiple?: boolean;
}

export interface TextareaField extends BaseField {
  type: "textarea";
  rows?: number;
  minLength?: number;
  maxLength?: number;
}

export interface PasswordField extends BaseField {
  type: "password";
  minLength?: number;
}

export type FieldSchema = StringField | NumberField | BooleanField | SelectField | TextareaField | PasswordField;

// ============================================
// UI Schema Types
// ============================================

/**
 * Search and Install pattern
 * Used by CurseForge, Modrinth, Steam Workshop installers
 * Displays search interface with results grid and install workflow
 */
export interface SearchAndInstallSchema {
  type: "search-and-install";
  searchAction: string; // actionId for searching
  detailAction?: string; // actionId for fetching item details
  installAction: string; // actionId for installation
  fields: {
    searchInput: {
      label?: string;
      placeholder?: string;
    };
    resultCard: {
      title: string; // field from search result to display as title
      subtitle?: string; // optional subtitle field
      image?: string; // field for image URL
      description?: string; // field for description
      metadata?: Array<{
        label: string;
        field: string; // field name from result
        format?: "date" | "number" | "text";
      }>;
    };
    installModal?: {
      title?: string;
      fields?: FieldSchema[];
    };
  };
}

/**
 * Simple form pattern
 * Used for settings, announcements, configuration
 * Displays a form with fields and submit button
 */
export interface FormSchema {
  type: "form";
  title?: string;
  description?: string;
  fields: FieldSchema[];
  submitAction: string; // actionId to call on submit
  loadAction?: string; // actionId to load form data
  submitLabel?: string;
  successMessage?: string;
}

/**
 * Data table pattern
 * Used for displaying lists of items with optional actions
 * Supports sorting, filtering, pagination
 */
export interface DataTableSchema {
  type: "data-table";
  title?: string;
  loadAction: string; // actionId to fetch table data
  columns: Array<{
    id: string;
    label: string;
    format?: "date" | "number" | "text" | "boolean";
    sortable?: boolean;
    width?: string;
  }>;
  pagination?: {
    pageSize?: number;
  };
  actions?: Array<{
    id: string;
    label: string;
    icon?: string;
    actionId: string; // actionId to call
    dangerous?: boolean;
    confirmation?: string;
  }>;
}

/**
 * Action button pattern
 * Simple button that triggers an action
 */
export interface ActionButtonSchema {
  type: "action-button";
  label: string;
  actionId: string;
  icon?: string;
  variant?: "primary" | "secondary" | "danger";
  dangerous?: boolean;
  confirmation?: string;
}

/**
 * Stats display pattern
 * Shows key metrics/statistics
 */
export interface StatsSchema {
  type: "stats";
  loadAction: string;
  items: Array<{
    id: string;
    label: string;
    icon?: string;
    format?: "number" | "percentage" | "duration" | "text";
    trend?: "up" | "down" | "neutral";
  }>;
}

/**
 * Compound schema
 * Combines multiple sub-schemas
 */
export interface CompoundSchema {
  type: "compound";
  layout?: "vertical" | "horizontal" | "grid";
  sections: Array<{
    title?: string;
    description?: string;
    schema: UISchema;
  }>;
}

/**
 * Union of all possible UI schemas
 */
export type UISchema =
  | SearchAndInstallSchema
  | FormSchema
  | DataTableSchema
  | ActionButtonSchema
  | StatsSchema
  | CompoundSchema;

// ============================================
// Action Response Types
// ============================================

/**
 * Expected response from search action
 */
export interface SearchResult {
  items: Array<{
    id: string | number;
    [key: string]: unknown;
  }>;
  total?: number;
  hasMore?: boolean;
}

/**
 * Expected response from detail action
 */
export interface DetailResult {
  [key: string]: unknown;
}

/**
 * Expected response from install action
 */
export interface InstallResult {
  success: boolean;
  message?: string;
  downloadUrl?: string;
}

/**
 * Expected response from form submit
 */
export interface FormSubmitResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Expected response from table load action
 */
export interface TableLoadResult {
  items: Array<{ id: string | number; [key: string]: unknown }>;
  total?: number;
  pageNumber?: number;
  pageSize?: number;
}
