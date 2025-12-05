import { writeFileSync } from 'fs';
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

// ANSI color codes for terminal output
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
	bgYellow: '\x1b[43m',
	bgRed: '\x1b[41m'
};

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 800;
const MAX_YEAR = CURRENT_YEAR;
const BATCH_SIZE = 5000;

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

function logProgress(current: number, total: number, label: string) {
	const percent = ((current / total) * 100).toFixed(1);
	const barLength = 30;
	const filled = Math.round((current / total) * barLength);
	const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
	process.stdout.write(
		`\r${colors.cyan}[${bar}]${colors.reset} ${colors.bright}${percent}%${colors.reset} ${colors.dim}${label}${colors.reset}`
	);
	if (current === total) console.log(); // New line when complete
}

async function queryWikidata(offset = 0, limit = 1000, testMode = false): Promise<{ rows: SparqlRow[]; hasMore: boolean }> {
	let query: string;
	
	if (testMode) {
		// Test query: Only Norwegian footballers (simpler, faster)
		query = `
			SELECT ?person ?personLabel ?personDescription ?birth ?death ?image ?occLabel ?article WHERE {
				?person wdt:P31 wd:Q5.              # human
				?person wdt:P27 wd:Q20.             # citizenship = Norway
				?person wdt:P106 wd:Q937857.        # occupation = association football player
				
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
		// Full query: All notable Norwegians
		query = `
			SELECT ?person ?personLabel ?personDescription ?birth ?death ?image ?occLabel ?article WHERE {
				?person wdt:P31 wd:Q5.              # human
				?person wdt:P27 wd:Q20.             # citizenship = Norway
				
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

	const modeText = testMode ? `${colors.yellow}[TEST MODE: Footballers Only]${colors.reset} ` : '';
	log(`${colors.blue}→${colors.reset} Querying Wikidata SPARQL endpoint ${modeText}(offset: ${offset}, limit: ${limit})...`, colors.dim);
	
	const startTime = Date.now();
	const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
	
	try {
		// Add timeout controller
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout
		
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
				throw new Error(`Gateway Timeout (504) - Query too complex`);
			}
			throw new Error(`Query failed: ${response.statusText} (${response.status})`);
		}

		const data = await response.json();
		const rows = data.results?.bindings || [];
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		
		logSuccess(`Retrieved ${colors.bright}${rows.length}${colors.reset}${colors.green} rows in ${elapsed}s`);
		
		return {
			rows,
			hasMore: rows.length === limit
		};
	} catch (error: any) {
		if (error.name === 'AbortError') {
			throw new Error('Request timeout after 45 seconds');
		}
		logError(`Error querying Wikidata: ${error.message}`);
		throw error;
	}
}

