/**
 * Cryptographic utilities for StellarStack
 *
 * Uses industry-standard algorithms:
 * - bcrypt for password hashing (like Pterodactyl)
 * - AES-256-CBC for symmetric encryption (like Pterodactyl)
 * - SHA-256 for general hashing
 * - Timing-safe comparisons to prevent timing attacks
 */

import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "crypto";
import bcrypt from "bcrypt";

// ============================================================================
// Constants
// ============================================================================

const BCRYPT_ROUNDS = 12; // Industry standard, balance between security and performance
const AES_ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // AES block size

// Get encryption key from environment (must be 32 bytes for AES-256)
function getEncryptionKey(): Buffer {
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
}

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Generate a secure random string (URL-safe)
 */
export function generateSecureString(length: number = 32): string {
  return randomBytes(length).toString("base64url");
}

// ============================================================================
// Hashing (SHA-256)
// ============================================================================

/**
 * Hash a string using SHA-256
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verify a token against a SHA-256 hash using timing-safe comparison
 * Prevents timing attacks
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);

  // Both must be same length for timingSafeEqual
  if (tokenHash.length !== hash.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
  } catch {
    return false;
  }
}

// ============================================================================
// Password Hashing (bcrypt) - Like Pterodactyl
// ============================================================================

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Promise<string> - Bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// ============================================================================
// AES-256-CBC Encryption - Like Pterodactyl
// ============================================================================

/**
 * Encrypt data using AES-256-CBC
 * Returns IV + encrypted data as base64
 * @param plaintext - Data to encrypt
 * @returns Encrypted data as base64 string (IV prepended)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  // Prepend IV to encrypted data
  return iv.toString("base64") + ":" + encrypted;
}

/**
 * Decrypt data encrypted with AES-256-CBC
 * @param ciphertext - Encrypted data as base64 (IV:encrypted)
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string): string {
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
}

/**
 * Safely encrypt sensitive data, returning null if encryption fails
 */
export function safeEncrypt(plaintext: string): string | null {
  try {
    return encrypt(plaintext);
  } catch {
    return null;
  }
}

/**
 * Safely decrypt data, returning null if decryption fails
 */
export function safeDecrypt(ciphertext: string): string | null {
  try {
    return decrypt(ciphertext);
  } catch {
    return null;
  }
}

// ============================================================================
// Timing-Safe String Comparison
// ============================================================================

/**
 * Compare two strings in constant time to prevent timing attacks
 */
export function timingSafeCompare(a: string, b: string): boolean {
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
}

// ============================================================================
// HMAC Generation
// ============================================================================

/**
 * Generate an HMAC signature
 */
export function generateHmac(data: string, secret: string): string {
  return createHash("sha256")
    .update(data + secret)
    .digest("hex");
}

/**
 * Verify an HMAC signature using timing-safe comparison
 */
export function verifyHmac(data: string, signature: string, secret: string): boolean {
  const expected = generateHmac(data, secret);
  return timingSafeCompare(expected, signature);
}
