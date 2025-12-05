<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import PersonPanel from '$lib/components/PersonPanel.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import type { Person } from '$lib/types';
	import { allPeople } from '$lib/data/people';

	let allPeopleData: Person[] = allPeople;
	let filteredPeople: Person[] = allPeopleData;
	let selectedPerson: Person | null = null;
	let isPanelOpen = false;
	let filtersOpen = false;
	let searchQuery = '';

	function handlePersonClick(person: Person) {
		selectedPerson = person;
		isPanelOpen = true;
	}

	function handleFiltered(filtered: Person[]) {
		filteredPeople = filtered;
	}

	// Keyboard shortcuts
	function handleKeyDown(event: KeyboardEvent) {
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement
		) {
			return;
		}

		if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
			event.preventDefault();
			const searchInput = document.getElementById('search-input') as HTMLInputElement;
			if (searchInput) {
				searchInput.focus();
			}
		}

		if (event.key === 'Escape') {
			if (isPanelOpen) {
				selectedPerson = null;
				isPanelOpen = false;
			}
			if (filtersOpen) {
				filtersOpen = false;
			}
		}
	}

	// Explore mode: random famous person
	function exploreRandom() {
		const topPeople = [...allPeopleData]
			.filter(p => p.prominenceScore >= 85)
			.sort((a, b) => b.prominenceScore - a.prominenceScore)
			.slice(0, 20);
		
		if (topPeople.length > 0) {
			const random = topPeople[Math.floor(Math.random() * topPeople.length)];
			handlePersonClick(random);
			
			if (typeof window !== 'undefined') {
				const centerYear = random.birthYear;
				window.location.hash = `#year=${centerYear}&zoom=5`;
				setTimeout(() => {
					window.dispatchEvent(new HashChangeEvent('hashchange'));
				}, 100);
			}
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleKeyDown);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeyDown);
		}
	});
</script>

<div class="min-h-screen bg-[#faf9f6] flex flex-col">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
		<div class="max-w-7xl mx-auto px-6 py-4">
			<div class="flex items-center justify-between gap-6">
				<div class="flex items-center gap-6 flex-1">
					<h1 class="text-2xl font-bold text-gray-900">Norske Personer</h1>
					<div class="hidden md:flex items-center gap-4 text-sm text-gray-600">
						<span>{filteredPeople.length.toLocaleString()} personer</span>
						<span class="text-gray-300">•</span>
						<span>Interaktiv tidslinje</span>
					</div>
				</div>
				
				<div class="flex items-center gap-3">
					<!-- Search -->
					<div class="relative hidden md:block">
						<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
						</svg>
						<input
							id="search-input"
							type="text"
							bind:value={searchQuery}
							placeholder="Søk etter personer..."
							class="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent w-64"
						/>
					</div>
					
					<!-- Filters Button -->
					<button
						onclick={() => filtersOpen = !filtersOpen}
						class="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
						</svg>
						<span class="hidden sm:inline">Filtre</span>
					</button>
					
					<!-- Explore Button -->
					<button
						onclick={exploreRandom}
						class="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
						</svg>
						<span class="hidden sm:inline">Utforsk</span>
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Filters Dropdown -->
	{#if filtersOpen}
		<div class="bg-white border-b border-gray-200 shadow-sm">
			<div class="max-w-7xl mx-auto px-6 py-4">
				<Filters people={allPeopleData} onFiltered={handleFiltered} bind:searchQuery={searchQuery} />
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<main class="flex-1 overflow-hidden bg-[#faf9f6]">
		<Timeline
			people={filteredPeople}
			onPersonClick={handlePersonClick}
		/>
	</main>

	<!-- Footer -->
	<footer class="bg-white border-t border-gray-200 py-6">
		<div class="max-w-7xl mx-auto px-6">
			<div class="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
				<div>
					<p>Visualisering av norske historiske personer fra Wikidata</p>
				</div>
				<div class="flex items-center gap-4">
					<a href="https://github.com/egil10/norgeskart" target="_blank" rel="noopener" class="hover:text-gray-900 transition-colors">
						GitHub
					</a>
					<span class="text-gray-300">•</span>
					<a href="https://www.wikidata.org" target="_blank" rel="noopener" class="hover:text-gray-900 transition-colors">
						Wikidata
					</a>
				</div>
			</div>
		</div>
	</footer>

	<!-- Person Detail Panel -->
	<PersonPanel 
		person={selectedPerson} 
		bind:isOpen={isPanelOpen}
		allPeople={allPeopleData}
	/>
</div>

<style>
	:global(html) {
		height: 100%;
		scroll-behavior: smooth;
	}

	:global(body) {
		height: 100%;
		font-feature-settings: 'rlig' 1, 'calt' 1;
		background: #faf9f6;
	}
</style>
