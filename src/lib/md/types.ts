/**
 * Document metadata extracted from front matter (YAML).
 */
export interface DocumentMetadata {
  /**
   * Document title.
   */
  readonly title?: string;

  /**
   * Document author(s).
   */
  readonly author?: string;

  /**
   * Document creation or publish date.
   */
  readonly date?: string;

  /**
   * Additional custom metadata fields.
   */
  readonly [key: string]: unknown;
}

/**
 * Result of the unified markdown processing pipeline.
 */
export interface MarkdownProcessingResult {
  /**
   * Processed HTML body content.
   */
  readonly html: string;

  /**
   * Extracted document metadata from front matter, if present.
   */
  readonly metadata: DocumentMetadata;
}
