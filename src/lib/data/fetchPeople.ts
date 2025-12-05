import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getColorForOccupation } from '../config/colors.js';

interface PersonData {
	id: string;
	name: string;
	birthYear: number;
	deathYear: number | null;
	imageUrl: string | null;
	wikipediaUrl: string | null;
	summary: string;
	occupations: string[];
	color: string;
}

interface SparqlRow {
	person: { value: string };
	personLabel: { value: string };
	personDescription?: { value: string };
	birth?: { value: string };
	death?: { value: string };
	image?: { value: string };
	occLabel?: { value: string };
	article?: { value: string };
}

interface FetchState {
	lastOffset: number;
	processedIds: Set<string>;
	totalRowsFetched: number;
	lastUpdate: string;
	category?: string;
}

const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
	bgBlue: '\x1b[44m',
	bgGreen: '\x1b[42m',
};

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 800;
const MAX_YEAR = CURRENT_YEAR;
const CHUNK_SIZE = 1000;

// Wikidata occupation Q-IDs by category
const OCCUPATION_IDS: Record<string, string[]> = {
	footballer: ['Q937857'], // association football player
	artist: ['Q1028181', 'Q42973'], // painter, artist
	writer: ['Q36180', 'Q49757'], // writer, author
	politician: ['Q82955'], // politician
	scientist: ['Q901'], // scientist
	musician: ['Q639669'], // musician
	business: ['Q43845'], // businessperson
	explorer: ['Q11900058'], // explorer
	actor: ['Q33999'], // actor
	military: ['Q47064'], // military personnel
	religious: ['Q42603'], // religious
	academic: ['Q3400985'], // academic
	engineer: ['Q81096'], // engineer
	athlete: ['Q2066131'], // athlete
};

const STATE_FILE = join(process.cwd(), 'src', 'lib', 'data', '.fetch-state.json');
const OUTPUT_FILE = join(process.cwd(), 'src', 'lib', 'data', 'people.json');
const TEMP_FILE = join(process.cwd(), 'src', 'lib', 'data', 'people.temp.json');

function log(message: string, color: string = colors.reset) {
	console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message: string) {
	console.log(`\n${colors.bright}${colors.bgBlue}${colors.white} ${message} ${colors.reset}\n`);
}

function logSuccess(message: string) {
	console.log(`${colors.green}✓${colors.reset} ${colors.green}${message}${colors.reset}`);
}

function logError(message: string) {
	console.log(`${colors.red}✗${colors.reset} ${colors.red}${message}${colors.reset}`);
}

function logWarning(message: string) {
	console.log(`${colors.yellow}⚠${colors.reset} ${colors.yellow}${message}${colors.reset}`);
}

function logInfo(message: string) {
	console.log(`${colors.cyan}ℹ${colors.reset} ${colors.cyan}${message}${colors.reset}`);
}

function getStateFile(category?: string): string {
	if (category) {
		return join(process.cwd(), 'src', 'lib', 'data', `.fetch-state-${category}.json`);
	}
	return STATE_FILE;
}

function getTempFile(category?: string): string {
	if (category) {
		return join(process.cwd(), 'src', 'lib', 'data', `people-${category}.temp.json`);
	}
	return TEMP_FILE;
}

function saveState(state: FetchState, category?: string) {
	const stateFile = getStateFile(category);
	writeFileSync(stateFile, JSON.stringify({
		...state,
		processedIds: Array.from(state.processedIds),
		lastUpdate: new Date().toISOString(),
		category
	}, null, 2), 'utf-8');
}

function loadState(category?: string): FetchState | null {
	const stateFile = getStateFile(category);
	if (!existsSync(stateFile)) return null;
	
	try {
		const data = JSON.parse(readFileSync(stateFile, 'utf-8'));
		return {
			...data,
			processedIds: new Set(data.processedIds || []),
			category: category || data.category
		};
	} catch {
		return null;
	}
}

function saveTempData(people: PersonData[], category?: string) {
	const tempFile = getTempFile(category);
	writeFileSync(tempFile, JSON.stringify(people, null, 2), 'utf-8');
}

function loadTempData(category?: string): PersonData[] {
	const tempFile = getTempFile(category);
	if (!existsSync(tempFile)) return [];
	
	try {
		return JSON.parse(readFileSync(tempFile, 'utf-8'));
	} catch {
		return [];
	}
}

