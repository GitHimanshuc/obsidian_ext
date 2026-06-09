export function getTodoTaskTemplate(date = new Date()): string {
	const today = formatDateOnly(date);
	return [
		'- [ ] TODO @@',
		`add:${today} ${formatTimeOnly(date)},`,
		`due:${today} 17:00,`,
		'prio:1,',
		'est:30',
	].join(' ');
}

export function formatOptionalDateTime(
	date: string | null,
	time: string | null,
): string {
	if (!date) {
		return '-';
	}

	return time ? `${date} ${time}` : date;
}

export function getTodayDate(): string {
	return formatDateOnly(new Date());
}

export function getCurrentDateTime(): { date: string; time: string } {
	const now = new Date();
	return { date: formatDateOnly(now), time: formatTimeOnly(now) };
}

export function addDays(value: string, days: number): string {
	const date = parseDateOnly(value);
	date.setDate(date.getDate() + days);
	return formatDateOnly(date);
}

export function endOfMonth(value: string): string {
	const date = parseDateOnly(value);
	return formatDateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function parseDateOnly(value: string): Date {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		throw new Error(`Invalid date: ${value}`);
	}

	const yearText = match[1];
	const monthText = match[2];
	const dayText = match[3];
	if (!yearText || !monthText || !dayText) {
		throw new Error(`Invalid date: ${value}`);
	}

	return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
}

export function formatDateOnly(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function formatTimeOnly(date: Date): string {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
}

export function isValidDateOnly(value: string): boolean {
	const date = parseDateOnly(value);
	return formatDateOnly(date) === value;
}

export function getDateTimeTimestamp(
	date: string | null,
	time: string | null,
	fallbackTime: string,
): number | null {
	if (!date) {
		return null;
	}

	const parsedDate = parseDateOnly(date);
	const timeParts = parseTimeOnly(time ?? fallbackTime);
	if (!timeParts) {
		return null;
	}

	parsedDate.setHours(timeParts.hours, timeParts.minutes, 0, 0);
	return parsedDate.getTime();
}

function parseTimeOnly(value: string): { hours: number; minutes: number } | null {
	const match = value.match(/^(\d{2}):(\d{2})$/);
	const hours = Number(match?.[1]);
	const minutes = Number(match?.[2]);

	if (
		!Number.isInteger(hours) ||
		!Number.isInteger(minutes) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return null;
	}

	return { hours, minutes };
}
