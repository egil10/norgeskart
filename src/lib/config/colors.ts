import { mapOccupationToFamily } from './occupations';

export const occupationColors: Record<string, string> = {
	// New color palette with red, blue, and neutral tones
	artist: '#FF6A70',        // Soft pink-red - vibrant and creative
	writer: '#00568F',       // Deep blue - literary and thoughtful
	politician: '#00205B',   // Navy blue - trustworthy and authoritative
	scientist: '#1B4F8C',    // Medium blue - modern and scientific
	athlete: '#D9381E',      // Bright red - dynamic and active
	musician: '#CF2F45',     // Rose red - expressive and artistic
	business: '#3A7CAD',     // Sky blue - professional and stable
	explorer: '#2D6AB0',     // Ocean blue - adventurous and bold
	actor: '#BA0C2F',        // Deep red - dramatic and expressive
	military: '#8B1E2D',     // Dark red - strong and disciplined
	religious: '#6A0F1B',    // Deep burgundy - spiritual and contemplative
	academic: '#5DA9E9',     // Light blue - intellectual and scholarly
	engineer: '#E6E6E6',     // Light gray - technical and innovative
	default: '#BFC5CA'       // Neutral gray - balanced and unobtrusive
};

export function getColorForOccupation(occupation: string): string {
	const family = mapOccupationToFamily(occupation);
	return occupationColors[family] || occupationColors.default;
}

export function getOccupationCategory(occupation: string): string {
	return mapOccupationToFamily(occupation);
}
