export const allOccupations = [
	'artist',
	'writer',
	'politician',
	'explorer',
	'athlete'
] as const;

export type Occupation = typeof allOccupations[number];