function mergeAllCategoryData(): PersonData[] {
	const allPeople = new Map<string, PersonData>();
	
	// Load all category temp files
	for (const category of Object.keys(OCCUPATION_IDS)) {
		const categoryData = loadTempData(category);
		categoryData.forEach(p => {
			if (!allPeople.has(p.id)) {
				allPeople.set(p.id, p);
			} else {
				// Merge occupations
				const existing = allPeople.get(p.id)!;
				const mergedOccupations = [...new Set([...existing.occupations, ...p.occupations])];
				existing.occupations = mergedOccupations.slice(0, 5);
			}
		});
	}
	
	// Also load general temp file
	const generalData = loadTempData();
	generalData.forEach(p => {
		if (!allPeople.has(p.id)) {
			allPeople.set(p.id, p);
		}
	});
	
	return Array.from(allPeople.values());
}

function saveFinalData(people: PersonData[]) {
	writeFileSync(OUTPUT_FILE, JSON.stringify(people, null, 2), 'utf-8');
}

async function queryWikidata(
	offset = 0, 
	limit = 1000, 
	category?: string
): Promise<{ rows: SparqlRow[]; hasMore: boolean }> {
	let query: string;
	
	if (category && OCCUPATION_IDS[category]) {
		// Category-specific query - much faster!
		const occupationIds = OCCUPATION_IDS[category];
		const occupationFilter = occupationIds.map(id => `wd:${id}`).join(' || ');
		
		query = `
			SELECT ?person ?personLabel ?personDescription ?birth ?death ?image ?occLabel ?article WHERE {
				?person wdt:P31 wd:Q5.
				?person wdt:P27 wd:Q20.
				?person wdt:P106 ?occ.
				FILTER (?occ = ${occupationIds.map(id => `wd:${id}`).join(' || ?occ = ')}).
				
				OPTIONAL { ?person wdt:P569 ?birth . }
				OPTIONAL { ?person wdt:P570 ?death . }
				OPTIONAL { ?person wdt:P18 ?image . }
				OPTIONAL { 
					?occ rdfs:label ?occLabel 
					FILTER (lang(?occLabel) = "no" || lang(?occLabel) = "en") 
				}
				
				OPTIONAL {
					?article schema:about ?person ;
							 schema:inLanguage "no" .
				}
				
				SERVICE wikibase:label { 
					bd:serviceParam wikibase:language "no,en". 
				}
			}
			LIMIT ${limit}
			OFFSET ${offset}
		`;
	} else {
		// General query (all Norwegians)
		query = `
			SELECT ?person ?personLabel ?personDescription ?birth ?death ?image ?occLabel ?article WHERE {
				?person wdt:P31 wd:Q5.
				?person wdt:P27 wd:Q20.
				
				OPTIONAL { ?person wdt:P569 ?birth . }
				OPTIONAL { ?person wdt:P570 ?death . }
				OPTIONAL { ?person wdt:P18 ?image . }
				OPTIONAL { ?person wdt:P106 ?occ . }
				OPTIONAL { 
					?occ rdfs:label ?occLabel 
					FILTER (lang(?occLabel) = "no" || lang(?occLabel) = "en") 
				}
				
				OPTIONAL {
					?article schema:about ?person ;
							 schema:inLanguage "no" .
				}
				
				SERVICE wikibase:label { 
					bd:serviceParam wikibase:language "no,en". 
				}
			}
			LIMIT ${limit}
			OFFSET ${offset}
		`;
	}

	const categoryText = category ? `${colors.magenta}[${category.toUpperCase()}]${colors.reset} ` : '';
	log(`${colors.blue}→${colors.reset} ${categoryText}Querying offset ${offset} (limit: ${limit})...`, colors.dim);
	
	const startTime = Date.now();
	const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
	
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 45000);
		
		const response = await fetch(url, {
			headers: {
				'Accept': 'application/sparql-results+json',
				'User-Agent': 'Norgeskart/1.0 (https://github.com/your-repo)'
			},
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			if (response.status === 504) {
				throw new Error(`Gateway Timeout (504)`);
			}
			throw new Error(`Query failed: ${response.statusText} (${response.status})`);
		}

		const data = await response.json();
		const rows = data.results?.bindings || [];
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		
		logSuccess(`Got ${colors.bright}${rows.length}${colors.reset}${colors.green} rows in ${elapsed}s`);
		
		return {
			rows,
			hasMore: rows.length === limit
		};
	} catch (error: any) {
		if (error.name === 'AbortError') {
			throw new Error('Request timeout after 45 seconds');
		}
		logError(`Error: ${error.message}`);
		throw error;
	}
}

