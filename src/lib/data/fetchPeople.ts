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
const BATCH_SIZE = 5000;
const CHUNK_SIZE = 1000; // Smaller chunks for reliability
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

function saveState(state: FetchState) {
	writeFileSync(STATE_FILE, JSON.stringify({
		...state,
		processedIds: Array.from(state.processedIds),
		lastUpdate: new Date().toISOString()
	}, null, 2), 'utf-8');
}

function loadState(): FetchState | null {
	if (!existsSync(STATE_FILE)) return null;
	
	try {
		const data = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
		return {
			...data,
			processedIds: new Set(data.processedIds || [])
		};
	} catch {
		return null;
	}
}

function saveTempData(people: PersonData[]) {
	writeFileSync(TEMP_FILE, JSON.stringify(people, null, 2), 'utf-8');
}

function loadTempData(): PersonData[] {
	if (!existsSync(TEMP_FILE)) return [];
	
	try {
		return JSON.parse(readFileSync(TEMP_FILE, 'utf-8'));
	} catch {
		return [];
	}
}

function saveFinalData(people: PersonData[]) {
	writeFileSync(OUTPUT_FILE, JSON.stringify(people, null, 2), 'utf-8');
}

async function queryWikidata(offset = 0, limit = 1000, testMode = false): Promise<{ rows: SparqlRow[]; hasMore: boolean }> {
	let query: string;
	
	if (testMode) {
		query = `
			SELECT ?person ?personLabel ?personDescription ?birth ?death ?image ?occLabel ?article WHERE {
				?person wdt:P31 wd:Q5.
				?person wdt:P27 wd:Q20.
				?person wdt:P106 wd:Q937857.
				
				OPTIONAL { ?person wdt:P569 ?birth . }
				OPTIONAL { ?person wdt:P570 ?death . }
				OPTIONAL { ?person wdt:P18 ?image . }
				OPTIONAL { 
					?person wdt:P106 ?occ .
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

	const modeText = testMode ? `${colors.yellow}[TEST]${colors.reset} ` : '';
	log(`${colors.blue}→${colors.reset} ${modeText}Querying offset ${offset} (limit: ${limit})...`, colors.dim);
	
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

function extractImageUrl(imageValue: string | undefined): string | null {
	if (!imageValue) return null;
	
	let filename: string;
	
	if (imageValue.startsWith('http')) {
		if (imageValue.includes('/wiki/Special:FilePath/')) {
			filename = imageValue.split('/wiki/Special:FilePath/')[1].split('?')[0];
		} else if (imageValue.includes('/wiki/File:')) {
			filename = imageValue.split('/wiki/File:')[1].split('?')[0];
		} else {
			return imageValue;
		}
	} else {
		filename = decodeURIComponent(imageValue);
	}
	
	const encodedFilename = encodeURIComponent(filename);
	const firstChar = encodedFilename.charAt(0);
	const firstTwo = encodedFilename.substring(0, 2);
	
	return `https://upload.wikimedia.org/wikipedia/commons/${firstChar}/${firstTwo}/${encodedFilename}`;
}

function processRows(rows: SparqlRow[], existingPeople: Map<string, PersonData>): PersonData[] {
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
			
			if (birthYear === null) continue; // Skip persons without birth year
			
			personMap.set(personId, {
				id: personId,
				name: row.personLabel?.value || 'Unknown',
				birthYear,
				deathYear,
				imageUrl: extractImageUrl(row.image?.value),
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

async function main() {
	try {
		const startTime = Date.now();
		const testMode = process.argv.includes('--test') || process.argv.includes('-t');
		
		logHeader('🚀 Incremental Wikidata Fetch for Norgeskart');
		
		// Load existing state and data
		const state = loadState();
		const existingPeople = new Map<string, PersonData>();
		
		if (state) {
			logInfo(`Resuming from previous session:`);
			log(`  Last offset: ${state.lastOffset.toLocaleString()}`, colors.dim);
			log(`  Total rows fetched: ${state.totalRowsFetched.toLocaleString()}`, colors.dim);
			log(`  Processed persons: ${state.processedIds.size.toLocaleString()}`, colors.dim);
			log(`  Last update: ${new Date(state.lastUpdate).toLocaleString()}`, colors.dim);
			
			// Load existing temp data
			const tempData = loadTempData();
			tempData.forEach(p => existingPeople.set(p.id, p));
			logSuccess(`Loaded ${tempData.length.toLocaleString()} existing persons from temp file\n`);
		} else {
			logInfo(`Starting fresh fetch session\n`);
		}
		
		const currentState: FetchState = {
			lastOffset: state?.lastOffset || 0,
			processedIds: state?.processedIds || new Set(),
			totalRowsFetched: state?.totalRowsFetched || 0,
			lastUpdate: new Date().toISOString()
		};
		
		let offset = currentState.lastOffset;
		const limit = testMode ? 500 : CHUNK_SIZE;
		const maxRows = testMode ? 5000 : 50000; // Increased for full mode
		let consecutiveFailures = 0;
		const maxFailures = 3;
		let chunkCount = 0;
		const saveInterval = 5; // Save every 5 chunks
		
		log(`${colors.cyan}Fetching in chunks of ${limit} rows (max ${maxRows} total)${colors.reset}\n`);
		
		while (offset < maxRows && consecutiveFailures < maxFailures) {
			try {
				const { rows, hasMore } = await queryWikidata(offset, limit, testMode);
				
				if (rows.length === 0) {
					logWarning(`No more data at offset ${offset}`);
					break;
				}
				
				// Process rows and merge with existing
				const newPeople = processRows(rows, existingPeople);
				
				// Add to existing map
				newPeople.forEach(p => {
					if (!existingPeople.has(p.id)) {
						existingPeople.set(p.id, p);
						currentState.processedIds.add(p.id);
					}
				});
				
				chunkCount++;
				currentState.lastOffset = offset + rows.length;
				currentState.totalRowsFetched += rows.length;
				
				log(`  ${colors.dim}📊 Progress: ${currentState.processedIds.size.toLocaleString()} unique persons from ${currentState.totalRowsFetched.toLocaleString()} rows${colors.reset}\n`);
				
				// Save progress periodically
				if (chunkCount % saveInterval === 0 || !hasMore) {
					const allPeople = Array.from(existingPeople.values());
					allPeople.sort((a, b) => a.birthYear - b.birthYear);
					
					saveTempData(allPeople);
					saveState(currentState);
					
					logSuccess(`Progress saved: ${allPeople.length.toLocaleString()} persons (offset: ${currentState.lastOffset})\n`);
				}
				
				consecutiveFailures = 0; // Reset on success
				offset += rows.length;
				
				if (!hasMore) {
					logInfo('Reached end of data');
					break;
				}
				
				// Be nice to Wikidata servers
				await new Promise(resolve => setTimeout(resolve, 1500));
				
			} catch (error: any) {
				consecutiveFailures++;
				logError(`Chunk failed (attempt ${consecutiveFailures}/${maxFailures}): ${error.message}`);
				
				if (consecutiveFailures >= maxFailures) {
					logWarning(`\nToo many consecutive failures. Saving progress and stopping.`);
					logWarning(`Run the script again to continue from offset ${offset}`);
					break;
				}
				
				const backoffTime = 5000 * consecutiveFailures;
				logWarning(`Waiting ${backoffTime / 1000}s before retry...`);
				await new Promise(resolve => setTimeout(resolve, backoffTime));
			}
		}
		
		// Final save
		const allPeople = Array.from(existingPeople.values());
		allPeople.sort((a, b) => a.birthYear - b.birthYear);
		
		saveTempData(allPeople);
		saveFinalData(allPeople);
		saveState(currentState);
		
		const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
		const minYear = allPeople.length > 0 ? Math.min(...allPeople.map(p => p.birthYear)) : 0;
		const maxYear = allPeople.length > 0 ? Math.max(...allPeople.map(p => p.birthYear)) : 0;
		const withImages = allPeople.filter(p => p.imageUrl).length;
		const withOccupations = allPeople.filter(p => p.occupations.length > 0).length;
		const living = allPeople.filter(p => p.deathYear === null).length;
		
		console.log('\n' + '='.repeat(70));
		if (consecutiveFailures >= maxFailures) {
			log(`${colors.yellow}⚠ PARTIAL FETCH COMPLETE${colors.reset}`, colors.bright);
			logWarning(`Process stopped due to errors. Run again to continue.`);
		} else {
			log(`${colors.green}✓ FETCH COMPLETE${colors.reset}`, colors.bright);
		}
		console.log('='.repeat(70));
		console.log(`\n${colors.cyan}${colors.bright}Statistics:${colors.reset}`);
		console.log(`  ${colors.dim}⏱${colors.reset}  Time: ${colors.bright}${totalTime}s${colors.reset}`);
		console.log(`  ${colors.dim}📁${colors.reset}  Output: ${colors.dim}${OUTPUT_FILE}${colors.reset}`);
		console.log(`  ${colors.dim}💾${colors.reset}  Temp file: ${colors.dim}${TEMP_FILE}${colors.reset}`);
		console.log(`  ${colors.dim}📍${colors.reset}  Next offset: ${colors.cyan}${currentState.lastOffset}${colors.reset}`);
		console.log(`\n${colors.bright}📊 Dataset:${colors.reset}`);
		console.log(`  ${colors.dim}👥${colors.reset}  Persons: ${colors.bright}${allPeople.length.toLocaleString()}${colors.reset}`);
		console.log(`  ${colors.dim}📅${colors.reset}  Years: ${colors.cyan}${minYear}${colors.reset} ${colors.dim}–${colors.reset} ${colors.cyan}${maxYear}${colors.reset}`);
		console.log(`  ${colors.dim}🖼${colors.reset}  With images: ${colors.green}${withImages.toLocaleString()}${colors.reset} ${colors.dim}(${allPeople.length > 0 ? ((withImages / allPeople.length) * 100).toFixed(1) : 0}%)${colors.reset}`);
		console.log(`  ${colors.dim}💼${colors.reset}  With occupations: ${colors.green}${withOccupations.toLocaleString()}${colors.reset} ${colors.dim}(${allPeople.length > 0 ? ((withOccupations / allPeople.length) * 100).toFixed(1) : 0}%)${colors.reset}`);
		console.log(`  ${colors.dim}❤️${colors.reset}  Living: ${colors.yellow}${living.toLocaleString()}${colors.reset} ${colors.dim}(${allPeople.length > 0 ? ((living / allPeople.length) * 100).toFixed(1) : 0}%)${colors.reset}`);
		console.log('\n' + '='.repeat(70) + '\n');
		
		if (consecutiveFailures >= maxFailures) {
			logInfo(`💡 Tip: Run the script again to continue from where it stopped`);
			process.exit(0); // Exit gracefully
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
