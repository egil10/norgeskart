import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { getColorForOccupation } from '../config/colors.js';

interface PersonData {
	id: string;
	name: string;
	birthYear: number;
	deathYear: number | null;
	imageUrl: string;
	wikipediaUrl: string;
	summary: string;
	occupations: string[];
	color: string;
}

const people = [
	{
		name: 'Edvard Munch',
		id: 'edvard-munch',
		wikipediaUrl: 'https://no.wikipedia.org/wiki/Edvard_Munch',
		imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Edvard_Munch_1933-2.jpg'
	},
	{
		name: 'Erling Braut Haaland',
		id: 'erling-braut-haaland',
		wikipediaUrl: 'https://no.wikipedia.org/wiki/Erling_Braut_Haaland',
		imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Erling_Haaland_June_2025.jpg'
	},
	{
		name: 'Henrik Wergeland',
		id: 'henrik-wergeland',
		wikipediaUrl: 'https://no.wikipedia.org/wiki/Henrik_Wergeland',
		imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Wergeland_daguerreotype.jpg'
	},
	{
		name: 'Kåre Willoch',
		id: 'kare-willoch',
		wikipediaUrl: 'https://no.wikipedia.org/wiki/Kåre_Willoch',
		imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Willoch_1983_%28high_resolution%2C_cropped%29.jpg'
	}
];

