import { mapOccupationToFamily } from './occupations';

export const occupationColors: Record<string, string> = {
	// Modern, vibrant color palette with good contrast and visual appeal
	artist: '#FF6B6B',        // Warm coral red - vibrant and creative
	writer: '#9B59B6',       // Rich purple - literary and thoughtful
	politician: '#3498DB',   // Clear blue - trustworthy and authoritative
	scientist: '#1ABC9C',    // Teal - modern and scientific
	athlete: '#E74C3C',      // Energetic red - dynamic and active
	musician: '#E91E63',     // Pink magenta - expressive and artistic
	business: '#16A085',     // Deep teal - professional and stable
	explorer: '#F39C12',     // Golden orange - adventurous and bold
	actor: '#E67E22',        // Warm orange - dramatic and expressive
	military: '#34495E',     // Dark slate - strong and disciplined
	religious: '#8E44AD',    // Deep purple - spiritual and contemplative
	academic: '#2980B9',      // Professional blue - intellectual and scholarly
	engineer: '#27AE60',     // Fresh green - technical and innovative
	default: '#95A5A6'      // Neutral gray - balanced and unobtrusive
};

export function getColorForOccupation(occupation: string): string {
	const family = mapOccupationToFamily(occupation);
	return occupationColors[family] || occupationColors.default;
}

export function getOccupationCategory(occupation: string): string {
	return mapOccupationToFamily(occupation);
}
