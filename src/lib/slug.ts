import { customAlphabet } from "nanoid";

const URL_SAFE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
const SLUG_LENGTH = 16;

const generate = customAlphabet(URL_SAFE_ALPHABET, SLUG_LENGTH);

export function newSlug(): string {
  return generate();
}
