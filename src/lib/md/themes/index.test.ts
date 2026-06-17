import { describe, expect, it } from "vitest";

import type { ExportOptions } from "@/lib/export-options";
import { buildPrintThemeCss } from "./index";

describe("themes", () => {
  describe("buildPrintThemeCss", () => {
    const baseOptions: ExportOptions = {
      theme: "default",
      paperSize: "a4",
      marginPreset: "default",
      showPageNumbers: false,
    };

    it("should return non-empty CSS string", () => {
      const css = buildPrintThemeCss(baseOptions);
      expect(css).toBeTruthy();
      expect(typeof css).toBe("string");
      expect(css.length).toBeGreaterThan(0);
    });

    it("should include @page rules for print", () => {
      const css = buildPrintThemeCss(baseOptions);
      expect(css).toContain("@page");
    });

    it("should apply default theme CSS", () => {
      const options: ExportOptions = {
        ...baseOptions,
        theme: "default",
      };
      const css = buildPrintThemeCss(options);
      expect(css).toBeTruthy();
      expect(css).toContain("@page");
    });

    it("should apply minimal theme CSS", () => {
      const options: ExportOptions = {
        ...baseOptions,
        theme: "minimal",
      };
      const css = buildPrintThemeCss(options);
      expect(css).toBeTruthy();
      expect(css).toContain("@page");
    });

    it("should apply docs theme CSS", () => {
      const options: ExportOptions = {
        ...baseOptions,
        theme: "docs",
      };
      const css = buildPrintThemeCss(options);
      expect(css).toBeTruthy();
      expect(css).toContain("@page");
    });

    it("should reflect margin preset in CSS", () => {
      const narrowOptions: ExportOptions = {
        ...baseOptions,
        marginPreset: "narrow",
      };
      const defaultOptions: ExportOptions = {
        ...baseOptions,
        marginPreset: "default",
      };
      const wideOptions: ExportOptions = {
        ...baseOptions,
        marginPreset: "wide",
      };

      const narrowCss = buildPrintThemeCss(narrowOptions);
      const defaultCss = buildPrintThemeCss(defaultOptions);
      const wideCss = buildPrintThemeCss(wideOptions);

      // All should contain margin rules
      expect(narrowCss).toContain("margin");
      expect(defaultCss).toContain("margin");
      expect(wideCss).toContain("margin");

      // 8mm for narrow
      expect(narrowCss).toContain("8mm");

      // 12mm for default
      expect(defaultCss).toContain("12mm");

      // 20mm for wide
      expect(wideCss).toContain("20mm");
    });

    it("should reflect paper size in CSS", () => {
      const a4Options: ExportOptions = {
        ...baseOptions,
        paperSize: "a4",
      };
      const letterOptions: ExportOptions = {
        ...baseOptions,
        paperSize: "letter",
      };

      const a4Css = buildPrintThemeCss(a4Options);
      const letterCss = buildPrintThemeCss(letterOptions);

      // Both should contain size rules
      expect(a4Css).toContain("size");
      expect(letterCss).toContain("size");
    });

    it("should handle all combinations of options", () => {
      const combinations: ExportOptions[] = [
        { theme: "default", paperSize: "a4", marginPreset: "narrow", showPageNumbers: false },
        { theme: "default", paperSize: "letter", marginPreset: "wide", showPageNumbers: true },
        { theme: "minimal", paperSize: "a4", marginPreset: "default", showPageNumbers: false },
        { theme: "minimal", paperSize: "letter", marginPreset: "narrow", showPageNumbers: true },
        { theme: "docs", paperSize: "a4", marginPreset: "wide", showPageNumbers: false },
        { theme: "docs", paperSize: "letter", marginPreset: "default", showPageNumbers: true },
      ];

      for (const options of combinations) {
        const css = buildPrintThemeCss(options);
        expect(css).toBeTruthy();
        expect(css.length).toBeGreaterThan(100);
        expect(css).toContain("@page");
      }
    });

    it("should produce different CSS for different themes", () => {
      const defaultCss = buildPrintThemeCss({ ...baseOptions, theme: "default" });
      const minimalCss = buildPrintThemeCss({ ...baseOptions, theme: "minimal" });
      const docsCss = buildPrintThemeCss({ ...baseOptions, theme: "docs" });

      // Each theme should produce unique CSS (at least some differences)
      expect(defaultCss).not.toBe(minimalCss);
      expect(minimalCss).not.toBe(docsCss);
      expect(defaultCss).not.toBe(docsCss);
    });

    it("should include base CSS in all themes", () => {
      const themes: Array<ExportOptions["theme"]> = ["default", "minimal", "docs"];

      for (const theme of themes) {
        const css = buildPrintThemeCss({ ...baseOptions, theme });
        // Base CSS should include fundamental print styles
        expect(css).toContain("@page");
      }
    });

    it("should be valid CSS (no obvious syntax errors)", () => {
      const css = buildPrintThemeCss(baseOptions);

      // Check for balanced braces
      const openBraces = (css.match(/{/g) || []).length;
      const closeBraces = (css.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);

      // Should not contain template literals that weren't replaced
      expect(css).not.toContain("${");
      expect(css).not.toContain("undefined");
    });
  });
});
