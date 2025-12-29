/**
 * Type definitions for permissions
 */

import { PERMISSIONS, PERMISSION_CATEGORIES } from "./permissions";

/**
 * Permission type derived from PERMISSIONS constant
 */
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Permission category type derived from PERMISSION_CATEGORIES constant
 */
export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[keyof typeof PERMISSION_CATEGORIES];

/**
 * Permission definition with metadata for UI
 */
export interface PermissionDefinition {
  key: Permission;
  name: string;
  description: string;
  category: PermissionCategory;
}

/**
 * Category definition with metadata for UI
 */
export interface CategoryDefinition {
  name: string;
  description: string;
  icon: string;
}
