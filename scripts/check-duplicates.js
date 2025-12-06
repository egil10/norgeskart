import { readFileSync } from 'fs';
import { join } from 'path';

const PEOPLE_FILE = join(process.cwd(), 'src', 'lib', 'data', 'people.json');

try {
    console.log('Reading people.json...');
    const data = JSON.parse(readFileSync(PEOPLE_FILE, 'utf-8'));
    
    console.log(`Total entries: ${data.length}`);
    
    const ids = new Map();
    const duplicates = [];
    
    for (const person of data) {
        const id = person.id;
        if (!id) {
            console.warn(`Person without ID: ${person.name}`);
            continue;
        }
        
        if (ids.has(id)) {
            duplicates.push({ id, name: person.name, firstSeen: ids.get(id) });
        } else {
            ids.set(id, person.name);
        }
    }
    
    console.log(`\nUnique IDs: ${ids.size}`);
    console.log(`Duplicates found: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
        console.log('\nFirst 10 duplicates:');
        duplicates.slice(0, 10).forEach(dup => {
            console.log(`  - ${dup.name} (ID: ${dup.id}) - also seen as: ${dup.firstSeen}`);
        });
    }
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
