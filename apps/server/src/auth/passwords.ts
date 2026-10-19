import argon2 from 'argon2';

export const PASSWORD_MIN = 8;
/** Upper bound so a huge password can't make hashing slow. */
export const PASSWORD_MAX = 128;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

let dummyHash: Promise<string> | null = null;

/** Spend the same time as a real check when the email doesn't exist, so response times don't reveal accounts. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await argon2.verify(await dummyHash, password);
  return false;
}
