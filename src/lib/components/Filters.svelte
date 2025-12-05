<script lang="ts">
	import type { Person } from '../types';
	import { allOccupations } from '../config/occupations';
	import { getOccupationCategory } from '../config/colors';
	import { onMount } from 'svelte';

	export let people: Person[] = [];
	export let onFiltered: (filtered: Person[]) => void = () => {};
	export let searchQuery: string = '';

	let selectedOccupations: Set<string> = new Set(allOccupations);
	let yearRange: [number, number] = [1500, new Date().getFullYear()];
	let onlyLiving = false;
	let onlyWithImages = false;
	let filteredCount = people.length;

	let minYear = 1500;
	let maxYear = new Date().getFullYear();

	// Fuse.js for fuzzy search (client-side only)
	let Fuse: any = null;
	let fuse: any = null;

	onMount(async () => {
		if (typeof window === 'undefined') return;
		
		try {
			const fuseModulePath = 'fuse.js';
			const FuseModule = await import(/* @vite-ignore */ fuseModulePath);
			Fuse = FuseModule.default || FuseModule;
			if (people.length > 0 && Fuse) {
				fuse = new Fuse(people, {
					keys: ['name', 'occupations', 'summary'],
					threshold: 0.4,
					includeScore: true
				});
			}
		} catch (e) {
			console.warn('Fuse.js not available, falling back to simple search', e);
		}
	});

	$: {
		if (people.length > 0) {
			const years = people.map(p => p.birthYear);
			minYear = Math.min(...years);
			maxYear = Math.max(...years, new Date().getFullYear());
			if (yearRange[0] < minYear) yearRange = [minYear, yearRange[1]];
			if (yearRange[1] > maxYear) yearRange = [yearRange[0], maxYear];

			if (Fuse && !fuse && typeof window !== 'undefined') {
				fuse = new Fuse(people, {
					keys: ['name', 'occupations', 'summary'],
					threshold: 0.4,
					includeScore: true
				});
			}
		}
	}

	$: {
		let result = people.filter((person) => {
			if (selectedOccupations.size === 0) return false;
			
			const personOccupations = person.occupations.map(occ => 
				getOccupationCategory(occ)
			);
			
			return personOccupations.some(occ => selectedOccupations.has(occ));
		});

		result = result.filter((person) => {
			const endYear = person.deathYear || new Date().getFullYear();
			return (
				person.birthYear <= yearRange[1] &&
				endYear >= yearRange[0]
			);
		});

		if (searchQuery.trim()) {
			if (fuse) {
				const searchResults = fuse.search(searchQuery);
				const searchIds = new Set(searchResults.map(r => r.item.id));
				result = result.map(p => {
					if (searchIds.has(p.id)) {
						return {
							...p,
							prominenceScore: Math.min(100, p.prominenceScore + 20)
						};
					}
					return p;
				}).filter(p => {
					return searchIds.has(p.id) || result.includes(p);
				});
				const relevanceMap = new Map(searchResults.map(r => [r.item.id, r.score || 1]));
				result.sort((a, b) => {
					const aScore = relevanceMap.get(a.id) || 1;
					const bScore = relevanceMap.get(b.id) || 1;
					return aScore - bScore;
				});
			} else {
				const query = searchQuery.toLowerCase().trim();
				result = result.filter(p => {
					return p.name.toLowerCase().includes(query) ||
						p.occupations.some(occ => occ.toLowerCase().includes(query)) ||
						p.summary.toLowerCase().includes(query);
				});
			}
		}

		if (onlyLiving) {
			result = result.filter((person) => person.deathYear === null);
		}

		if (onlyWithImages) {
			result = result.filter((person) => person.imageUrl !== null);
		}

		filteredCount = result.length;
		onFiltered(result);
	}

	function toggleOccupation(occupation: string) {
		if (selectedOccupations.has(occupation)) {
			selectedOccupations.delete(occupation);
		} else {
			selectedOccupations.add(occupation);
		}
		selectedOccupations = new Set(selectedOccupations);
	}

	function updateYearRange(index: number, value: number) {
		const newRange: [number, number] = [...yearRange];
		newRange[index] = Math.max(minYear, Math.min(maxYear, value));
		if (newRange[0] > newRange[1]) {
			newRange[1] = newRange[0];
		}
		yearRange = newRange;
	}

	const occupationLabels: Record<string, string> = {
		artist: 'Kunstner',
		writer: 'Forfatter',
		politician: 'Politiker',
		scientist: 'Forsker',
		athlete: 'Idrettsutøver',
		musician: 'Musiker',
		business: 'Forretningsmann',
		explorer: 'Utforsker',
		actor: 'Skuespiller',
		military: 'Militær',
		religious: 'Religiøs',
		academic: 'Akademiker',
		engineer: 'Ingeniør',
		default: 'Annet'
	};
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
	<!-- Occupations -->
	<div>
		<div class="block text-xs font-semibold text-gray-900 mb-3 uppercase tracking-wide">Yrke</div>
		<div class="flex flex-wrap gap-2">
			{#each allOccupations as occupation}
				<button
					type="button"
					onclick={() => toggleOccupation(occupation)}
					class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {selectedOccupations.has(occupation) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					{occupationLabels[occupation] || occupation}
				</button>
			{/each}
		</div>
	</div>

	<!-- Year Range -->
	<div>
		<div class="block text-xs font-semibold text-gray-900 mb-3 uppercase tracking-wide">Årstall</div>
		<div class="space-y-3">
			<div>
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Fra: {yearRange[0]}</span>
					<span class="text-sm text-gray-600">Til: {yearRange[1]}</span>
				</div>
				<input
					type="range"
					min={minYear}
					max={maxYear}
					bind:value={yearRange[0]}
					oninput={(e) => updateYearRange(0, parseInt(e.target.value) || minYear)}
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
				/>
				<input
					type="range"
					min={minYear}
					max={maxYear}
					bind:value={yearRange[1]}
					oninput={(e) => updateYearRange(1, parseInt(e.target.value) || maxYear)}
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900 mt-2"
				/>
			</div>
		</div>
	</div>

	<!-- Quick Filters -->
	<div>
		<div class="block text-xs font-semibold text-gray-900 mb-3 uppercase tracking-wide">Filtre</div>
		<div class="space-y-2">
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={onlyLiving}
					class="w-4 h-4 text-gray-900 rounded focus:ring-gray-900 border-gray-300"
				/>
				<span class="text-sm text-gray-700">Kun levende</span>
			</label>
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={onlyWithImages}
					class="w-4 h-4 text-gray-900 rounded focus:ring-gray-900 border-gray-300"
				/>
				<span class="text-sm text-gray-700">Kun med bilder</span>
			</label>
			<div class="pt-2 text-sm text-gray-600">
				{filteredCount.toLocaleString()} av {people.length.toLocaleString()} personer
			</div>
		</div>
	</div>
</div>
