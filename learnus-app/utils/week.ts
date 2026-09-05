/**
 * Moodle section names are written for a desktop table, not a phone. They arrive
 * as "Week 6 [06 October - 12 October]" or "12주차 [11월17일 - 11월23일]".
 *
 * Two shapes are needed: one for a list header, where the dates still matter,
 * and one for the middle of a Korean sentence, where they do not.
 */

const MONTHS: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const BRACKETED = /^(.*?)\s*\[\s*(\d{1,2})\s+([A-Za-z]+)\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s*\]$/;

/**
 * Header form. Compresses the bracketed range but keeps it:
 * "Week 6 [06 October - 12 October]" -> "Week 6 · 10/06-10/12".
 * Korean sections are already compact and pass through untouched.
 */
export function shortenWeek(week: string): string {
    const match = week.match(BRACKETED);
    if (!match) return week;
    const [, label, d1, m1, d2, m2] = match;
    const a = MONTHS[m1.toLowerCase()];
    const b = MONTHS[m2.toLowerCase()];
    if (!a || !b) return week;
    return `${label.trim()} · ${a}/${d1}–${b}/${d2}`;
}

/**
 * Sentence form. Drops the dates entirely and says the week the way a Korean
 * sentence would: "Week 8 [20 October - 26 October]" -> "8주차".
 *
 * Falls back to the label with the bracket stripped, so an unexpected section
 * name still reads as a phrase rather than leaking raw Moodle markup.
 */
export function weekLabelKo(week: string): string {
    const label = week.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    const en = label.match(/^Week\s+(\d+)/i);
    if (en) return `${en[1]}주차`;
    const ko = label.match(/^(\d+)\s*주차/);
    if (ko) return `${ko[1]}주차`;
    return label;
}
