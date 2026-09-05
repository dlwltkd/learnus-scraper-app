// Deadline formatting.
//
// Due dates arrive in more than one shape: ISO-8601 from the API
// ("2026-08-19T04:39:02.106Z"), and locale strings from older screens ("8/18/2026").
// The Home screen interpolated whatever it got straight into the UI, which is how a
// raw ISO timestamp ended up in front of students. Everything deadline-shaped goes
// through here instead.

function parseDate(value: string | number | Date | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/** Calendar days from today, ignoring time of day. Negative means past. */
function daysFromToday(date: Date): number {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The deadline as a student reads it: "오늘 23:59 마감", "3일 남음", "2일 지남".
 * Near-term deadlines get a clock time because that is what decides tonight; distant
 * ones get a date, since the exact hour is noise a week out.
 *
 * Returns '' for anything unparseable, so callers can fall back to showing nothing.
 */
export function formatDeadline(value: string | number | Date | null | undefined): string {
    const date = parseDate(value);
    if (!date) return '';

    const days = daysFromToday(date);
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    if (days < 0) {
        const late = Math.abs(days);
        return late === 1 ? '어제 마감' : `${late}일 지남`;
    }
    if (days === 0) return `오늘 ${time} 마감`;
    if (days === 1) return `내일 ${time} 마감`;
    if (days <= 7) return `${days}일 남음`;

    return `${date.getMonth() + 1}월 ${date.getDate()}일 마감`;
}

/**
 * A plain calendar date: "8월 20일". For dates that are not deadlines — a lecture
 * opening, for instance — where counting down would imply an urgency that isn't there.
 */
export function formatDate(value: string | number | Date | null | undefined): string {
    const date = parseDate(value);
    if (!date) return '';
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
