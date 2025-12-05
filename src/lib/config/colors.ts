export const occupationColors: Record<string, string> = {
	artist: '#e4572e',
	writer: '#6f4a8e',
	politician: '#1b998b',
	explorer: '#f0a202',
	athlete: '#0081a7',
	default: '#999999'
};

export const occupationMap: Record<string, string> = {
	// Norwegian occupations
	maler: 'artist',
	kunstner: 'artist',
	grafiker: 'artist',
	forfatter: 'writer',
	dikter: 'writer',
	poet: 'writer',
	skribent: 'writer',
	politiker: 'politician',
	statsminister: 'politician',
	fotballspiller: 'athlete',
	idrettsutøver: 'athlete',
	oppdager: 'explorer',
	utforsker: 'explorer',
	// English occupations
	painter: 'artist',
	artist: 'artist',
	graphic: 'artist',
	author: 'writer',
	writer: 'writer',
	poet: 'writer',
	politician: 'politician',
	prime: 'politician',
	footballer: 'athlete',
	athlete: 'athlete',
	explorer: 'explorer'
};

export function getOccupationCategory(occupation: string): string {
	const lower = occupation.toLowerCase();
	
	// Check direct mapping
	for (const [key, value] of Object.entries(occupationMap)) {
		if (lower.includes(key)) {
			return value;
		}
	}
	
	return 'default';
}

export function getColorForOccupation(occupation: string): string {
	const category = getOccupationCategory(occupation);
	return occupationColors[category] || occupationColors.default;
}