function parseYear(dateString: string | undefined): number | null {
	if (!dateString) return null;
	
	// Wikidata dates are in format: "+1863-12-12T00:00:00Z"
	const match = dateString.match(/(\+|-)?(\d{4})/);
	if (match) {
		const year = parseInt(match[2], 10);
		return year;
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

function processBatch(
	rows: SparqlRow[],
	personMap: Map<string, {
		id: string;
		name: string;
		birthYear: number | null;
		deathYear: number | null;
		imageUrl: string | null;
		wikipediaUrl: string | null;
		summary: string;
		occupations: Set<string>;
	}>,
	batchIndex: number,
	totalBatches: number
): void {
	logProgress(batchIndex + 1, totalBatches, 'Processing batches');
	
	for (const row of rows) {
		const personId = row.person.value.split('/').pop() || '';
		
		if (!personMap.has(personId)) {
			const birthYear = parseYear(row.birth?.value);
			const deathYear = parseYear(row.death?.value);
			
			if (birthYear !== null) {
				if (birthYear < MIN_YEAR || birthYear > MAX_YEAR) {
					continue;
				}
			}
			
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
		
		const person = personMap.get(personId)!;
		
		if (row.occLabel?.value) {
			person.occupations.add(row.occLabel.value);
		}
	}
}

function processSparqlResults(allRows: SparqlRow[]): PersonData[] {
	log(`\n${colors.bright}Processing ${allRows.length.toLocaleString()} SPARQL rows...${colors.reset}`);
	
	const startTime = Date.now();
	
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
	
	const batches = Math.ceil(allRows.length / BATCH_SIZE);
	for (let i = 0; i < batches; i++) {
		const start = i * BATCH_SIZE;
		const end = Math.min(start + BATCH_SIZE, allRows.length);
		const batch = allRows.slice(start, end);
		processBatch(batch, personMap, i, batches);
	}
	
	logSuccess(`Processed ${colors.bright}${personMap.size.toLocaleString()}${colors.reset}${colors.green} unique persons`);
	
	log(`\n${colors.cyan}Converting to final format...${colors.reset}`);
	let processed = 0;
	const people: PersonData[] = [];
	const total = personMap.size;
	
	for (const [id, data] of personMap.entries()) {
		if (data.birthYear === null) {
			processed++;
			continue;
		}
		
		const occupations = Array.from(data.occupations).slice(0, 5);
		const primaryOccupation = occupations[0] || 'unknown';
		const color = getColorForOccupation(primaryOccupation);
		
		people.push({
			id: data.id,
			name: data.name,
			birthYear: data.birthYear,
			deathYear: data.deathYear,
			imageUrl: data.imageUrl,
			wikipediaUrl: data.wikipediaUrl,
			summary: data.summary || `${data.name} er en norsk person.`,
			occupations,
			color
		});
		
		processed++;
		if (processed % 1000 === 0) {
			logProgress(processed, total, 'Converting persons');
		}
	}
	
	logProgress(processed, total, 'Converting persons');
	
	log(`\n${colors.cyan}Sorting by birth year...${colors.reset}`);
	people.sort((a, b) => a.birthYear - b.birthYear);
	
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	logSuccess(`Processed ${colors.bright}${people.length.toLocaleString()}${colors.reset}${colors.green} persons in ${elapsed}s`);
	
	return people;
}

async function fetchAllData(testMode = false): Promise<SparqlRow[]> {
	const allRows: SparqlRow[] = [];
	let offset = 0;
	const limit = testMode ? 500 : 1000; // Smaller for test mode
	let hasMore = true;
	let attempt = 0;
	const maxAttempts = 3;
	const maxRows = testMode ? 5000 : 20000;

	const modeText = testMode ? `${colors.yellow}[TEST MODE]${colors.reset} ` : '';
	log(`${colors.blue}Fetching data ${modeText}in chunks of ${limit} rows (max ${maxRows} total)...${colors.reset}\n`);

	while (hasMore && attempt < maxAttempts && allRows.length < maxRows) {
		try {
			const currentLimit = Math.min(limit, maxRows - allRows.length);
			
			const { rows, hasMore: more } = await queryWikidata(offset, currentLimit, testMode);
			
			if (rows.length === 0) {
				hasMore = false;
				break;
			}
			
			allRows.push(...rows);
			hasMore = more && allRows.length < maxRows;
			offset += rows.length;
			attempt = 0;
			
			log(`${colors.dim}  📊 Total fetched: ${colors.bright}${colors.cyan}${allRows.length.toLocaleString()}${colors.reset}${colors.dim} rows${colors.reset}\n`);
			
			if (hasMore) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		} catch (error: any) {
			attempt++;
			
			if (error.message?.includes('timeout') || error.message?.includes('504')) {
				logWarning(`Timeout detected. Reducing chunk size for next attempt...`);
				offset = allRows.length;
			}
			
			if (attempt >= maxAttempts) {
				logWarning(`Max retry attempts reached. Continuing with ${allRows.length.toLocaleString()} rows...`);
				logWarning(`This is likely due to Wikidata query complexity/timeout limits.`);
				logInfo(`The partial dataset will still be processed.\n`);
				break;
			}
			
			const backoffTime = 3000 * attempt;
			logWarning(`Retry attempt ${colors.bright}${attempt}/${maxAttempts}${colors.reset}${colors.yellow} in ${backoffTime / 1000}s...`);
			await new Promise(resolve => setTimeout(resolve, backoffTime));
		}
	}

	if (allRows.length === 0) {
		throw new Error('No data retrieved from Wikidata after all attempts');
	}

	return allRows;
}

async function main() {
	try {
		const startTime = Date.now();
		
		// Check for test mode flag
		const testMode = process.argv.includes('--test') || process.argv.includes('-t');
		
		logHeader('🚀 Starting Wikidata data fetch for Norgeskart');
		
		if (testMode) {
			log(`${colors.yellow}${colors.bright}TEST MODE ENABLED${colors.reset} ${colors.dim}- Fetching only Norwegian footballers for faster testing${colors.reset}`);
			log(`${colors.dim}Run without --test flag for full dataset${colors.reset}\n`);
		} else {
			log(`${colors.dim}💡 Tip: Add ${colors.bright}--test${colors.reset}${colors.dim} flag to fetch only footballers for faster testing${colors.reset}\n`);
		}
		
		const allRows = await fetchAllData(testMode);
		
		if (allRows.length === 0) {
			throw new Error('No data retrieved from Wikidata');
		}
		
		log(`\n${colors.bright}${colors.green}Successfully retrieved ${allRows.length.toLocaleString()} total rows${colors.reset}\n`);
		
		const people = processSparqlResults(allRows);
		
		if (people.length === 0) {
			throw new Error('No valid persons after processing');
		}
		
		log(`\n${colors.blue}Writing to file...${colors.reset}`);
		const outputPath = join(process.cwd(), 'src', 'lib', 'data', 'people.json');
		writeFileSync(outputPath, JSON.stringify(people, null, 2), 'utf-8');
		
		// Statistics
		const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
		const minYear = Math.min(...people.map(p => p.birthYear));
		const maxYear = Math.max(...people.map(p => p.birthYear));
		const withImages = people.filter(p => p.imageUrl).length;
		const withOccupations = people.filter(p => p.occupations.length > 0).length;
		const living = people.filter(p => p.deathYear === null).length;
		
		console.log('\n' + '='.repeat(70));
		log(`${colors.bright}${colors.green}✓ DATA GENERATION COMPLETE${colors.reset}`, colors.bright);
		console.log('='.repeat(70));
		console.log(`\n${colors.cyan}${colors.bright}Statistics:${colors.reset}`);
		console.log(`  ${colors.dim}⏱${colors.reset}  Total time: ${colors.bright}${totalTime}s${colors.reset}`);
		console.log(`  ${colors.dim}📁${colors.reset}  Output: ${colors.dim}${outputPath}${colors.reset}`);
		console.log(`\n${colors.bright}📊 Dataset Info:${colors.reset}`);
		console.log(`  ${colors.dim}👥${colors.reset}  Total persons: ${colors.bright}${people.length.toLocaleString()}${colors.reset}`);
		console.log(`  ${colors.dim}📅${colors.reset}  Year range: ${colors.cyan}${minYear}${colors.reset} ${colors.dim}-${colors.reset} ${colors.cyan}${maxYear}${colors.reset}`);
		console.log(`  ${colors.dim}🖼${colors.reset}  With images: ${colors.green}${withImages.toLocaleString()}${colors.reset} ${colors.dim}(${((withImages / people.length) * 100).toFixed(1)}%)${colors.reset}`);
		console.log(`  ${colors.dim}💼${colors.reset}  With occupations: ${colors.green}${withOccupations.toLocaleString()}${colors.reset} ${colors.dim}(${((withOccupations / people.length) * 100).toFixed(1)}%)${colors.reset}`);
		console.log(`  ${colors.dim}❤️${colors.reset}  Living: ${colors.yellow}${living.toLocaleString()}${colors.reset} ${colors.dim}(${((living / people.length) * 100).toFixed(1)}%)${colors.reset}`);
		console.log(`  ${colors.dim}⚰️${colors.reset}  Deceased: ${colors.dim}${(people.length - living).toLocaleString()}${colors.reset}`);
		console.log('\n' + '='.repeat(70) + '\n');
		
	} catch (error) {
		log(`\n${colors.bright}${colors.bgRed} FATAL ERROR ${colors.reset}`, colors.bright);
		logError(`${error}`);
		if (error instanceof Error && error.stack) {
			console.log(`\n${colors.dim}${error.stack}${colors.reset}`);
		}
		process.exit(1);
	}
}

main();
