export interface Person {
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

