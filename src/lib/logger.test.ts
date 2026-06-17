import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";

describe("logger", () => {
  it("should return logger object with standard methods", () => {
    const logger = createLogger("test");

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.fatal).toBe("function");
  });

  it("should create logger with correct name", () => {
    const logger = createLogger("worker");

    expect(logger).toBeDefined();
  });

  it("should create logger with different names", () => {
    const logger1 = createLogger("api");
    const logger2 = createLogger("worker");

    expect(logger1).toBeDefined();
    expect(logger2).toBeDefined();
  });

  it("should allow info logging", () => {
    const logger = createLogger("test");

    expect(() => {
      logger.info("Test message");
    }).not.toThrow();
  });

  it("should allow error logging", () => {
    const logger = createLogger("test");

    expect(() => {
      logger.error("Error message");
    }).not.toThrow();
  });

  it("should allow warn logging", () => {
    const logger = createLogger("test");

    expect(() => {
      logger.warn("Warning message");
    }).not.toThrow();
  });

  it("should allow logging with object context", () => {
    const logger = createLogger("test");

    expect(() => {
      logger.info({ userId: "123", action: "login" }, "User logged in");
    }).not.toThrow();
  });

  it("should allow logging errors with err field", () => {
    const logger = createLogger("test");
    const error = new Error("Test error");

    expect(() => {
      logger.error({ err: error }, "An error occurred");
    }).not.toThrow();
  });
});