function parseYear(dateString: string | undefined): number | null {
	if (!dateString) return null;
	const match = dateString.match(/(\+|-)?(\d{4})/);
	if (match) {
		return parseInt(match[2], 10);
	}
	return null;
}

async function extractImageUrl(imageValue: string | undefined): Promise<string | null> {
	if (!imageValue) return null;
	
	let filename: string;
	let directoryPath: string | null = null;
	
	if (imageValue.includes('http')) {
		// Extract filename from various URL formats
		if (imageValue.includes('/wiki/Special:FilePath/')) {
			filename = decodeURIComponent(imageValue.split('/wiki/Special:FilePath/')[1].split('?')[0]);
		} else if (imageValue.includes('/wiki/File:')) {
			filename = decodeURIComponent(imageValue.split('/wiki/File:')[1].split('?')[0]);
		} else if (imageValue.includes('upload.wikimedia.org')) {
			// Already a direct Commons URL - extract the actual path
			const urlMatch = imageValue.match(/upload\.wikimedia\.org\/wikipedia\/commons\/(thumb\/)?(.+)/);
			if (urlMatch) {
				const pathAfterCommons = urlMatch[2];
				
				// Check if it's a thumbnail URL (contains /thumb/ and /200px- or similar)
				if (pathAfterCommons.startsWith('thumb/')) {
					// Extract the directory path (before the filename) and filename
					// Format: thumb/X/Xy/Filename.ext/200px-Filename.ext
					const parts = pathAfterCommons.replace(/^thumb\//, '').split('/');
					const lastPart = parts[parts.length - 1];
					
					// Remove thumbnail size prefix (e.g., "200px-")
					const actualFilename = lastPart.replace(/^\d+px-/, '');
					
					// IMPORTANT: Don't trust the directory path in thumbnail URLs
					// Commons uses MD5 hashing, and thumbnail URLs may have wrong paths
					// Extract just the filename and let it fall through to filename-based construction
					filename = actualFilename;
					directoryPath = null; // Force re-construction from filename
				} else {
					// Full resolution URL - extract directory and filename
					const parts = pathAfterCommons.split('/');
					filename = parts[parts.length - 1];
					// For full URLs, trust the directory path
					directoryPath = parts.slice(0, -1).join('/');
				}
			} else {
				return null;
			}
		} else {
			return null;
		}
	} else {
		// Just filename (raw P18 value)
		filename = decodeURIComponent(imageValue);
	}
	
	// Clean filename - decode URL encoding and normalize
	filename = decodeURIComponent(filename).replace(/\s/g, '_').replace(/^_+|_+$/g, '');
	if (!filename) return null;
	
	// If we have a directory path from a full URL (not thumbnail), use it
	if (directoryPath && !imageValue?.includes('/thumb/')) {
		return `https://upload.wikimedia.org/wikipedia/commons/${directoryPath}/${encodeURIComponent(filename)}`;
	}
	
	// For thumbnail URLs or raw filenames, use MediaWiki API to get correct URL
	// This ensures we get the right MD5-based directory structure
	try {
		const imageUrl = await resolveImageUrl(filename);
		if (imageUrl) return imageUrl;
	} catch (error) {
		// Silently fail - will use fallback
	}
	
	// Fallback: construct using Special:FilePath (may redirect, but should work)
	const encodedFilename = encodeURIComponent(filename);
	return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedFilename}`;
}

// Resolve filename to actual Commons image URL using MediaWiki API
async function resolveImageUrl(filename: string): Promise<string | null> {
	try {
		const apiUrl = `https://commons.wikimedia.org/w/api.php?` +
			`action=query&` +
			`titles=File:${encodeURIComponent(filename)}&` +
			`prop=imageinfo&` +
			`iiprop=url&` +
			`format=json&` +
			`origin=*`;
		
		const response = await fetch(apiUrl, {
			headers: {
				'User-Agent': 'Norgeskart/1.0 (https://github.com/your-repo)'
			}
		});
		
		if (!response.ok) return null;
		
		const data = await response.json();
		const pages = data.query?.pages;
		if (!pages) return null;
		
		const pageId = Object.keys(pages)[0];
		const page = pages[pageId];
		const imageinfo = page?.imageinfo?.[0];
		
		if (imageinfo?.url) {
			return imageinfo.url;
		}
	} catch (error) {
		// Fail silently
	}
	
	return null;
}

