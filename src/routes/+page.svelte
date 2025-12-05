<script lang="ts">
	import { onMount } from 'svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import PersonPanel from '$lib/components/PersonPanel.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import type { Person } from '$lib/types';
	import peopleData from '$lib/data/people.json';

	let allPeople: Person[] = peopleData as Person[];
	let filteredPeople: Person[] = allPeople;
	let selectedPerson: Person | null = null;
	let isPanelOpen = false;
	let filtersOpen = false;

	function handlePersonClick(person: Person) {
		selectedPerson = person;
		isPanelOpen = true;
	}

	function handleFiltered(filtered: Person[]) {
		filteredPeople = filtered;
	}
</script>

<div class="flex h-screen overflow-hidden bg-white dark:bg-[#0a0a0a]">
	<!-- Mobile Filters Toggle -->
	<button
		onclick={() => filtersOpen = !filtersOpen}
		class="fixed top-4 left-4 z-40 lg:hidden p-3 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 hover:shadow-xl transition-all"
		aria-label="Toggle filters"
	>
		<svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
		</svg>
	</button>

	<!-- Filters Sidebar -->
	<div class="fixed lg:static inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-out {filtersOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}">
		<Filters people={allPeople} onFiltered={handleFiltered} onClose={() => filtersOpen = false} />
	</div>

	<!-- Backdrop for mobile -->
	{#if filtersOpen}
		<div 
			class="fixed inset-0 bg-black/50 z-20 lg:hidden"
			onclick={() => filtersOpen = false}
			role="button"
			tabindex="-1"
		></div>
	{/if}

	<!-- Main Timeline Area -->
	<div class="flex-1 flex flex-col overflow-hidden min-w-0">
		<!-- Modern Header -->
		<header class="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-900 px-6 py-5">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
						Norske Personer
					</h1>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
						Interaktiv tidslinje • {filteredPeople.length.toLocaleString()} personer
					</p>
				</div>
				<div class="flex items-center gap-3">
					<div class="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
						<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
						</svg>
						<span class="text-xs text-gray-500 dark:text-gray-400">Zoom og pan for å utforske</span>
					</div>
				</div>
			</div>
		</header>

		<!-- Timeline Container -->
		<div class="flex-1 overflow-hidden relative bg-gradient-to-b from-gray-50/50 to-white dark:from-[#0a0a0a] dark:to-[#0f0f0f]">
			<Timeline
				people={filteredPeople}
				onPersonClick={handlePersonClick}
			/>
		</div>
	</div>

	<!-- Person Detail Panel -->
	<PersonPanel person={selectedPerson} bind:isOpen={isPanelOpen} />
</div>

<style>
	:global(html) {
		height: 100%;
		scroll-behavior: smooth;
	}

	:global(body) {
		height: 100%;
		overflow: hidden;
		font-feature-settings: 'rlig' 1, 'calt' 1;
	}
</style>
