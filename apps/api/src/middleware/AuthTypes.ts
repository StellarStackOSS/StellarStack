/**
 * Type definitions for authentication middleware
 */

/**
 * User session type
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Server access context with permissions
 */
export interface ServerAccessContext {
  server: {
    id: string;
    name: string;
    ownerId: string;
    [key: string]: unknown;
  };
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  permissions: string[];
}