async function processRows(rows: SparqlRow[], existingPeople: Map<string, PersonData>): Promise<PersonData[]> {
	const personMap = new Map<string, {
		id: string;
		name: string;
		birthYear: number | null;
		deathYear: number | null;
		imageUrl: string | null;
		wikipediaUrl: string | null;
		summary: string;
		occupations: Set<string>;
	}>();
	
	for (const row of rows) {
		const personId = row.person.value.split('/').pop() || '';
		
		if (!personMap.has(personId) && !existingPeople.has(personId)) {
			const birthYear = parseYear(row.birth?.value);
			const deathYear = parseYear(row.death?.value);
			
			if (birthYear !== null && (birthYear < MIN_YEAR || birthYear > MAX_YEAR)) {
				continue;
			}
			
			if (birthYear === null) continue;
			
			personMap.set(personId, {
				id: personId,
				name: row.personLabel?.value || 'Unknown',
				birthYear,
				deathYear,
				imageUrl: await extractImageUrl(row.image?.value),
				wikipediaUrl: row.article?.value || null,
				summary: row.personDescription?.value || '',
				occupations: new Set()
			});
		}
		
		const person = personMap.get(personId);
		if (person && row.occLabel?.value) {
			person.occupations.add(row.occLabel.value);
		}
	}
	
	const newPeople: PersonData[] = [];
	
	for (const [id, data] of personMap.entries()) {
		const occupations = Array.from(data.occupations).slice(0, 5);
		const primaryOccupation = occupations[0] || 'unknown';
		const color = getColorForOccupation(primaryOccupation);
		
		newPeople.push({
			id: data.id,
			name: data.name,
			birthYear: data.birthYear!,
			deathYear: data.deathYear,
			imageUrl: data.imageUrl,
			wikipediaUrl: data.wikipediaUrl,
			summary: data.summary || `${data.name} er en norsk person.`,
			occupations,
			color
		});
	}
	
	return newPeople;
}

async function fetchCategory(category?: string) {
	const startTime = Date.now();
	
	const categoryLabel = category ? category.toUpperCase() : 'ALL';
	logHeader(`🎯 Fetching: ${categoryLabel}`);
	
	const state = loadState(category);
	const existingPeople = new Map<string, PersonData>();
	
	if (state) {
		logInfo(`Resuming from previous session:`);
		log(`  Last offset: ${state.lastOffset.toLocaleString()}`, colors.dim);
		log(`  Total rows: ${state.totalRowsFetched.toLocaleString()}`, colors.dim);
		log(`  Persons: ${state.processedIds.size.toLocaleString()}`, colors.dim);
		
		const tempData = loadTempData(category);
		tempData.forEach(p => existingPeople.set(p.id, p));
		logSuccess(`Loaded ${tempData.length.toLocaleString()} existing persons\n`);
	}
	
	const currentState: FetchState = {
		lastOffset: state?.lastOffset || 0,
		processedIds: state?.processedIds || new Set(),
		totalRowsFetched: state?.totalRowsFetched || 0,
		lastUpdate: new Date().toISOString(),
		category
	};
	
	let offset = currentState.lastOffset;
	const maxRows = 50000;
	let consecutiveFailures = 0;
	const maxFailures = 3;
	let chunkCount = 0;
	
	log(`${colors.cyan}Fetching in chunks of ${CHUNK_SIZE} rows${colors.reset}\n`);
	
	while (offset < maxRows && consecutiveFailures < maxFailures) {
		try {
			const { rows, hasMore } = await queryWikidata(offset, CHUNK_SIZE, category);
			
			if (rows.length === 0) {
				logWarning(`No more data at offset ${offset}`);
				break;
			}
			
			const newPeople = await processRows(rows, existingPeople);
			newPeople.forEach(p => {
				if (!existingPeople.has(p.id)) {
					existingPeople.set(p.id, p);
					currentState.processedIds.add(p.id);
				}
			});
			
			chunkCount++;
			currentState.lastOffset = offset + rows.length;
			currentState.totalRowsFetched += rows.length;
			
			log(`  ${colors.dim}📊 ${currentState.processedIds.size.toLocaleString()} persons (offset: ${currentState.lastOffset})${colors.reset}\n`);
			
			if (chunkCount % 3 === 0 || !hasMore) {
				const allPeople = Array.from(existingPeople.values());
				allPeople.sort((a, b) => a.birthYear - b.birthYear);
				saveTempData(allPeople, category);
				saveState(currentState, category);
				logSuccess(`Progress saved: ${allPeople.length.toLocaleString()} persons\n`);
			}
			
			consecutiveFailures = 0;
			offset += rows.length;
			
			if (!hasMore) {
				logInfo('Reached end of data');
				break;
			}
			
			await new Promise(resolve => setTimeout(resolve, 1500));
			
		} catch (error: any) {
			consecutiveFailures++;
			logError(`Failed (${consecutiveFailures}/${maxFailures}): ${error.message}`);
			
			if (consecutiveFailures >= maxFailures) {
				const allPeople = Array.from(existingPeople.values());
				allPeople.sort((a, b) => a.birthYear - b.birthYear);
				saveTempData(allPeople, category);
				saveState(currentState, category);
				logWarning(`\nStopped due to errors. Progress saved. Run again to continue.`);
				return;
			}
			
			await new Promise(resolve => setTimeout(resolve, 5000 * consecutiveFailures));
		}
	}
	
	const allPeople = Array.from(existingPeople.values());
	allPeople.sort((a, b) => a.birthYear - b.birthYear);
	saveTempData(allPeople, category);
	saveState(currentState, category);
	
	const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
	logSuccess(`${categoryLabel}: ${allPeople.length.toLocaleString()} persons in ${totalTime}s`);
}

