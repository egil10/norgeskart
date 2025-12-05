export const allOccupations = [
	'artist',
	'writer',
	'politician',
	'scientist',
	'athlete',
	'musician',
	'business',
	'explorer',
	'actor',
	'military',
	'religious',
	'academic',
	'engineer',
	'default'
] as const;

export type Occupation = typeof allOccupations[number];

// Comprehensive occupation mapping with fuzzy matching
const occupationKeywords: Record<string, string> = {
	// Artist
	'artist': 'artist',
	'maler': 'artist',
	'painter': 'artist',
	'kunstner': 'artist',
	'grafiker': 'artist',
	'graphic': 'artist',
	'sculptor': 'artist',
	'skulptør': 'artist',
	'illustrator': 'artist',
	
	// Writer
	'writer': 'writer',
	'forfatter': 'writer',
	'author': 'writer',
	'dikter': 'writer',
	'poet': 'writer',
	'skribent': 'writer',
	'novelist': 'writer',
	'journalist': 'writer',
	
	// Politician
	'politician': 'politician',
	'politiker': 'politician',
	'statsminister': 'politician',
	'prime minister': 'politician',
	'mayor': 'politician',
	'ordfører': 'politician',
	
	// Scientist
	'scientist': 'scientist',
	'forsker': 'scientist',
	'researcher': 'scientist',
	'physicist': 'scientist',
	'fysiker': 'scientist',
	'chemist': 'scientist',
	'kjemiker': 'scientist',
	'biologist': 'scientist',
	'biolog': 'scientist',
	'astronomer': 'scientist',
	'astronom': 'scientist',
	'mathematician': 'scientist',
	'matematiker': 'scientist',
	'physician': 'scientist',
	'lege': 'scientist',
	'doctor': 'scientist',
	
	// Athlete
	'athlete': 'athlete',
	'idrettsutøver': 'athlete',
	'fotballspiller': 'athlete',
	'footballer': 'athlete',
	'soccer': 'athlete',
	'skier': 'athlete',
	'skiløper': 'athlete',
	'swimmer': 'athlete',
	'svømmer': 'athlete',
	
	// Musician
	'musician': 'musician',
	'musiker': 'musician',
	'composer': 'musician',
	'komponist': 'musician',
	'singer': 'musician',
	'sanger': 'musician',
	'pianist': 'musician',
	
	// Business
	'business': 'business',
	'forretningsmann': 'business',
	'businessperson': 'business',
	'entrepreneur': 'business',
	'gründer': 'business',
	
	// Explorer
	'explorer': 'explorer',
	'oppdager': 'explorer',
	'utforsker': 'explorer',
	'adventurer': 'explorer',
	
	// Actor
	'actor': 'actor',
	'skuespiller': 'actor',
	'actress': 'actor',
	
	// Military
	'military': 'military',
	'militær': 'military',
	'soldier': 'military',
	'soldat': 'military',
	'officer': 'military',
	'admiral': 'military',
	'general': 'military',
	
	// Religious
	'religious': 'religious',
	'prest': 'religious',
	'priest': 'religious',
	'bishop': 'religious',
	'biskop': 'religious',
	'pastor': 'religious',
	
	// Academic
	'academic': 'academic',
	'professor': 'academic',
	'historiker': 'academic',
	'historian': 'academic',
	'philosopher': 'academic',
	'filosof': 'academic',
	
	// Engineer
	'engineer': 'engineer',
	'ingeniør': 'engineer',
	'architect': 'engineer',
	'arkitekt': 'engineer'
};

export function mapOccupationToFamily(occupation: string): string {
	if (!occupation) return 'default';
	
	const lower = occupation.toLowerCase().trim();
	
	// Direct match
	if (occupationKeywords[lower]) {
		return occupationKeywords[lower];
	}
	
	// Fuzzy match - check if any keyword is contained in the occupation
	for (const [keyword, family] of Object.entries(occupationKeywords)) {
		if (lower.includes(keyword) || keyword.includes(lower)) {
			return family;
		}
	}
	
	return 'default';
}
