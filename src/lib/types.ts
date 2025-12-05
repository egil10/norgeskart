export interface Person {
	id: string;
	name: string;
	birthYear: number;
	deathYear: number | null;
	imageUrl: string | null;
	wikipediaUrl: string | null;
	wikipediaSlug?: string;
	summary: string;
	occupations: string[];
	color: string;
	prominenceScore: number; // 1-100, higher = more famous
}
