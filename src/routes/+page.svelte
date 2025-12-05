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

	function handlePersonClick(person: Person) {
		selectedPerson = person;
		isPanelOpen = true;
	}

	function handleFiltered(filtered: Person[]) {
		filteredPeople = filtered;
	}

	// Keyboard shortcuts
	function handleKeyDown(event: KeyboardEvent) {
		// Don't interfere with inputs
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement
		) {
			return;
		}

		// Search: /
		if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
			event.preventDefault();
			const searchInput = document.getElementById('search-input') as HTMLInputElement;
			if (searchInput) {
				searchInput.focus();
			}
		}

		// Escape: close panels
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
			
			// Trigger zoom to this person in Timeline (via URL hash)
			const centerYear = random.birthYear;
			window.location.hash = `#year=${centerYear}&zoom=5`;
			
			// Small delay then reload hash
			setTimeout(() => {
				if (typeof window !== 'undefined') {
					window.dispatchEvent(new HashChangeEvent('hashchange'));
				}
			}, 100);
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeyDown);
	});
</script>

<div class="flex h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-black">
	<!-- Mobile Filters Toggle -->
	<button
		onclick={() => filtersOpen = !filtersOpen}
		class="fixed top-4 left-4 z-40 lg:hidden p-3 bg-black/60 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 hover:bg-black/80 transition-all"
		aria-label="Toggle filters"
	>
		<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
		</svg>
	</button>

	<!-- Filters Sidebar -->
	<div class="fixed lg:static inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-out {filtersOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}">
		<Filters people={allPeopleData} onFiltered={handleFiltered} onClose={() => filtersOpen = false} />
	</div>

	<!-- Backdrop for mobile -->
	{#if filtersOpen}
		<div 
			class="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
			onclick={() => filtersOpen = false}
			role="button"
			tabindex="-1"
		></div>
	{/if}

	<!-- Main Timeline Area -->
	<div class="flex-1 flex flex-col overflow-hidden min-w-0">
		<!-- Modern Header -->
		<header class="bg-black/40 backdrop-blur-xl border-b border-white/10 px-6 py-5">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold text-white tracking-tight">
						Norske Personer
					</h1>
					<p class="text-sm text-gray-400 mt-0.5">
						Interaktiv tidslinje • {filteredPeople.length.toLocaleString()} personer
					</p>
				</div>
				<div class="flex items-center gap-3">
					<button
						onclick={exploreRandom}
						class="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium text-sm shadow-lg hover:shadow-xl"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
						</svg>
						Utforsk
					</button>
					<div class="hidden sm:flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 text-xs text-gray-300">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
						</svg>
						<span>Zoom og pan • Trykk <kbd class="px-1.5 py-0.5 bg-white/10 rounded text-xs">/</kbd> for søk</span>
					</div>
				</div>
			</div>
		</header>

		<!-- Timeline Container -->
		<div class="flex-1 overflow-hidden relative">
			<Timeline
				people={filteredPeople}
				onPersonClick={handlePersonClick}
			/>
		</div>
	</div>

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
		overflow: hidden;
		font-feature-settings: 'rlig' 1, 'calt' 1;
		background: #000;
	}

	kbd {
		font-family: ui-monospace, monospace;
	}
</style>
