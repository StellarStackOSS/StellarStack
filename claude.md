# StellarStack TypeScript Coding Standards

This document defines the coding standards for the StellarStack project. All contributions must adhere to these guidelines to maintain code quality, consistency, and maintainability.

## Table of Contents

- [TypeScript & Type Safety](#typescript--type-safety)
- [File Organization](#file-organization)
- [Function & Component Definitions](#function--component-definitions)
- [Documentation](#documentation)
- [Code Patterns](#code-patterns)
- [Component Architecture](#component-architecture)
- [Error Handling](#error-handling)
- [Example: Complete Component](#example-complete-component)

---

## TypeScript & Type Safety

### No "any" Types

All code must be fully typed. The `any` type is forbidden except in exceptional circumstances with explicit justification in a comment.

**❌ Bad:**

```typescript
const handleData = (data: any): any => {
  return data.value;
};
```

**✅ Good:**

```typescript
interface DataPayload {
  value: string;
  id: number;
}

const HandleData = (data: DataPayload): string => {
  return data.value;
};
```

### Define Interfaces & Types for Data Structures

Every data structure must have a corresponding interface or type definition. Use `interface` for objects that will be extended, `type` for unions and complex types.

**✅ Good:**

```typescript
// For extensible objects
interface BaseUser {
  id: string;
  email: string;
}

interface AdminUser extends BaseUser {
  permissions: string[];
}

// For unions and complex types
type UserRole = "admin" | "user" | "guest";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: Error;
};
```

### Generic Types

Use generics to create reusable type-safe utilities.

**✅ Good:**

```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface ApiError {
  message: string;
  code: string;
}

type Result<T> = { success: true; data: T } | { success: false; error: ApiError };
```

---

## File Organization

### Naming Conventions

- **Files**: PascalCase for all files (e.g., `UserProfile.tsx`, `ApiClient.ts`, `DateUtils.ts`)
- **Functions**: PascalCase (e.g., `GetUserData`, `FormatDate`, `CreateApiClient`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Variables**: camelCase (e.g., `userData`, `isLoading`, `apiUrl`)

**File structure example:**

```
src/
├── components/
│   ├── UserProfile.tsx      # PascalCase file
│   ├── Button.tsx
│   └── Modal.tsx
├── hooks/
│   ├── UseUserData.ts
│   ├── UseApi.ts
│   └── UseLocalStorage.ts
├── utils/
│   ├── DateUtils.ts
│   ├── ApiClient.ts
│   └── StringUtils.ts
├── types/
│   ├── User.ts
│   ├── Api.ts
│   └── Common.ts
└── services/
    ├── AuthService.ts
    ├── UserService.ts
    └── DataService.ts
```

### No Index Files for Exports

Do not create `index.ts` files for re-exporting functions or components. Import directly from the module file.

**❌ Bad:**

```typescript
// index.ts
export { UserProfile } from "./UserProfile";
export { Button } from "./Button";

// consumer.tsx
import { UserProfile, Button } from "./components";
```

**✅ Good:**

```typescript
// consumer.tsx
import UserProfile from "./components/UserProfile";
import Button from "./components/Button";
```

### Export Default

Always use `export default` for the primary export from a module.

**✅ Good:**

```typescript
// UserProfile.tsx
interface UserProfileProps {
  userId: string;
}

const UserProfile = ({ userId }: UserProfileProps) => {
  return <div>{userId}</div>;
};

export default UserProfile;
```

---

## Function & Component Definitions

### Use Const-Based Functions

All functions must be defined as const arrow functions. Do not use function declarations or classes.

**❌ Bad:**

```typescript
function GetUserData(userId: string): Promise<User> {
  // ...
}

export function handleClick() {
  // ...
}

class UserService {
  getUser(id: string) {
    // ...
  }
}
```

**✅ Good:**

```typescript
const GetUserData = async (userId: string): Promise<User> => {
  // ...
};

const HandleClick = () => {
  // ...
};

const UserService = {
  GetUser: async (id: string): Promise<User> => {
    // ...
  },
};
```

### Function Signature Format

Always specify explicit return types.

**✅ Good:**

```typescript
// Simple function
const Add = (a: number, b: number): number => {
  return a + b;
};

// Function with object parameters
interface UserFilter {
  role: string;
  active: boolean;
}

const FilterUsers = (users: User[], filter: UserFilter): User[] => {
  return users.filter(user =>
    user.role === filter.role && user.active === filter.active
  );
};

// Async function
const FetchUserData = async (userId: string): Promise<User> => {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
};

// Function returning JSX
interface GreetingProps {
  name: string;
  greeting?: string;
}

const Greeting = ({ name, greeting = 'Hello' }: GreetingProps): JSX.Element => {
  return <h1>{greeting}, {name}!</h1>;
};
```

### React Components

React components are functions that follow the same const-based pattern.

**✅ Good:**

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

const Button = ({ variant = 'primary', loading, ...props }: ButtonProps): JSX.Element => {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={loading}
      {...props}
    >
      {loading ? 'Loading...' : props.children}
    </button>
  );
};

export default Button;
```

---

## Documentation

### JSDoc for Functions

All functions and components must have JSDoc comments documenting their purpose, parameters, and return type.

**✅ Good:**

```typescript
/**
 * Formats a date string into a human-readable format.
 *
 * @param date - The date to format (ISO string or Date object)
 * @param locale - The locale for formatting (default: 'en-US')
 * @returns Formatted date string (e.g., "January 15, 2024")
 */
const FormatDate = (date: string | Date, locale: string = "en-US"): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
```

### JSDoc for Components

All React components must document their props and behavior.

**✅ Good:**

````typescript
interface CardProps {
  /** The title displayed at the top of the card */
  title: string;
  /** Optional description text */
  description?: string;
  /** Content to display inside the card */
  children: React.ReactNode;
  /** Optional CSS class for styling */
  className?: string;
}

/**
 * A reusable card component for displaying content in a contained layout.
 *
 * @component
 * @example
 * ```tsx
 * <Card title="Profile" description="User information">
 *   <p>User details here</p>
 * </Card>
 * ```
 *
 * @param props - Card configuration
 * @returns Card component with provided content
 */
const Card = ({ title, description, children, className }: CardProps): JSX.Element => {
  return (
    <div className={`card ${className || ''}`}>
      <h2>{title}</h2>
      {description && <p className="text-gray-600">{description}</p>}
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};

export default Card;
````

### JSDoc for Interfaces & Types

Document complex interfaces and types, especially those used across multiple files.

**✅ Good:**

```typescript
/**
 * Represents a user in the system.
 */
interface User {
  /** Unique identifier for the user */
  id: string;
  /** User's email address */
  email: string;
  /** User's full name */
  name: string;
  /** User's role in the system */
  role: UserRole;
  /** Timestamp of when the user was created */
  createdAt: Date;
  /** Whether the user account is active */
  isActive: boolean;
}

/**
 * User roles available in the system.
 */
type UserRole = "admin" | "moderator" | "user" | "guest";
```

---

## Code Patterns

### Avoid Code Duplication

If code is duplicated in 2+ places, extract it into a shared function or component.

**❌ Bad (Duplicated):**

```typescript
// UserList.tsx
const UserList = () => {
  return (
    <div>
      {users.map(user => (
        <div key={user.id} className="border p-4 rounded">
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
      ))}
    </div>
  );
};

// AdminPanel.tsx
const AdminPanel = () => {
  return (
    <div>
      {admins.map(admin => (
        <div key={admin.id} className="border p-4 rounded">
          <h3>{admin.name}</h3>
          <p>{admin.email}</p>
        </div>
      ))}
    </div>
  );
};
```

**✅ Good (Shared Component):**

```typescript
// UserCard.tsx
interface UserCardProps {
  id: string;
  name: string;
  email: string;
}

const UserCard = ({ id, name, email }: UserCardProps): JSX.Element => (
  <div key={id} className="border p-4 rounded">
    <h3>{name}</h3>
    <p>{email}</p>
  </div>
);

export default UserCard;

// UserList.tsx
import UserCard from './UserCard';

const UserList = () => {
  return (
    <div>
      {users.map(user => (
        <UserCard
          key={user.id}
          id={user.id}
          name={user.name}
          email={user.email}
        />
      ))}
    </div>
  );
};

// AdminPanel.tsx
import UserCard from './UserCard';

const AdminPanel = () => {
  return (
    <div>
      {admins.map(admin => (
        <UserCard
          key={admin.id}
          id={admin.id}
          name={admin.name}
          email={admin.email}
        />
      ))}
    </div>
  );
};
```

### Use Utility Functions for Common Operations

Create reusable utility functions for common tasks.

**✅ Good:**

```typescript
// StringUtils.ts

/**
 * Capitalizes the first character of a string.
 */
const Capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Truncates a string to a specified length with ellipsis.
 */
const Truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
};

/**
 * Checks if a string is a valid email.
 */
const IsValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default { Capitalize, Truncate, IsValidEmail };
```

### Constants in UPPER_SNAKE_CASE

Define constants at the module level in UPPER_SNAKE_CASE.

**✅ Good:**

```typescript
// UserService.ts

const DEFAULT_PAGE_SIZE = 20;
const MAX_USERNAME_LENGTH = 50;
const USER_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const ADMIN_ROLES = ["admin", "superadmin"] as const;

const FetchUsers = async (page: number = 1): Promise<User[]> => {
  const pageSize = DEFAULT_PAGE_SIZE;
  // ...
};
```

---

## Component Architecture

### Props Interface Pattern

Always define a `Props` interface for components.

**✅ Good:**

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

const Modal = ({ isOpen, onClose, title, children, size = 'medium' }: ModalProps): JSX.Element | null => {
  if (!isOpen) return null;

  return (
    <div className={`modal modal-${size}`}>
      <div className="modal-header">
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="modal-body">
        {children}
      </div>
    </div>
  );
};

export default Modal;
```

### Extend HTML Attributes

For native HTML elements, extend the appropriate HTML attributes interface.

**✅ Good:**

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = ({ label, error, ...props }: InputProps): JSX.Element => {
  return (
    <div className="input-group">
      {label && <label>{label}</label>}
      <input {...props} />
      {error && <span className="error">{error}</span>}
    </div>
  );
};

export default Input;
```

### Hook Naming Convention

Custom hooks should be named with the `Use` prefix and follow PascalCase.

**✅ Good:**

```typescript
// UseUserData.ts

interface UseUserDataReturn {
  user: User | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing user data.
 *
 * @param userId - The ID of the user to fetch
 * @returns User data, loading state, error, and refetch function
 */
const UseUserData = (userId: string): UseUserDataReturn => {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const Refetch = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const userData = await FetchUser(userId);
      setUser(userData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    Refetch();
  }, [userId, Refetch]);

  return { user, loading, error, refetch: Refetch };
};

export default UseUserData;
```

---

## Error Handling

### Type Your Errors

Define error types instead of using generic Error.

**✅ Good:**

```typescript
interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

interface ValidationError {
  field: string;
  message: string;
}

type ApplicationError = ApiError | ValidationError | Error;

/**
 * Safely handles errors and returns a formatted error object.
 */
const HandleError = (error: unknown): ApplicationError => {
  if (error instanceof Error) {
    if ("code" in error && "statusCode" in error) {
      return error as ApiError;
    }
    return error;
  }
  return new Error("Unknown error occurred");
};
```

### Result Type Pattern

Use a Result type for functions that can fail.

**✅ Good:**

```typescript
interface Success<T> {
  ok: true;
  data: T;
}

interface Failure {
  ok: false;
  error: ApplicationError;
}

type Result<T> = Success<T> | Failure;

/**
 * Attempts to parse JSON safely.
 */
const ParseJson = <T>(json: string): Result<T> => {
  try {
    const data = JSON.parse(json) as T;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error("Failed to parse JSON"),
    };
  }
};

// Usage
const result = ParseJson<User>("{}");
if (result.ok) {
  console.log(result.data);
} else {
  console.error(result.error.message);
}
```

---

## Example: Complete Component

Here's a complete example following all standards:

````typescript
// UserProfileCard.tsx

import React from 'react';

/**
 * Represents a user profile with contact information.
 */
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user';
  isActive: boolean;
}

/**
 * Props for the UserProfileCard component.
 */
interface UserProfileCardProps {
  /** User data to display */
  user: User;
  /** Callback when edit button is clicked */
  onEdit: (userId: string) => void;
  /** Callback when delete button is clicked */
  onDelete: (userId: string) => void;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Displays a user profile card with name, email, and action buttons.
 *
 * @component
 * @example
 * ```tsx
 * const user = { id: '1', name: 'John', email: 'john@example.com', role: 'user', isActive: true };
 * <UserProfileCard user={user} onEdit={handleEdit} onDelete={handleDelete} />
 * ```
 *
 * @param props - Component props
 * @returns User profile card component
 */
const UserProfileCard = ({ user, onEdit, onDelete, className }: UserProfileCardProps): JSX.Element => {
  const HandleEdit = (): void => {
    onEdit(user.id);
  };

  const HandleDelete = (): void => {
    if (window.confirm(`Are you sure you want to delete ${user.name}?`)) {
      onDelete(user.id);
    }
  };

  return (
    <div className={`user-card ${className || ''}`}>
      {user.avatar && (
        <img src={user.avatar} alt={user.name} className="user-avatar" />
      )}

      <div className="user-info">
        <h3>{user.name}</h3>
        <p className="email">{user.email}</p>
        <span className={`role role-${user.role}`}>{user.role}</span>
        <span className={`status ${user.isActive ? 'active' : 'inactive'}`}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="actions">
        <button onClick={HandleEdit} className="btn-edit">
          Edit
        </button>
        <button onClick={HandleDelete} className="btn-delete">
          Delete
        </button>
      </div>
    </div>
  );
};

export default UserProfileCard;
````

---

## Summary Checklist

- [ ] All code is fully typed (no `any`)
- [ ] Functions are const arrow functions with explicit return types
- [ ] Function and file names are PascalCase
- [ ] All functions/components have JSDoc comments
- [ ] No `index.ts` files for re-exports
- [ ] Using `export default` for primary exports
- [ ] Props interfaces are defined for all components
- [ ] No code duplication (extract to shared functions/components)
- [ ] Constants are UPPER_SNAKE_CASE
- [ ] Custom hooks use `Use` prefix
- [ ] Error types are explicitly defined
- [ ] React components extend HTML attributes when appropriate
