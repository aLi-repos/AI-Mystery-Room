import { z } from "zod";
import { isStrongPassword } from "@/lib/auth/password";

/**
 * Auth input validation (spec.md §7.1 + §9.2/§9.6): Zod on every incoming
 * payload. Errors are returned through the §5.4 envelope by the route
 * handlers — these schemas only shape/validate the data.
 */

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .refine((value) => z.email().safeParse(value).success, {
    message: "Enter a valid email address",
  });

const passwordField = z.string().min(1, "Password is required").max(72);

export const registerSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters")
    .refine(isStrongPassword, {
      message: "Password must mix letters with digits or symbols",
    }),
  displayName: z.string().trim().min(1, "Display name is required").max(40),
});

export const loginSchema = z.object({
  email: emailField,
  // Generic on purpose: a malformed password simply fails authentication
  // with 401 INVALID_CREDENTIALS (§7.1 — no credential oracle).
  password: passwordField,
});

export const guestSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
});

// §7.1: upgrade-guest sends `{email, password}` only — the guest keeps the
// display name chosen when the guest session was created.
export const upgradeGuestSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters")
    .refine(isStrongPassword, {
      message: "Password must mix letters with digits or symbols",
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GuestInput = z.infer<typeof guestSchema>;
