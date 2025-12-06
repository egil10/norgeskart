import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PEOPLE_FILE = join(process.cwd(), 'src', 'lib', 'data', 'people.json');

console.log('Reading people.json...');
const data = JSON.parse(readFileSync(PEOPLE_FILE, 'utf-8'));

console.log(`Original count: ${data.length} people`);

// Track seen IDs and merged data
const seen = new Map();
const duplicates = [];

for (const person of data) {
    const id = person.id;
    
    if (!id) {
        console.warn(`Warning: Found person without ID: ${person.name}`);
        continue;
    }
    
    if (seen.has(id)) {
        duplicates.push({ id, name: person.name, existing: seen.get(id).name });
        
        // Merge data: prefer more complete entries
        const existing = seen.get(id);
        const merged = {
            ...existing,
            // Prefer non-null values
            name: person.name || existing.name,
            birthYear: person.birthYear || existing.birthYear,
            deathYear: person.deathYear !== null ? person.deathYear : existing.deathYear,
            imageUrl: person.imageUrl || existing.imageUrl,
            wikipediaUrl: person.wikipediaUrl || existing.wikipediaUrl,
            summary: person.summary || existing.summary,
            // Merge occupations (unique)
            occupations: [...new Set([...(existing.occupations || []), ...(person.occupations || [])])],
            // Prefer non-default color
            color: (person.color && person.color !== '#999999' && person.color !== '#999') 
                ? person.color 
                : existing.color
        };
        
        seen.set(id, merged);
    } else {
        seen.set(id, { ...person });
    }
}

// Convert map to array
const cleaned = Array.from(seen.values());

console.log(`\nFound ${duplicates.length} duplicate entries:`);
if (duplicates.length > 0) {
    duplicates.slice(0, 10).forEach(dup => {
        console.log(`  - ${dup.name} (ID: ${dup.id}) - merged with ${dup.existing}`);
    });
    if (duplicates.length > 10) {
        console.log(`  ... and ${duplicates.length - 10} more`);
    }
}

console.log(`\nCleaned count: ${cleaned.length} people`);
console.log(`Removed: ${data.length - cleaned.length} duplicates`);

// Sort by birth year
cleaned.sort((a, b) => (a.birthYear || 0) - (b.birthYear || 0));

// Write back to file
console.log('\nWriting cleaned data to people.json...');
writeFileSync(PEOPLE_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');

console.log('✅ Done! Duplicates removed.');
