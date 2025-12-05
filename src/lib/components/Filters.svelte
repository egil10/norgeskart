<script lang="ts">
	import type { Person } from '../types';
	import { allOccupations } from '../config/occupations';
	import { getOccupationCategory } from '../config/colors';

	export let people: Person[] = [];
	export let onFiltered: (filtered: Person[]) => void = () => {};

	let selectedOccupations: Set<string> = new Set(allOccupations);
	let yearRange: [number, number] = [1800, 2025];
	let searchQuery: string = '';
	let filteredCount = people.length;

	const minYear = 1800;
	const maxYear = 2025;

	$: {
		// Filter by occupation
		let result = people.filter((person) => {
			if (selectedOccupations.size === 0) return false;
			
			const personOccupations = person.occupations.map(occ => 
				getOccupationCategory(occ)
			);
			
			return personOccupations.some(occ => selectedOccupations.has(occ));
		});

		// Filter by year range
		result = result.filter((person) => {
			const endYear = person.deathYear || new Date().getFullYear();
			return (
				person.birthYear <= yearRange[1] &&
				endYear >= yearRange[0]
			);
		});

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			result = result.filter((person) =>
				person.name.toLowerCase().includes(query) ||
				person.occupations.some(occ => occ.toLowerCase().includes(query))
			);
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
		selectedOccupations = new Set(selectedOccupations); // Trigger reactivity
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
		explorer: 'Utforsker',
		athlete: 'Idrettsutøver'
	};
</script>

<div class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto h-full">
	<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-6">Filtre</h2>

	<!-- Search -->
	<div class="mb-6">
		<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
			Søk
		</label>
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Søk etter navn..."
			class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>
	</div>

	<!-- Occupations -->
	<div class="mb-6">
		<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
			Yrke
		</label>
		<div class="space-y-2">
			{#each allOccupations as occupation}
				<label class="flex items-center cursor-pointer">
					<input
						type="checkbox"
						checked={selectedOccupations.has(occupation)}
						onchange={() => toggleOccupation(occupation)}
						class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
					/>
					<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
						{occupationLabels[occupation] || occupation}
					</span>
				</label>
			{/each}
		</div>
	</div>

	<!-- Year Range -->
	<div class="mb-6">
		<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
			Årstall
		</label>
		<div class="space-y-3">
			<div>
				<label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
					Fra
				</label>
				<input
					type="number"
					bind:value={yearRange[0]}
					min={minYear}
					max={maxYear}
					oninput={(e) => updateYearRange(0, parseInt(e.target.value) || minYear)}
					class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>
			<div>
				<label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">
					Til
				</label>
				<input
					type="number"
					bind:value={yearRange[1]}
					min={minYear}
					max={maxYear}
					oninput={(e) => updateYearRange(1, parseInt(e.target.value) || maxYear)}
					class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>
		</div>
	</div>

	<!-- Results count -->
	<div class="text-sm text-gray-600 dark:text-gray-400">
		{filteredCount} {filteredCount === 1 ? 'person' : 'personer'}
	</div>
</div>

