/**
 * Cryptographic utilities for StellarStack
 *
 * Uses industry-standard algorithms:
 * - bcrypt for password hashing (like Pterodactyl)
 * - AES-256-CBC for symmetric encryption (like Pterodactyl)
 * - SHA-256 for general hashing
 * - Timing-safe comparisons to prevent timing attacks
 */

import { randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from "crypto";
import bcrypt from "bcrypt";

// ============================================================================
// Constants
// ============================================================================

const BCRYPT_ROUNDS = 12; // Industry standard, balance between security and performance
const AES_ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // AES block size

// Get encryption key from environment (must be 32 bytes for AES-256)
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required for encryption operations");
  }

  // If key is hex-encoded (64 chars), decode it
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  // If key is base64-encoded
  if (key.length === 44 && /^[A-Za-z0-9+/=]+$/.test(key)) {
    return Buffer.from(key, "base64");
  }

  // Hash the key to get consistent 32 bytes
  return createHash("sha256").update(key).digest();
};

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate a cryptographically secure random token
 */
export const GenerateToken = (length: number = 32): string => {
  return randomBytes(length).toString("hex");
};

/**
 * Generate a secure random string (URL-safe)
 */
export const GenerateSecureString = (length: number = 32): string => {
  return randomBytes(length).toString("base64url");
};

// ============================================================================
// Hashing (SHA-256)
// ============================================================================

/**
 * Hash a string using SHA-256
 */
export const HashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

/**
 * Verify a token against a SHA-256 hash using timing-safe comparison
 * Prevents timing attacks
 */
export const VerifyToken = (token: string, hash: string): boolean => {
  const tokenHash = HashToken(token);

  // Both must be same length for timingSafeEqual
  if (tokenHash.length !== hash.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
  } catch {
    return false;
  }
};

// ============================================================================
// Password Hashing (bcrypt) - Like Pterodactyl
// ============================================================================

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Promise<string> - Bcrypt hash
 */
export const HashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

/**
 * Verify a password against a bcrypt hash
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise<boolean> - True if password matches
 */
export const VerifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
};

// ============================================================================
// AES-256-CBC Encryption - Like Pterodactyl
// ============================================================================

/**
 * Encrypt data using AES-256-CBC
 * Returns IV + encrypted data as base64
 * @param plaintext - Data to encrypt
 * @returns Encrypted data as base64 string (IV prepended)
 */
export const Encrypt = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  // Prepend IV to encrypted data
  return iv.toString("base64") + ":" + encrypted;
};

/**
 * Decrypt data encrypted with AES-256-CBC
 * @param ciphertext - Encrypted data as base64 (IV:encrypted)
 * @returns Decrypted plaintext
 */
export const Decrypt = (ciphertext: string): string => {
  const key = getEncryptionKey();

  const [ivBase64, encryptedData] = ciphertext.split(":");
  if (!ivBase64 || !encryptedData) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(ivBase64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }

  const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

/**
 * Safely encrypt sensitive data, returning null if encryption fails
 */
export const SafeEncrypt = (plaintext: string): string | null => {
  try {
    return Encrypt(plaintext);
  } catch {
    return null;
  }
};

/**
 * Safely decrypt data, returning null if decryption fails
 */
export const SafeDecrypt = (ciphertext: string): string | null => {
  try {
    return Decrypt(ciphertext);
  } catch {
    return null;
  }
};

// ============================================================================
// Timing-Safe String Comparison
// ============================================================================

/**
 * Compare two strings in constant time to prevent timing attacks
 */
export const TimingSafeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

// ============================================================================
// HMAC Generation
// ============================================================================

/**
 * Generate an HMAC signature
 */
export const GenerateHmac = (data: string, secret: string): string => {
  return createHash("sha256")
    .update(data + secret)
    .digest("hex");
};

/**
 * Verify an HMAC signature using timing-safe comparison
 */
export const VerifyHmac = (data: string, signature: string, secret: string): boolean => {
  const expected = GenerateHmac(data, secret);
  return TimingSafeCompare(expected, signature);
};

// ============================================================================
// Plugin Config Field Encryption
// ============================================================================

/**
 * A JSON schema property definition with optional sensitive marker.
 */
interface SchemaProperty {
  sensitive?: boolean;
  type?: string;
  [key: string]: unknown;
}

/**
 * A JSON schema with properties map.
 */
interface ConfigSchemaWithProperties {
  properties?: Record<string, SchemaProperty>;
  [key: string]: unknown;
}

/**
 * An encrypted field wrapper stored in config JSON.
 */
interface EncryptedFieldWrapper {
  __encrypted: true;
  value: string;
}

/**
 * Type guard to check if a value is an encrypted field wrapper.
 *
 * @param value - Value to check
 * @returns True if value matches encrypted field wrapper shape
 */
const isEncryptedWrapper = (value: unknown): value is EncryptedFieldWrapper => {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).__encrypted === true &&
    typeof (value as Record<string, unknown>).value === "string"
  );
};

