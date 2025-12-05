import { mapOccupationToFamily } from './occupations';

export const occupationColors: Record<string, string> = {
	artist: '#e4572e',
	writer: '#6f4a8e',
	politician: '#1b998b',
	scientist: '#00a8e8',
	athlete: '#0081a7',
	musician: '#d45079',
	business: '#4d908e',
	explorer: '#f0a202',
	actor: '#ee4266',
	military: '#5e548e',
	religious: '#5f0f40',
	academic: '#3a86ff',
	engineer: '#6c757d',
	default: '#999999'
};

export function getColorForOccupation(occupation: string): string {
	const family = mapOccupationToFamily(occupation);
	return occupationColors[family] || occupationColors.default;
}

export function getOccupationCategory(occupation: string): string {
	return mapOccupationToFamily(occupation);
}
