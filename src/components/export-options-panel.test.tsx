import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportOptionsPanel, DEFAULT_EXPORT_OPTIONS } from "./export-options-panel";
import type { ExportOptions } from "@/lib/export-options";

describe("ExportOptionsPanel", () => {
  it("should render collapsed by default", () => {
    const onChange = vi.fn();
    render(<ExportOptionsPanel options={DEFAULT_EXPORT_OPTIONS} onChange={onChange} />);

    const button = screen.getByRole("button", { name: /expand export options/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");

    expect(screen.queryByLabelText(/paper size/i)).not.toBeInTheDocument();
  });

  it("should expand when clicked", () => {
    const onChange = vi.fn();
    render(<ExportOptionsPanel options={DEFAULT_EXPORT_OPTIONS} onChange={onChange} />);

    const button = screen.getByRole("button", { name: /expand export options/i });
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/paper size/i)).toBeInTheDocument();
  });

  it("should collapse when clicked again", () => {
    const onChange = vi.fn();
    render(<ExportOptionsPanel options={DEFAULT_EXPORT_OPTIONS} onChange={onChange} />);

    const button = screen.getByRole("button", { name: /expand export options/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("should call onChange when theme is selected", () => {
    const onChange = vi.fn();
    render(<ExportOptionsPanel options={DEFAULT_EXPORT_OPTIONS} onChange={onChange} />);

    const expandButton = screen.getByRole("button", { name: /expand export options/i });
    fireEvent.click(expandButton);

    const minimalTheme = screen.getByRole("button", { name: /minimal/i });
    fireEvent.click(minimalTheme);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: "minimal",
      })
    );
  });

  it("should call onChange when paper size is selected", () => {
    const onChange = vi.fn();
    render(<ExportOptionsPanel options={DEFAULT_EXPORT_OPTIONS} onChange={onChange} />);

    const expandButton = screen.getByRole("button", { name: /expand export options/i });
    fireEvent.click(expandButton);

    const paperSizeSelect = screen.getByLabelText(/paper size/i);
    fireEvent.change(paperSizeSelect, { target: { value: "letter" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        paperSize: "letter",
      })
    );
  });

  it("should call onChange when margins preset is selected", () => {
    const onChange = vi.fn();
    render(<ExportOptionsPanel options={DEFAULT_EXPORT_OPTIONS} onChange={onChange} />);

    const expandButton = screen.getByRole("button", { name: /expand export options/i });
    fireEvent.click(expandButton);

    const marginsSelect = screen.getByLabelText(/margins/i);
    fireEvent.change(marginsSelect, { target: { value: "wide" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        marginPreset: "wide",
      })
    );
  });

  it("should call onChange when page numbers checkbox is toggled", () => {
    const onChange = vi.fn();
    render(<ExportOptionsPanel options={DEFAULT_EXPORT_OPTIONS} onChange={onChange} />);

    const expandButton = screen.getByRole("button", { name: /expand export options/i });
    fireEvent.click(expandButton);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        showPageNumbers: true,
      })
    );
  });

  it("should disable all controls when disabled prop is true", () => {
    const onChange = vi.fn();
    render(<ExportOptionsPanel options={DEFAULT_EXPORT_OPTIONS} onChange={onChange} disabled={true} />);

    const expandButton = screen.getByRole("button", { name: /expand export options/i });
    fireEvent.click(expandButton);

    const paperSizeSelect = screen.getByLabelText(/paper size/i) as HTMLSelectElement;
    const marginsSelect = screen.getByLabelText(/margins/i) as HTMLSelectElement;
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;

    expect(paperSizeSelect.disabled).toBe(true);
    expect(marginsSelect.disabled).toBe(true);
    expect(checkbox.disabled).toBe(true);
  });

  it("should display current options in summary", () => {
    const options: ExportOptions = {
      theme: "minimal",
      paperSize: "letter",
      marginPreset: "wide",
      showPageNumbers: true,
    };

    const onChange = vi.fn();
    render(<ExportOptionsPanel options={options} onChange={onChange} />);

    expect(screen.getByText(/minimal/i)).toBeInTheDocument();
    expect(screen.getByText(/letter/i)).toBeInTheDocument();
    expect(screen.getByText(/page numbers/i)).toBeInTheDocument();
  });

  it("should mark active theme with aria-pressed", () => {
    const onChange = vi.fn();
    render(<ExportOptionsPanel options={DEFAULT_EXPORT_OPTIONS} onChange={onChange} />);

    const expandButton = screen.getByRole("button", { name: /expand export options/i });
    fireEvent.click(expandButton);

    const defaultTheme = screen.getByRole("button", { name: /^default/i });
    expect(defaultTheme).toHaveAttribute("aria-pressed", "true");
  });
});
