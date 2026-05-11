/**
 * Natural Language Parser for Calendar Events
 * Parses strings like "Pray for John tomorrow 7am" into structured event data
 */

export type ParsedEvent = {
  title: string;
  date: Date;
  time?: { hour: number; minute: number };
  hasTime: boolean;
};

// Time patterns
const TIME_PATTERNS = [
  // 7am, 7:30am, 7 am, 7:30 am
  /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
  // 19:30, 7:30
  /(\d{1,2}):(\d{2})(?!\s*(am|pm))/i,
  // at 7, at 19
  /at\s+(\d{1,2})(?!\d)/i,
];

// Day patterns
const DAY_PATTERNS: { pattern: RegExp; getDays: () => number }[] = [
  { pattern: /\btoday\b/i, getDays: () => 0 },
  { pattern: /\btomorrow\b/i, getDays: () => 1 },
  { pattern: /\bday after tomorrow\b/i, getDays: () => 2 },
  { pattern: /\bnext week\b/i, getDays: () => 7 },
  { pattern: /\bin (\d+) days?\b/i, getDays: () => 0 }, // handled specially
  { pattern: /\bmonday\b/i, getDays: () => getNextDayOfWeek(1) },
  { pattern: /\btuesday\b/i, getDays: () => getNextDayOfWeek(2) },
  { pattern: /\bwednesday\b/i, getDays: () => getNextDayOfWeek(3) },
  { pattern: /\bthursday\b/i, getDays: () => getNextDayOfWeek(4) },
  { pattern: /\bfriday\b/i, getDays: () => getNextDayOfWeek(5) },
  { pattern: /\bsaturday\b/i, getDays: () => getNextDayOfWeek(6) },
  { pattern: /\bsunday\b/i, getDays: () => getNextDayOfWeek(0) },
];

// Get days until next occurrence of a day of week (0 = Sunday)
function getNextDayOfWeek(targetDay: number): number {
  const today = new Date().getDay();
  let diff = targetDay - today;
  if (diff <= 0) diff += 7; // If today or past, go to next week
  return diff;
}

// Parse time from string
function parseTime(input: string): { hour: number; minute: number } | null {
  for (const pattern of TIME_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = match[2] ? parseInt(match[2], 10) : 0;
      const period = match[3]?.toLowerCase();

      // Handle AM/PM
      if (period === 'pm' && hour < 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;

      // Validate
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { hour, minute };
      }
    }
  }
  return null;
}

// Parse date from string
function parseDate(input: string): Date {
  const now = new Date();
  const result = new Date(now);
  result.setHours(0, 0, 0, 0);

  // Check for "in X days"
  const inDaysMatch = input.match(/\bin (\d+) days?\b/i);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Check for specific date patterns like "Jan 15" or "January 15"
  const monthDayMatch = input.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i);
  if (monthDayMatch) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = monthNames.findIndex(m => monthDayMatch[1].toLowerCase().startsWith(m));
    if (monthIndex !== -1) {
      result.setMonth(monthIndex);
      result.setDate(parseInt(monthDayMatch[2], 10));
      // If the date is in the past, assume next year
      if (result < now) {
        result.setFullYear(result.getFullYear() + 1);
      }
      return result;
    }
  }

  // Check for day patterns
  for (const { pattern, getDays } of DAY_PATTERNS) {
    if (pattern.test(input)) {
      result.setDate(result.getDate() + getDays());
      return result;
    }
  }

  // Default to today
  return result;
}

// Remove time and date references from title
function cleanTitle(input: string): string {
  let title = input;

  // Remove time patterns
  title = title.replace(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi, '');
  title = title.replace(/(\d{1,2}):(\d{2})/g, '');
  title = title.replace(/\bat\s+\d{1,2}(?!\d)/gi, '');

  // Remove date patterns
  title = title.replace(/\btoday\b/gi, '');
  title = title.replace(/\btomorrow\b/gi, '');
  title = title.replace(/\bday after tomorrow\b/gi, '');
  title = title.replace(/\bnext week\b/gi, '');
  title = title.replace(/\bin \d+ days?\b/gi, '');
  title = title.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');
  title = title.replace(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b/gi, '');

  // Clean up extra spaces and trim
  title = title.replace(/\s+/g, ' ').trim();

  return title;
}

/**
 * Parse a natural language string into event data
 * Examples:
 * - "Pray for John tomorrow 7am"
 * - "Doctor appointment Friday at 2pm"
 * - "Call mom in 3 days"
 * - "Bible study next week"
 */
export function parseNaturalLanguage(input: string): ParsedEvent | null {
  if (!input || input.trim().length < 2) {
    return null;
  }

  const time = parseTime(input);
  const date = parseDate(input);
  const title = cleanTitle(input);

  // If we couldn't extract a meaningful title, return null
  if (title.length < 2) {
    return null;
  }

  // Apply time to date if found
  if (time) {
    date.setHours(time.hour, time.minute, 0, 0);
  }

  return {
    title,
    date,
    time: time || undefined,
    hasTime: !!time,
  };
}

/**
 * Format a parsed event for display
 */
export function formatParsedEvent(parsed: ParsedEvent): string {
  const dateStr = parsed.date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (parsed.hasTime && parsed.time) {
    const hour = parsed.time.hour % 12 || 12;
    const minute = parsed.time.minute.toString().padStart(2, '0');
    const period = parsed.time.hour < 12 ? 'AM' : 'PM';
    return `${dateStr} at ${hour}:${minute} ${period}`;
  }

  return dateStr;
}

/**
 * Get suggestions based on partial input
 */
export function getSuggestions(input: string): string[] {
  const suggestions: string[] = [];
  const lowerInput = input.toLowerCase();

  // Time suggestions
  if (!TIME_PATTERNS.some(p => p.test(input))) {
    if (lowerInput.includes('morning') || lowerInput.includes('am')) {
      suggestions.push('7am', '8am', '9am');
    } else if (lowerInput.includes('afternoon')) {
      suggestions.push('1pm', '2pm', '3pm');
    } else if (lowerInput.includes('evening') || lowerInput.includes('night')) {
      suggestions.push('6pm', '7pm', '8pm');
    }
  }

  // Date suggestions
  if (!DAY_PATTERNS.some(({ pattern }) => pattern.test(input))) {
    suggestions.push('tomorrow', 'next week');
  }

  return suggestions;
}
