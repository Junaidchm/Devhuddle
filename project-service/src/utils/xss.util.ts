import sanitizeHtml from "sanitize-html";

/**
 * Sanitize user input to prevent XSS attacks
 * Removes potentially dangerous HTML/JavaScript while preserving safe text
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Configure sanitize-html to be very strict
  const sanitized = sanitizeHtml(input, {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });

  // Additional cleanup: remove any remaining HTML entities
  return sanitized
    .replace(/&[#\w]+;/g, "") // Remove HTML entities
    .trim();
}

/**
 * Validate content length
 */
export function validateContentLength(content: string, maxLength: number = 10000): boolean {
  return content.length <= maxLength;
}
