import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./share";

describe("password hashing", () => {
  it("round-trips a correct password", () => {
    const stored = hashPassword("hunter2-but-long");
    expect(verifyPassword(stored, "hunter2-but-long")).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword(stored, "incorrect horse")).toBe(false);
  });

  it("produces unique salts per hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("not-a-hash", "x")).toBe(false);
    expect(verifyPassword("bcrypt:abc:def", "x")).toBe(false);
    expect(verifyPassword("scrypt::", "x")).toBe(false);
    expect(verifyPassword("", "x")).toBe(false);
  });
});