async function main() {
	try {
		// Parse command line args
		const args = process.argv.slice(2);
		
		// Debug: log all arguments
		if (args.length > 0) {
			logInfo(`Arguments received: ${args.join(', ')}`);
		}
		
		// Handle --category=value or --category value
		let category: string | undefined;
		
		// Try to find category argument
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			if (arg === '--category' && i + 1 < args.length) {
				category = args[i + 1];
				break;
			} else if (arg.startsWith('--category=')) {
				// Handle --category=value format
				category = arg.substring('--category='.length);
				break;
			} else if (arg.includes('--category=')) {
				// Fallback: handle if format is slightly different
				const parts = arg.split('--category=');
				if (parts.length > 1) {
					category = parts[1];
					break;
				}
			}
		}
		
		// Clean up category if it was incorrectly parsed
		if (category && category.startsWith('--category=')) {
			category = category.substring('--category='.length);
		}
		
		const merge = args.includes('--merge');
		const listCategories = args.includes('--list') || args.includes('--categories');
		
		if (listCategories) {
			console.log('\n📋 Available categories:\n');
			Object.keys(OCCUPATION_IDS).forEach(cat => {
				console.log(`  • ${colors.cyan}${cat}${colors.reset}`);
			});
			console.log('\nUsage: npm run generate:data -- --category=<category>\n');
			return;
		}
		
		if (merge) {
			logHeader('🔀 Merging All Category Data');
			const allPeople = mergeAllCategoryData();
			allPeople.sort((a, b) => a.birthYear - b.birthYear);
			saveFinalData(allPeople);
			
			const withImages = allPeople.filter(p => p.imageUrl).length;
			logSuccess(`Merged ${allPeople.length.toLocaleString()} total persons`);
			logInfo(`With images: ${withImages.toLocaleString()} (${((withImages / allPeople.length) * 100).toFixed(1)}%)`);
			return;
		}
		
		if (category) {
			if (!OCCUPATION_IDS[category]) {
				logError(`Unknown category: ${category}`);
				logInfo(`Use --list to see available categories`);
				process.exit(1);
			}
			await fetchCategory(category);
		} else {
			// Fetch all (general query) - pass undefined to indicate no category filter
			logHeader('🌍 Fetching All Notable Norwegians');
			logWarning('This may be slow. Consider using --category=<category> for faster results.');
			logInfo('Use --list to see available categories\n');
			await fetchCategory(undefined);
		}
		
	} catch (error) {
		log(`\n${colors.bright}${colors.red}FATAL ERROR${colors.reset}`, colors.bright);
		logError(`${error}`);
		if (error instanceof Error && error.stack) {
			console.log(`\n${colors.dim}${error.stack}${colors.reset}`);
		}
		process.exit(1);
	}
}

main();
