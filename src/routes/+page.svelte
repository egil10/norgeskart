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

	function handlePersonClick(person: Person) {
		selectedPerson = person;
		isPanelOpen = true;
	}

	function handleFiltered(filtered: Person[]) {
		filteredPeople = filtered;
	}
</script>


<div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
	<!-- Filters Sidebar -->
	<Filters people={allPeople} onFiltered={handleFiltered} />

	<!-- Main Timeline Area -->
	<div class="flex-1 flex flex-col overflow-hidden">
		<header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				Norske Historiske Personer
			</h1>
			<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
				Interaktiv tidslinje over norske personer
			</p>
		</header>

		<div class="flex-1 overflow-hidden">
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
	}

	:global(body) {
		height: 100%;
		overflow: hidden;
	}
</style>

