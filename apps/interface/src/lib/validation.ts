/**
 * Input validation and sanitization utilities for campaign creation.
 */

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_GOAL = BigInt(9223372036854775807) / BigInt(10); // i128::MAX / 10
const MIN_DEADLINE_HOURS = 1;
const MAX_DEADLINE_YEARS = 1;

/**
 * Strip HTML tags from a string.
 */
export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

/**
 * Validate and sanitize campaign title.
 * @returns Error message if invalid, null if valid
 */
export function validateTitle(title: string): string | null {
  if (!title || !title.trim()) {
    return "Title is required.";
  }
  const sanitized = stripHtmlTags(title);
  if (sanitized.length > MAX_TITLE_LENGTH) {
    return `Title must be ${MAX_TITLE_LENGTH} characters or less.`;
  }
  return null;
}

/**
 * Validate and sanitize campaign description.
 * @returns Error message if invalid, null if valid
 */
export function validateDescription(description: string): string | null {
  if (!description || !description.trim()) {
    return "Description is required.";
  }
  const sanitized = stripHtmlTags(description);
  if (sanitized.length > MAX_DESCRIPTION_LENGTH) {
    return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`;
  }
  return null;
}

/**
 * Validate funding goal.
 * @returns Error message if invalid, null if valid
 */
export function validateGoal(goal: string): string | null {
  if (!goal || goal.trim() === "") {
    return "Goal is required.";
  }
  const num = Number(goal);
  if (isNaN(num) || num <= 0) {
    return "Goal must be a positive number.";
  }
  const bigGoal = BigInt(Math.floor(num * 10_000_000)); // Convert to stroops
  if (bigGoal > MAX_GOAL) {
    return "Goal exceeds maximum allowed value.";
  }
  return null;
}

/**
 * Validate deadline.
 * @returns Error message if invalid, null if valid
 */
export function validateDeadline(deadline: string): string | null {
  if (!deadline) {
    return "Deadline is required.";
  }
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffYears = diffHours / (24 * 365);

  if (diffHours < MIN_DEADLINE_HOURS) {
    return `Deadline must be at least ${MIN_DEADLINE_HOURS} hour in the future.`;
  }
  if (diffYears > MAX_DEADLINE_YEARS) {
    return `Deadline cannot be more than ${MAX_DEADLINE_YEARS} year in the future.`;
  }
  return null;
}

/**
 * Validate minimum contribution.
 * @returns Error message if invalid, null if valid
 */
export function validateMinContribution(
  minContribution: string,
  goal: string,
): string | null {
  if (!minContribution || minContribution.trim() === "") {
    return "Minimum contribution is required.";
  }
  const num = Number(minContribution);
  if (isNaN(num) || num < 1) {
    return "Minimum contribution must be at least 1.";
  }
  const goalNum = Number(goal);
  if (num > goalNum) {
    return "Minimum contribution cannot exceed goal.";
  }
  return null;
}

/**
 * Validate platform fee in basis points.
 * @returns Error message if invalid, null if valid
 */
export function validateFeeBps(feeBps: string): string | null {
  if (!feeBps || feeBps.trim() === "") {
    return null; // Optional field
  }
  const num = Number(feeBps);
  if (isNaN(num) || num < 0 || num > 10000) {
    return "Fee must be between 0 and 10000 basis points.";
  }
  return null;
}

/**
 * Sanitize title by stripping HTML tags and trimming.
 */
export function sanitizeTitle(title: string): string {
  return stripHtmlTags(title).trim();
}

/**
 * Sanitize description by stripping HTML tags and trimming.
 */
export function sanitizeDescription(description: string): string {
  return stripHtmlTags(description).trim();
}
