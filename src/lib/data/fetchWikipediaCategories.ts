import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';
import { getColorForOccupation } from '../config/colors.js';

interface WikiCategoryPerson {
    name: string;
    wikipediaUrl: string;
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

function log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
    console.log(`${colors.green}✓${colors.reset} ${colors.green}${message}${colors.reset}`);
}

function logError(message: string) {
    console.log(`${colors.red}✗${colors.reset} ${colors.red}${message}${colors.reset}`);
}

function logInfo(message: string) {
    console.log(`${colors.cyan}ℹ${colors.reset} ${colors.cyan}${message}${colors.reset}`);
}

function logWarning(message: string) {
    console.log(`${colors.yellow}⚠${colors.reset} ${colors.yellow}${message}${colors.reset}`);
}

async function fetchWikipediaCategory(categoryUrl: string): Promise<WikiCategoryPerson[]> {
    const people: WikiCategoryPerson[] = [];

    try {
        logInfo(`Fetching: ${categoryUrl}`);

        const response = await fetch(categoryUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Find all links in the category members section
        $('#mw-pages .mw-category-group li a').each((i, elem) => {
            const $link = $(elem);
            const name = $link.text().trim();
            const href = $link.attr('href');

            if (href && name) {
                const fullUrl = href.startsWith('http')
                    ? href
                    : `https://no.wikipedia.org${href}`;

                people.push({
                    name,
                    wikipediaUrl: fullUrl
                });
            }
        });

        logSuccess(`Found ${people.length} people in category`);

        // Check for "next page" link
        const nextPageLink = $('.mw-category-generated a:contains("neste side")').attr('href');
        if (nextPageLink) {
            const nextUrl = `https://no.wikipedia.org${nextPageLink}`;
            logInfo(`Fetching next page...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
            const nextPagePeople = await fetchWikipediaCategory(nextUrl);
            people.push(...nextPagePeople);
        }

    } catch (error: any) {
        logError(`Error fetching category: ${error.message}`);
    }

    return people;
}

async function fetchPersonDataFromWikidata(wikipediaUrl: string, personName: string): Promise<any | null> {
    try {
        // Extract page title from URL
        const match = wikipediaUrl.match(/\/wiki\/(.+)$/);
        if (!match) return null;

        const pageTitle = decodeURIComponent(match[1]).replace(/_/g, ' ');

        // Query Wikidata for this Wikipedia article
        const query = `
      SELECT ?person ?personLabel ?personDescription ?birth ?death ?image ?occLabel WHERE {
        ?article schema:about ?person ;
                 schema:isPartOf <https://no.wikipedia.org/> ;
                 schema:name "${pageTitle}"@no .
        
        ?person wdt:P31 wd:Q5.
        
        OPTIONAL { ?person wdt:P569 ?birth . }
        OPTIONAL { ?person wdt:P570 ?death . }
        OPTIONAL { ?person wdt:P18 ?image . }
        OPTIONAL { ?person wdt:P106 ?occ . }
        OPTIONAL { 
          ?occ rdfs:label ?occLabel 
          FILTER (lang(?occLabel) = "no" || lang(?occLabel) = "en") 
        }
        
        SERVICE wikibase:label { 
          bd:serviceParam wikibase:language "no,en". 
        }
      }
      LIMIT 10
    `;

        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json',
                'User-Agent': 'Norgeskart/1.0'
            }
        });

        if (!response.ok) {
            logWarning(`Wikidata query failed for ${personName}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const rows = data.results?.bindings || [];

        if (rows.length === 0) {
            logWarning(`No Wikidata found for ${personName}`);
            return null;
        }

        // Process the first result
        const row = rows[0];

        const birthYear = parseYear(row.birth?.value);
        const deathYear = parseYear(row.death?.value);

        // For Viking Age people, we might not have exact birth years
        // Use approximate dates if available
        if (birthYear === null) {
            logWarning(`No birth year for ${personName}, skipping`);
            return null;
        }

        // Collect all occupations from all rows
        const occupations = new Set<string>();
        rows.forEach((r: any) => {
            if (r.occLabel?.value) {
                occupations.add(r.occLabel.value);
            }
        });

        const occupationList = Array.from(occupations).slice(0, 5);
        const primaryOccupation = occupationList[0] || 'unknown';
        const color = getColorForOccupation(primaryOccupation);

        const personData = {
            id: row.person.value.split('/').pop(),
            name: row.personLabel?.value || personName,
            birthYear,
            deathYear,
            imageUrl: row.image?.value || null,
            wikipediaUrl,
            summary: row.personDescription?.value || `${personName} er en norsk person fra vikingtiden.`,
            occupations: occupationList,
            color
        };

        logSuccess(`✓ ${personName} (${birthYear}${deathYear ? `-${deathYear}` : ''})`);

        return personData;

    } catch (error: any) {
        logError(`Error fetching Wikidata for ${personName}: ${error.message}`);
        return null;
    }
}

function parseYear(dateString: string | undefined): number | null {
    if (!dateString) return null;
    const match = dateString.match(/(\+|-)? ?(\d{3,4})/);
    if (match) {
        const year = parseInt(match[2], 10);
        // Handle negative years (BCE)
        if (match[1] === '-') {
            return -year;
        }
        return year;
    }
    return null;
}

async function main() {
    const categories = [
        'https://no.wikipedia.org/wiki/Kategori:Personer_fra_vikingtiden',
        'https://no.wikipedia.org/wiki/Kategori:Norske_forfattere',
        'https://no.wikipedia.org/wiki/Kategori:Norske_sangere',
        'https://no.wikipedia.org/wiki/Kategori:Norske_musikere',
        'https://no.wikipedia.org/wiki/Kategori:Norske_oppdagere',
        'https://no.wikipedia.org/wiki/Kategori:Norske_langrennsløpere',
    ];

    const allPeople: any[] = [];
    const processedIds = new Set<string>();

    for (const categoryUrl of categories) {
        log(`\n${colors.bright}${colors.bgBlue} Processing Category ${colors.reset}\n`);

        // Fetch people from Wikipedia category
        const categoryPeople = await fetchWikipediaCategory(categoryUrl);

        logInfo(`Fetching Wikidata for ${categoryPeople.length} people...\n`);

        // Fetch Wikidata for each person
        for (let i = 0; i < categoryPeople.length; i++) {
            const person = categoryPeople[i];

            if (i % 5 === 0 && i > 0) {
                log(`  Progress: ${i}/${categoryPeople.length}`, colors.dim);
            }

            const wikidataData = await fetchPersonDataFromWikidata(person.wikipediaUrl, person.name);

            if (wikidataData && !processedIds.has(wikidataData.id)) {
                allPeople.push(wikidataData);
                processedIds.add(wikidataData.id);
            }

            // Rate limit - be nice to Wikidata
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

    // Sort by birth year
    allPeople.sort((a, b) => a.birthYear - b.birthYear);

    // Save results
    const outputFile = join(process.cwd(), 'src', 'lib', 'data', 'people-wikipedia-categories.temp.json');
    writeFileSync(outputFile, JSON.stringify(allPeople, null, 2), 'utf-8');

    log('');
    logSuccess(`Saved ${allPeople.length} people from Wikipedia categories`);

    if (allPeople.length > 0) {
        const withImages = allPeople.filter((p: any) => p.imageUrl).length;
        logInfo(`With images: ${withImages} (${((withImages / allPeople.length) * 100).toFixed(1)}%)`);
        logInfo(`Year range: ${allPeople[0].birthYear} - ${allPeople[allPeople.length - 1].birthYear}`);
    }

    log(`\nTo merge with existing data, run: npm run generate:data -- --merge\n`);
}

main().catch(console.error);