async function fetchPersonData(person: typeof people[0]): Promise<PersonData> {
	console.log(`Fetching data for ${person.name}...`);
	
	const response = await fetch(person.wikipediaUrl);
	const html = await response.text();
	const $ = cheerio.load(html);
	
	// Extract birth year - try multiple selectors
	let birthYear = 0;
	let birthText = '';
	
	// Try various infobox selectors
	const birthSelectors = [
		'#infobox .infobox-data',
		'#infobox td.infobox-data',
		'table.infobox td',
		'.infobox td'
	];
	
	for (const selector of birthSelectors) {
		$(selector).each((_, el) => {
			const $el = $(el);
			const $prev = $el.prev('.infobox-label, th');
			const labelText = $prev.text().toLowerCase();
			
			if (labelText.includes('født') && !birthText) {
				birthText = $el.text().trim();
			}
		});
		
		if (birthText) break;
	}
	
	// If not found, try searching in the first paragraph
	if (!birthText) {
		const firstPara = $('.mw-parser-output > p').first().text();
		const birthMatchInPara = firstPara.match(/\(født.*?(\d{4})/i) || firstPara.match(/(\d{4})–/);
		if (birthMatchInPara) {
			birthYear = parseInt(birthMatchInPara[1], 10);
		}
	} else {
		const birthMatch = birthText.match(/(\d{4})/);
		if (birthMatch) {
			birthYear = parseInt(birthMatch[1], 10);
		}
	}
	
	// Extract death year
	let deathYear: number | null = null;
	let deathText = '';
	
	for (const selector of birthSelectors) {
		$(selector).each((_, el) => {
			const $el = $(el);
			const $prev = $el.prev('.infobox-label, th');
			const labelText = $prev.text().toLowerCase();
			
			if (labelText.includes('død') && !deathText) {
				deathText = $el.text().trim();
			}
		});
		
		if (deathText) break;
	}
	
	// If not found, try searching in summary or first paragraph
	if (!deathText) {
		const firstPara = $('.mw-parser-output > p').first().text();
		const deathMatchInPara = firstPara.match(/\(.*?(\d{4})–(\d{4})/);
		if (deathMatchInPara) {
			deathYear = parseInt(deathMatchInPara[2], 10);
		}
	} else {
		const deathMatch = deathText.match(/(\d{4})/);
		if (deathMatch) {
			deathYear = parseInt(deathMatch[1], 10);
		}
	}
	
	// Fallback: extract from summary text pattern like "(1863–1944)"
	if (!birthYear || !deathYear) {
		const summaryText = $('.mw-parser-output > p').first().text();
		const yearRangeMatch = summaryText.match(/\((\d{4})[^0-9]*(\d{4})/);
		if (yearRangeMatch) {
			if (!birthYear) birthYear = parseInt(yearRangeMatch[1], 10);
			if (!deathYear) deathYear = parseInt(yearRangeMatch[2], 10);
		}
	}
	
	// Extract summary (first 2-3 sentences from lead section)
	const leadParagraphs = $('.mw-parser-output > p').slice(0, 2);
	let summary = '';
	leadParagraphs.each((_, el) => {
		const text = $(el).text().trim();
		if (text) {
			summary += text + ' ';
		}
	});
	
	// Take first 2-3 sentences
	const sentences = summary.match(/[^.!?]+[.!?]+/g) || [];
	summary = sentences.slice(0, 3).join(' ').trim();
	
	// Extract occupations from infobox
	const occupations: string[] = [];
	
	// Check for "Yrke" or "Stilling" or "Nasjonalitet" field
	const occupationLabels = ['yrke', 'stilling', 'beskjeftigelse', 'occupation'];
	
	occupationLabels.forEach(label => {
		const occText = $('#infobox .infobox-data')
			.filter((_, el) => {
				const prev = $(el).prev('.infobox-label');
				return prev.text().toLowerCase().includes(label);
			})
			.first()
			.text()
			.trim();
		
		if (occText) {
			// Split by comma or line break
			const occs = occText.split(/[,\n]/).map(o => o.trim()).filter(Boolean);
			occupations.push(...occs.slice(0, 3));
		}
	});
	
	// Fallback: try to extract from categories or first paragraph
	if (occupations.length === 0) {
		// Try to infer from summary or categories
		const categories = $('.mw-normal-catlinks a').map((_, el) => $(el).text()).get();
		for (const cat of categories) {
			const lower = cat.toLowerCase();
			if (lower.includes('maler') || lower.includes('kunstner')) {
				occupations.push('Maler');
				break;
			}
			if (lower.includes('forfatter') || lower.includes('dikter')) {
				occupations.push('Forfatter');
				break;
			}
			if (lower.includes('politiker') || lower.includes('statsminister')) {
				occupations.push('Politiker');
				break;
			}
			if (lower.includes('fotball')) {
				occupations.push('Fotballspiller');
				break;
			}
		}
	}
	
	// Hardcoded fallbacks for known persons (always use for MVP)
	const knownPersons: Record<string, { birthYear: number; deathYear: number | null; occupations: string[] }> = {
		'edvard-munch': { birthYear: 1863, deathYear: 1944, occupations: ['Maler', 'Grafiker'] },
		'erling-braut-haaland': { birthYear: 2000, deathYear: null, occupations: ['Fotballspiller'] },
		'henrik-wergeland': { birthYear: 1808, deathYear: 1845, occupations: ['Forfatter', 'Dikter'] },
		'kare-willoch': { birthYear: 1928, deathYear: 2021, occupations: ['Politiker', 'Statsminister'] }
	};

	const knownPerson = knownPersons[person.id];
	if (knownPerson) {
		// Always use hardcoded values for known persons (more reliable)
		birthYear = knownPerson.birthYear;
		deathYear = knownPerson.deathYear;
		if (occupations.length === 0) {
			occupations.push(...knownPerson.occupations);
		}
	}
	
	// Additional fallback for known persons by name
	if (occupations.length === 0) {
		if (person.name.includes('Munch')) {
			occupations.push('Maler', 'Grafiker');
		} else if (person.name.includes('Haaland')) {
			occupations.push('Fotballspiller');
		} else if (person.name.includes('Wergeland')) {
			occupations.push('Forfatter', 'Dikter');
		} else if (person.name.includes('Willoch')) {
			occupations.push('Politiker', 'Statsminister');
		}
	}
	
	// Get color for primary occupation
	const primaryOccupation = occupations[0] || 'default';
	const color = getColorForOccupation(primaryOccupation);
	
	return {
		id: person.id,
		name: person.name,
		birthYear,
		deathYear,
		imageUrl: person.imageUrl,
		wikipediaUrl: person.wikipediaUrl,
		summary: summary || `${person.name} er en norsk person.`,
		occupations: occupations.slice(0, 3),
		color
	};
}

async function main() {
	console.log('Starting data fetch...');
	
	const results: PersonData[] = [];
	
	for (const person of people) {
		try {
			const data = await fetchPersonData(person);
			results.push(data);
			console.log(`✓ Fetched ${person.name}`);
		} catch (error) {
			console.error(`✗ Failed to fetch ${person.name}:`, error);
		}
	}
	
	// Write to JSON file
	const outputPath = join(process.cwd(), 'src', 'lib', 'data', 'people.json');
	writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
	
	console.log(`\n✓ Saved ${results.length} people to ${outputPath}`);
	console.log('\nPeople data:');
	results.forEach(p => {
		console.log(`  - ${p.name} (${p.birthYear}${p.deathYear ? `-${p.deathYear}` : '-'}) - ${p.occupations.join(', ')}`);
	});
}

main().catch(console.error);

