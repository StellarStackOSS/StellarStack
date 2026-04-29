/**
 * User row as returned by `GET /admin/users`.
 */
export type AdminUserRow = {
  id: string
  email: string
  name: string
  isAdmin: boolean
  emailVerified: boolean
  createdAt: string
}
