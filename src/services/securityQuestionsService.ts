import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { sha256, toUtf8Bytes } from "ethers";

export const SECURITY_QUESTIONS_KEY = "WALLET_SECURITY_QUESTIONS";
export const SECURITY_SALT_KEY = "WALLET_SECURITY_SALT";

export interface StoredSecurityQuestion {
  id: string;
  question: string;
  answerHash: string;
}

export interface SecurityQuestionView {
  id: string;
  question: string;
}

export const DEFAULT_SECURITY_QUESTIONS: SecurityQuestionView[] = [
  { id: "q1", question: "What is your nickname?" },
  { id: "q2", question: "What is your favorite color?" },
  { id: "q3", question: "What was the name of your first friend?" },
  { id: "q4", question: "What is your favorite food?" },
  { id: "q5", question: "What was the name of your first school?" },
  { id: "q6", question: "What is your favorite movie?" },
];

/**
 * Retrieve the device-specific salt for security answers, or generate and store a new one.
 */
export async function getOrCreateSalt(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(SECURITY_SALT_KEY);
    if (existing && existing.length > 0) {
      return existing;
    }
    const newSalt = `sec_salt_${Crypto.randomUUID ? Crypto.randomUUID() : Date.now() + "_" + Math.random().toString(36).substring(2)}`;
    await SecureStore.setItemAsync(SECURITY_SALT_KEY, newSalt);
    return newSalt;
  } catch (err) {
    console.warn("Error getting/creating security salt, falling back to app-level salt:", err);
    return "bitmarket_device_security_salt_fallback_v1";
  }
}

/**
 * Hash a security answer securely using SHA-256 with normalization and salt.
 * Normalization: whitespace trimmed, converted to lowercase for resilient matching.
 */
export async function hashSecurityAnswer(answer: string, salt: string): Promise<string> {
  const normalized = answer.trim().toLowerCase();
  const payload = `${salt}::${normalized}`;
  try {
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
  } catch {
    // Universal fallback using ethers sha256
    return sha256(toUtf8Bytes(payload));
  }
}

/**
 * Save user's 6 security questions and salted SHA-256 answer hashes to SecureStore.
 */
export async function saveSecurityQuestionsAndAnswers(
  items: Array<{ id: string; question: string; answer: string }>
): Promise<void> {
  if (items.length !== 6) {
    throw new Error("All 6 security questions must be answered.");
  }

  // Ensure every answer has non-empty text
  for (const item of items) {
    if (!item.answer || item.answer.trim().length === 0) {
      throw new Error(`Answer for "${item.question}" cannot be empty.`);
    }
  }

  const salt = await getOrCreateSalt();
  const storedQuestions: StoredSecurityQuestion[] = [];

  for (const item of items) {
    const answerHash = await hashSecurityAnswer(item.answer, salt);
    storedQuestions.push({
      id: item.id,
      question: item.question.trim(),
      answerHash,
    });
  }

  await SecureStore.setItemAsync(
    SECURITY_QUESTIONS_KEY,
    JSON.stringify(storedQuestions)
  );
}

/**
 * Retrieve saved security questions from SecureStore.
 */
export async function getSavedSecurityQuestions(): Promise<StoredSecurityQuestion[]> {
  try {
    const raw = await SecureStore.getItemAsync(SECURITY_QUESTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn("Failed to load security questions:", err);
    return [];
  }
}

/**
 * Check whether 6 security questions are currently saved.
 */
export async function hasSecurityQuestions(): Promise<boolean> {
  const questions = await getSavedSecurityQuestions();
  return questions.length === 6;
}

/**
 * Randomly select any 3 questions from the user's 6 saved questions.
 * Returns only the ID and question string (hashes are omitted).
 */
export async function getRandomQuestionsForVerification(count = 3): Promise<SecurityQuestionView[]> {
  const saved = await getSavedSecurityQuestions();
  if (saved.length === 0) {
    return [];
  }

  // If fewer than count, return all
  if (saved.length <= count) {
    return saved.map((q) => ({ id: q.id, question: q.question }));
  }

  // Fisher-Yates shuffle a copy of the array
  const shuffled = [...saved];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count).map((q) => ({ id: q.id, question: q.question }));
}

/**
 * Verify user's entered answers against the securely stored hashes.
 * All submitted question IDs must exist and their hashes must match.
 */
export async function verifySecurityAnswers(
  userAnswers: Record<string, string>
): Promise<boolean> {
  const saved = await getSavedSecurityQuestions();
  if (saved.length === 0) {
    return false;
  }

  const salt = await getOrCreateSalt();
  const savedMap = new Map<string, StoredSecurityQuestion>();
  for (const q of saved) {
    savedMap.set(q.id, q);
  }

  const questionIds = Object.keys(userAnswers);
  if (questionIds.length === 0) {
    return false;
  }

  for (const qId of questionIds) {
    const stored = savedMap.get(qId);
    if (!stored) {
      return false;
    }
    const inputAnswer = userAnswers[qId];
    if (!inputAnswer || inputAnswer.trim().length === 0) {
      return false;
    }
    const computedHash = await hashSecurityAnswer(inputAnswer, salt);
    if (computedHash !== stored.answerHash) {
      return false;
    }
  }

  return true;
}

/**
 * Clear stored security questions and salt from SecureStore.
 */
export async function clearSecurityQuestions(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURITY_QUESTIONS_KEY);
  } catch {}
  try {
    await SecureStore.deleteItemAsync(SECURITY_SALT_KEY);
  } catch {}
}
