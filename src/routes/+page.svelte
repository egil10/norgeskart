<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Moon, Sun, Github } from 'lucide-svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import PersonPanel from '$lib/components/PersonPanel.svelte';
	import type { Person } from '$lib/types';
	import { allPeople } from '$lib/data/people';

	let allPeopleData: Person[] = allPeople;
	let selectedPerson: Person | null = null;
	let isPanelOpen = false;
	let darkMode = false;

	// Filter to only explorers for now - be more lenient
	$: explorerPeople = allPeopleData.filter(p => {
		const occs = p.occupations.map(o => o.toLowerCase()).join(' ');
		const name = p.name.toLowerCase();
		const summary = (p.summary || '').toLowerCase();
		
		return occs.includes('explorer') || 
			occs.includes('utforsker') ||
			occs.includes('polar') ||
			occs.includes('reiser') ||
			name.includes('amundsen') ||
			name.includes('nansen') ||
			name.includes('heyerdahl') ||
			summary.includes('explorer') ||
			summary.includes('polar');
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

<div class="min-h-screen bg-[#faf9f6] flex flex-col">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-6 py-4">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold text-gray-900">Norske Personer</h1>
					<p class="text-sm text-gray-600 mt-1">Interaktiv tidslinje • {explorerPeople.length} personer</p>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Timeline -->
	<main class="flex-1 relative min-h-0">
		<Timeline people={explorerPeople} onPersonClick={handlePersonClick} />
		
		<!-- Person Panel -->
		<PersonPanel 
			person={selectedPerson} 
			bind:isOpen={isPanelOpen}
			allPeople={explorerPeople}
		/>
	</main>

	<!-- Footer -->
	<footer class="bg-white border-t border-gray-200 py-4 dark:bg-gray-900 dark:border-gray-800">
		<div class="max-w-7xl mx-auto px-6">
			<div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
				<div>
					<p>Norgeskart • Viser norske personer gjennom historien</p>
				</div>
				<div class="flex items-center gap-4">
					<p>Data fra Wikidata</p>
					<a
						href="https://github.com/egil10/norgeskart"
						target="_blank"
						rel="noopener noreferrer"
						class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
						aria-label="GitHub repository"
						title="View on GitHub"
					>
						<Github size={16} class="text-gray-600 dark:text-gray-400" />
					</a>
					<button
						onclick={toggleDarkMode}
						class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
						aria-label="Toggle dark mode"
						title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
					>
						{#if darkMode}
							<Sun size={16} class="text-gray-600 dark:text-gray-400" />
						{:else}
							<Moon size={16} class="text-gray-600 dark:text-gray-400" />
						{/if}
					</button>
				</div>
			</div>
		</div>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		height: 100vh;
		overflow: hidden;
	}

	:global(#app) {
		height: 100vh;
	}
</style>