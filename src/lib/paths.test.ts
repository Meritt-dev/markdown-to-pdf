import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { ensurePdfStorageDir, getPdfPathForJob, getPdfStorageRoot } from "./paths";

describe("paths", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let tempDir: string;

  beforeEach(() => {
    originalEnv = { ...process.env };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-test-"));
  });

  afterEach(() => {
    process.env = originalEnv;
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("getPdfStorageRoot", () => {
    it("should return default path when PDF_STORAGE_PATH not set", () => {
      delete process.env.PDF_STORAGE_PATH;
      const result = getPdfStorageRoot();
      expect(result).toContain("data/pdfs");
      expect(path.isAbsolute(result)).toBe(true);
    });

    it("should use PDF_STORAGE_PATH env var when set", () => {
      process.env.PDF_STORAGE_PATH = "/custom/pdf/path";
      const result = getPdfStorageRoot();
      expect(result).toBe("/custom/pdf/path");
    });

    it("should resolve relative path to absolute", () => {
      process.env.PDF_STORAGE_PATH = "relative/path";
      const result = getPdfStorageRoot();
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain("relative/path");
    });

    it("should preserve absolute paths", () => {
      const absolutePath = path.join(tempDir, "custom-pdfs");
      process.env.PDF_STORAGE_PATH = absolutePath;
      const result = getPdfStorageRoot();
      expect(result).toBe(absolutePath);
    });
  });

  describe("ensurePdfStorageDir", () => {
    it("should create directory when it does not exist", () => {
      const testPath = path.join(tempDir, "new-pdf-dir");
      process.env.PDF_STORAGE_PATH = testPath;

      expect(fs.existsSync(testPath)).toBe(false);
      ensurePdfStorageDir();
      expect(fs.existsSync(testPath)).toBe(true);
      expect(fs.statSync(testPath).isDirectory()).toBe(true);
    });

    it("should not fail when directory already exists", () => {
      const testPath = path.join(tempDir, "existing-dir");
      fs.mkdirSync(testPath);
      process.env.PDF_STORAGE_PATH = testPath;

      expect(() => ensurePdfStorageDir()).not.toThrow();
      expect(fs.existsSync(testPath)).toBe(true);
    });

    it("should create nested directories", () => {
      const testPath = path.join(tempDir, "level1", "level2", "level3");
      process.env.PDF_STORAGE_PATH = testPath;

      expect(fs.existsSync(testPath)).toBe(false);
      ensurePdfStorageDir();
      expect(fs.existsSync(testPath)).toBe(true);
      expect(fs.statSync(testPath).isDirectory()).toBe(true);
    });
  });

  describe("getPdfPathForJob", () => {
    it("should return path with .pdf extension", () => {
      const jobId = "123e4567-e89b-12d3-a456-426614174000";
      const result = getPdfPathForJob(jobId);

      expect(result).toContain(`${jobId}.pdf`);
      expect(path.basename(result)).toBe(`${jobId}.pdf`);
    });

    it("should accept valid UUID format", () => {
      const jobId = "550e8400-e29b-41d4-a716-446655440000";
      const result = getPdfPathForJob(jobId);

      expect(result).toContain(jobId);
      expect(path.basename(result)).toBe(`${jobId}.pdf`);
    });

    it("should reject job id with invalid characters", () => {
      const invalidId = "../etc/passwd";
      expect(() => getPdfPathForJob(invalidId)).toThrow("Invalid job id");
    });

    it("should reject job id with special characters", () => {
      const invalidId = "test@#$%^&*()";
      expect(() => getPdfPathForJob(invalidId)).toThrow("Invalid job id");
    });

    it("should reject job id with spaces", () => {
      const invalidId = "test job id";
      expect(() => getPdfPathForJob(invalidId)).toThrow("Invalid job id");
    });

    it("should accept lowercase hex characters", () => {
      const jobId = "abcdef01-2345-6789-abcd-ef0123456789";
      const result = getPdfPathForJob(jobId);
      expect(result).toContain(jobId);
    });

    it("should accept uppercase hex characters", () => {
      const jobId = "ABCDEF01-2345-6789-ABCD-EF0123456789";
      const result = getPdfPathForJob(jobId);
      expect(result).toContain(jobId);
    });

    it("should accept mixed case hex characters", () => {
      const jobId = "AbCdEf01-2345-6789-aBcD-Ef0123456789";
      const result = getPdfPathForJob(jobId);
      expect(result).toContain(jobId);
    });

    it("should return absolute path", () => {
      const jobId = "123e4567-e89b-12d3-a456-426614174000";
      const result = getPdfPathForJob(jobId);
      expect(path.isAbsolute(result)).toBe(true);
    });

    it("should use configured storage root", () => {
      const customRoot = path.join(tempDir, "custom-storage");
      process.env.PDF_STORAGE_PATH = customRoot;
      const jobId = "123e4567-e89b-12d3-a456-426614174000";
      const result = getPdfPathForJob(jobId);

      expect(result).toContain(customRoot);
      expect(result).toBe(path.join(customRoot, `${jobId}.pdf`));
    });
  });
});
