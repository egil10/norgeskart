<script lang="ts">
	import type { Person } from '../types';
	import { allOccupations } from '../config/occupations';
	import { getOccupationCategory } from '../config/colors';

	export let people: Person[] = [];
	export let onFiltered: (filtered: Person[]) => void = () => {};
	export let onClose: () => void = () => {};

	let selectedOccupations: Set<string> = new Set(allOccupations);
	let yearRange: [number, number] = [800, new Date().getFullYear()];
	let searchQuery: string = '';
	let onlyLiving = false;
	let onlyWithImages = false;
	let filteredCount = people.length;

	let minYear = 800;
	let maxYear = new Date().getFullYear();

	$: {
		if (people.length > 0) {
			const years = people.map(p => p.birthYear);
			minYear = Math.min(...years);
			maxYear = Math.max(...years, new Date().getFullYear());
			if (yearRange[0] < minYear) yearRange = [minYear, yearRange[1]];
			if (yearRange[1] > maxYear) yearRange = [yearRange[0], maxYear];
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
			const query = searchQuery.toLowerCase().trim();
			result = result.filter((person) =>
				person.name.toLowerCase().includes(query) ||
				person.occupations.some(occ => occ.toLowerCase().includes(query)) ||
				person.summary.toLowerCase().includes(query)
			);
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

<div class="w-72 lg:w-80 h-full bg-white dark:bg-[#0f0f0f] border-r border-gray-200 dark:border-gray-900 flex flex-col shadow-xl">
	<!-- Header -->
	<div class="p-6 border-b border-gray-200 dark:border-gray-900">
		<div class="flex items-center justify-between mb-1">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Filtre</h2>
			<button
				onclick={onClose}
				class="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
				aria-label="Close filters"
			>
				<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
				</svg>
			</button>
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{filteredCount.toLocaleString()} av {people.length.toLocaleString()} personer
		</p>
	</div>

	<!-- Scrollable Content -->
	<div class="flex-1 overflow-y-auto">
		<div class="p-6 space-y-6">
			<!-- Search -->
			<div>
				<label for="search-input" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
					Søk
				</label>
				<div class="relative">
					<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
						</svg>
					</div>
					<input
						id="search-input"
						type="text"
						bind:value={searchQuery}
						placeholder="Navn, yrke..."
						class="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
					/>
				</div>
			</div>

			<!-- Quick Filters -->
			<div class="space-y-2">
				<label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors">
					<span class="text-sm text-gray-700 dark:text-gray-300">Kun levende</span>
					<input
						type="checkbox"
						bind:checked={onlyLiving}
						class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2 dark:bg-gray-800 dark:border-gray-700"
					/>
				</label>
				<label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors">
					<span class="text-sm text-gray-700 dark:text-gray-300">Kun med bilder</span>
					<input
						type="checkbox"
						bind:checked={onlyWithImages}
						class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2 dark:bg-gray-800 dark:border-gray-700"
					/>
				</label>
			</div>

			<!-- Year Range -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<label class="text-xs font-medium text-gray-700 dark:text-gray-300">
						Årstall
					</label>
					<span class="text-xs text-gray-500 dark:text-gray-400">
						{yearRange[0]} – {yearRange[1]}
					</span>
				</div>
				<div class="space-y-4">
					<div>
						<input
							type="range"
							min={minYear}
							max={maxYear}
							bind:value={yearRange[0]}
							oninput={(e) => updateYearRange(0, parseInt(e.target.value) || minYear)}
							class="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
						/>
						<div class="flex justify-between text-xs text-gray-400 mt-1">
							<span>{minYear}</span>
							<span>Fra: {yearRange[0]}</span>
						</div>
					</div>
					<div>
						<input
							type="range"
							min={minYear}
							max={maxYear}
							bind:value={yearRange[1]}
							oninput={(e) => updateYearRange(1, parseInt(e.target.value) || maxYear)}
							class="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
						/>
						<div class="flex justify-between text-xs text-gray-400 mt-1">
							<span>Til: {yearRange[1]}</span>
							<span>{maxYear}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Occupations -->
			<div>
				<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
					Yrke
				</label>
				<div class="space-y-1.5 max-h-64 overflow-y-auto pr-2">
					{#each allOccupations as occupation}
						<label class="flex items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors">
							<input
								type="checkbox"
								checked={selectedOccupations.has(occupation)}
								onchange={() => toggleOccupation(occupation)}
								class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2 dark:bg-gray-800 dark:border-gray-700 mr-3"
							/>
							<span class="text-sm text-gray-700 dark:text-gray-300">
								{occupationLabels[occupation] || occupation}
							</span>
						</label>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
