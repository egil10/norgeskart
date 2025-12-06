import peopleData from './people.json';
import type { Person } from '../types';
import { getColorForOccupation } from '../config/colors';
import { mapOccupationToFamily } from '../config/occupations';

// Top 10 most famous Norwegians - always visible
const TOP_FAMOUS: Record<string, number> = {
	'Edvard Munch': 100,
	'Henrik Ibsen': 100,
	'Edvard Grieg': 100,
	'Roald Amundsen': 100,
	'Fridtjof Nansen': 100,
	'Thor Heyerdahl': 95,
	'Gro Harlem Brundtland': 95,
	'Knut Hamsun': 95,
	'Sigrid Undset': 95,
	'Trygve Lie': 90,
	// Add more famous names
	'Erling Braut Haaland': 85,
	'Henrik Wergeland': 90,
	'Ole Bull': 85,
	'Liv Ullmann': 85,
	'Magnus Carlsen': 85,
	'Bjørnstjerne Bjørnson': 90,
	'Vidkun Quisling': 95, // Infamous but famous
	'Johan Sverdrup': 90,
	'Christian Michelsen': 85,
	'Kristian Birkeland': 85
};

function calculateProminenceScore(person: any): number {
	// Check if in top famous list
	if (TOP_FAMOUS[person.name]) {
		return TOP_FAMOUS[person.name];
	}

	let score = 50; // Base score

	// Has Wikipedia article = more famous
	if (person.wikipediaUrl) {
		score += 20;
	}

	// Has image = more documented/famous
	if (person.imageUrl) {
		score += 15;
	}

	// Longer summary = more notable
	if (person.summary && person.summary.length > 100) {
		score += 10;
	}

	// Multiple occupations = more versatile/famous
	if (person.occupations && person.occupations.length > 1) {
		score += 5 * (person.occupations.length - 1);
	}

	// Certain occupations are historically more notable
	const notableOccupations = [
		'statsminister', 'prime minister', 'konge', 'king', 'dronning', 'queen',
		'oppdager', 'explorer', 'nobel', 'nobelpris', 'nobel prize'
	];
	const occLower = person.occupations?.join(' ').toLowerCase() || '';
	if (notableOccupations.some(occ => occLower.includes(occ))) {
		score += 15;
	}

	// Older historical figures (pre-1900) often more documented
	if (person.birthYear < 1900) {
		score += 5;
	}

	// Still alive = contemporary relevance
	if (person.deathYear === null && person.birthYear > 1970) {
		score += 10;
	}

	// Normalize to 1-100 range
	return Math.min(100, Math.max(1, Math.round(score)));
}

function extractWikipediaSlug(url: string | null): string | undefined {
	if (!url) return undefined;
	
	// Extract from https://no.wikipedia.org/wiki/Name
	const match = url.match(/wiki\/(.+)$/);
	if (match) {
		return decodeURIComponent(match[1]);
	}
	return undefined;
}

export function loadPeople(): Person[] {
	const currentYear = new Date().getFullYear();
	const MAX_AGE = 120;

	const processed: Person[] = peopleData
		.map((person: any) => {
			const prominenceScore = calculateProminenceScore(person);
			const wikipediaSlug = extractWikipediaSlug(person.wikipediaUrl);
			const occupations = person.occupations || [];
			
			// Determine color based on primary occupation if not already set
			let color = person.color;
			if (!color || color === '#999999' || color === '#999') {
				const primaryOccupation = occupations[0] || '';
				color = getColorForOccupation(primaryOccupation);
			}
			
			return {
				id: person.id,
				name: person.name,
				birthYear: person.birthYear,
				deathYear: person.deathYear || null,
				imageUrl: person.imageUrl || null,
				wikipediaUrl: person.wikipediaUrl || null,
				wikipediaSlug,
				summary: person.summary || '',
				occupations,
				color,
				prominenceScore
			};
		})
		.filter((person: Person) => {
			// Validate birth year is reasonable (not in the future, not too far in the past)
			if (person.birthYear > currentYear || person.birthYear < 500) {
				return false;
			}

			// Filter out people with impossible ages (more than 120 years)
			if (person.deathYear === null) {
				// Living person: check age against current year
				const age = currentYear - person.birthYear;
				return age <= MAX_AGE && age >= 0;
			} else {
				// Deceased person: check lifespan and validate death year
				if (person.deathYear < person.birthYear || person.deathYear > currentYear) {
					return false; // Invalid death year
				}
				const lifespan = person.deathYear - person.birthYear;
				return lifespan <= MAX_AGE && lifespan > 0; // Also ensure positive lifespan
			}
		});

	// Sort by birth year
	processed.sort((a, b) => a.birthYear - b.birthYear);

	// Ensure top 10 have highest scores
	const topNames = Object.keys(TOP_FAMOUS);
	processed.forEach(p => {
		if (topNames.includes(p.name)) {
			p.prominenceScore = TOP_FAMOUS[p.name];
		}
	});

	return processed;
}

// Export pre-loaded data
export const allPeople = loadPeople();

// Get top 10 most prominent
export const topPeople = [...allPeople]
	.sort((a, b) => b.prominenceScore - a.prominenceScore)
	.slice(0, 10);
