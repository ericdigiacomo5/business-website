// Gift-card codes. A code is bearer value — whoever holds it can claim the
// card — so it's treated like a password: high entropy, Web Crypto randomness
// (Workers-portable, same as password-reset-token.ts), and only its hash is
// ever stored.
//
// Client-safe: no Prisma import, and Web Crypto exists in the browser too
// (the forms use normalizeGiftCardCode for instant feedback).

import { sha256Hex } from "@/lib/password-reset-token"

// 32 characters with no 0/O or 1/I, so a printed code can't be misread.
// 32 divides 256 evenly, so `byte % 32` picks every character with equal
// probability (no modulo bias).
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
export const GIFT_CARD_CODE_LENGTH = 16 // 16 × 5 bits = 80 bits

// "K7QM4XRT9WHC2PNB" → "K7QM-4XRT-9WHC-2PNB", for printing and display.
export function formatGiftCardCode(code: string): string {
    return code.match(/.{1,4}/g)?.join("-") ?? code
}

// What a person typed → the canonical 16 characters: uppercase, with spaces
// and dashes dropped. Returns null if it can't be a code at all.
export function normalizeGiftCardCode(input: unknown): string | null {
    if (typeof input !== "string") return null
    const code = input.toUpperCase().replace(/[\s-]/g, "")
    if (code.length !== GIFT_CARD_CODE_LENGTH) return null
    for (const char of code) {
        if (!ALPHABET.includes(char)) return null
    }
    return code
}

export function generateGiftCardCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(GIFT_CARD_CODE_LENGTH))
    return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}

// Plain SHA-256, not bcrypt: with 80 bits of randomness there's nothing to
// brute-force, and an unsalted hash is what makes lookup-by-hash possible.
export function hashGiftCardCode(normalizedCode: string): Promise<string> {
    return sha256Hex(normalizedCode)
}
