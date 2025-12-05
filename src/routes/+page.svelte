<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import PersonPanel from '$lib/components/PersonPanel.svelte';
	import type { Person } from '$lib/types';
	import { allPeople } from '$lib/data/people';
	import type { PageData } from './$types';

	export let data: PageData;
	export let params: Record<string, string> = {};

	let allPeopleData: Person[] = allPeople;
	let selectedPerson: Person | null = null;
	let isPanelOpen = false;
	let darkMode = false;

	// Filter to explorers and writers
	$: filteredPeople = allPeopleData.filter(p => {
		const occs = p.occupations.map(o => o.toLowerCase()).join(' ');
		const name = p.name.toLowerCase();
		const summary = (p.summary || '').toLowerCase();
		
		const isExplorer = occs.includes('explorer') || 
			occs.includes('utforsker') ||
			occs.includes('polar') ||
			occs.includes('reiser') ||
			name.includes('amundsen') ||
			name.includes('nansen') ||
			name.includes('heyerdahl') ||
			summary.includes('explorer') ||
			summary.includes('polar');
		
		const isWriter = occs.includes('writer') ||
			occs.includes('forfatter') ||
			occs.includes('author') ||
			occs.includes('poet') ||
			occs.includes('dikter') ||
			occs.includes('novelist') ||
			occs.includes('playwright');
		
		return isExplorer || isWriter;
	});

	function handlePersonClick(person: Person) {
		selectedPerson = person;
		isPanelOpen = true;
	}

	// Keyboard shortcuts
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isPanelOpen) {
			isPanelOpen = false;
			selectedPerson = null;
		}
	}

	function toggleDarkMode() {
		if (typeof window === 'undefined') return;
		darkMode = !darkMode;
		localStorage.setItem('darkMode', darkMode.toString());
		updateTheme();
	}

	function updateTheme() {
		if (typeof window === 'undefined') return;
		if (darkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleKeyDown);
			
			// Check for saved theme preference
			const saved = localStorage.getItem('darkMode');
			darkMode = saved === 'true';
			updateTheme();
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeyDown);
		}
	});
</script>

<div class="h-full bg-[#faf9f6] flex flex-col overflow-hidden">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200 flex-shrink-0">
		<div class="max-w-7xl mx-auto px-6 py-2">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-lg font-bold text-gray-900">Norske Personer</h1>
					<p class="text-xs text-gray-600">Interaktiv tidslinje • {filteredPeople.length} personer</p>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Timeline -->
	<main class="flex-1 relative min-h-0 overflow-hidden flex flex-col">
		<div class="absolute inset-0">
			<Timeline people={filteredPeople} onPersonClick={handlePersonClick} />
		</div>
		
		<!-- Person Panel -->
		<PersonPanel 
			person={selectedPerson} 
			bind:isOpen={isPanelOpen}
			allPeople={filteredPeople}
		/>
	</main>

	<!-- Footer -->
	<footer class="bg-white border-t border-gray-200 py-2 dark:bg-gray-900 dark:border-gray-800 flex-shrink-0">
		<div class="max-w-7xl mx-auto px-6">
			<div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
				<div>
					<p>Norgeskart • Viser norske personer gjennom historien</p>
				</div>
				<div class="flex items-center gap-3">
					<p>Data fra Wikidata</p>
					<a
						href="https://github.com/egil10/norgeskart"
						target="_blank"
						rel="noopener noreferrer"
						class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
						aria-label="GitHub repository"
						title="View on GitHub"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-600 dark:text-gray-400">
							<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
							<path d="M9 18c-4.51 2-5-2-7-2"/>
						</svg>
					</a>
					<button
						onclick={toggleDarkMode}
						class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
						aria-label="Toggle dark mode"
						title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
					>
						{#if darkMode}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-600 dark:text-gray-400">
								<circle cx="12" cy="12" r="4"/>
								<path d="M12 2v2"/>
								<path d="M12 20v2"/>
								<path d="m4.93 4.93 1.41 1.41"/>
								<path d="m17.66 17.66 1.41 1.41"/>
								<path d="M2 12h2"/>
								<path d="M20 12h2"/>
								<path d="m6.34 17.66-1.41 1.41"/>
								<path d="m19.07 4.93-1.41 1.41"/>
							</svg>
						{:else}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-600 dark:text-gray-400">
								<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
							</svg>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</footer>
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	:global(#app) {
		height: 100%;
		width: 100%;
		overflow: hidden;
	}
</style>