/**
 * Encrypt sensitive fields in a config object based on schema.
 * ConfigSchema should mark sensitive fields with "sensitive": true.
 *
 * @param config - The configuration object containing field values
 * @param configSchema - Optional schema defining which fields are sensitive
 * @returns A new config object with sensitive fields encrypted
 */
export const EncryptConfigFields = (
  config: Record<string, unknown>,
  configSchema?: Record<string, unknown>
): Record<string, unknown> => {
  if (!configSchema) {
    return config;
  }

  const encrypted = { ...config };
  const schema = configSchema as ConfigSchemaWithProperties;
  const properties = schema.properties || {};

  for (const [fieldName, fieldSchema] of Object.entries(properties)) {
    const isSensitive = fieldSchema.sensitive === true;

    if (isSensitive && encrypted[fieldName] !== undefined && encrypted[fieldName] !== null) {
      const plainValue = encrypted[fieldName];

      // Mark encrypted fields with special prefix so we can identify them later
      encrypted[fieldName] = {
        __encrypted: true,
        value: Encrypt(String(plainValue)),
      };
    }
  }

  return encrypted;
};

/**
 * Decrypt sensitive fields in a config object based on schema.
 *
 * @param config - The configuration object containing potentially encrypted field values
 * @param configSchema - Optional schema defining which fields are sensitive
 * @returns A new config object with sensitive fields decrypted
 */
export const DecryptConfigFields = (
  config: Record<string, unknown>,
  configSchema?: Record<string, unknown>
): Record<string, unknown> => {
  if (!configSchema) {
    return config;
  }

  const decrypted = { ...config };
  const schema = configSchema as ConfigSchemaWithProperties;
  const properties = schema.properties || {};

  for (const [fieldName, fieldSchema] of Object.entries(properties)) {
    const isSensitive = fieldSchema.sensitive === true;

    if (isSensitive && config[fieldName] !== undefined && config[fieldName] !== null) {
      const value = config[fieldName];

      // Check if this field is encrypted
      if (isEncryptedWrapper(value)) {
        try {
          decrypted[fieldName] = Decrypt(value.value);
        } catch (error) {
          console.error(`[Crypto] Failed to decrypt field ${fieldName}:`, error);
          // Return encrypted marker so we know it failed
          decrypted[fieldName] = "<decryption-failed>";
        }
      }
    }
  }

  return decrypted;
};

/**
 * Mask sensitive fields for logging/display.
 * Shows only first and last character: "a...y"
 *
 * @param config - The configuration object containing field values
 * @param configSchema - Optional schema defining which fields are sensitive
 * @returns A new config object with sensitive fields masked
 */
export const MaskSensitiveFields = (
  config: Record<string, unknown>,
  configSchema?: Record<string, unknown>
): Record<string, unknown> => {
  if (!configSchema) {
    return config;
  }

  const masked = { ...config };
  const schema = configSchema as ConfigSchemaWithProperties;
  const properties = schema.properties || {};

  for (const [fieldName] of Object.entries(properties)) {
    const isSensitive = properties[fieldName].sensitive === true;

    if (isSensitive && config[fieldName] !== undefined && config[fieldName] !== null) {
      const value = String(config[fieldName]);

      if (value.length <= 2) {
        masked[fieldName] = "*";
      } else {
        masked[fieldName] = value[0] + "..." + value[value.length - 1];
      }
    }
  }

  return masked;
};

/**
 * Check if a value appears to be encrypted (has the encryption wrapper).
 *
 * @param value - The value to check
 * @returns Whether the value has the encrypted wrapper format
 */
export const IsEncrypted = (value: unknown): boolean => {
  return isEncryptedWrapper(value);
};
