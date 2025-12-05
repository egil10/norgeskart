<script lang="ts">
	import type { Person } from '../types';
	import { occupationColors } from '../config/colors';

	export let person: Person | null = null;
	export let isOpen: boolean = false;

	$: if (person) {
		isOpen = true;
	} else if (!person) {
		isOpen = false;
	}

	function close() {
		isOpen = false;
		setTimeout(() => {
			person = null;
		}, 300);
	}

	function openWikipedia() {
		if (person?.wikipediaUrl) {
			window.open(person.wikipediaUrl, '_blank');
		}
	}
</script>

{#if person}
	<div
		class="person-panel fixed top-0 right-0 h-full bg-white dark:bg-[#0f0f0f] shadow-2xl z-50 transform transition-transform duration-300 ease-out border-l border-gray-200 dark:border-gray-900"
		class:translate-x-0={isOpen}
		class:translate-x-full={!isOpen}
		style="width: 420px; max-width: 90vw;"
	>
		<div class="flex flex-col h-full">
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-900">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Detaljer</h2>
				<button
					onclick={close}
					class="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors"
					aria-label="Close panel"
				>
					<svg
						class="w-5 h-5 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto">
				<div class="p-6 space-y-6">
					<!-- Image -->
					<div class="relative">
						{#if person.imageUrl}
							<img
								src={person.imageUrl}
								alt={person.name}
								loading="lazy"
								class="w-full aspect-[4/3] object-cover rounded-xl shadow-lg bg-gray-100 dark:bg-gray-900"
								onerror={(e) => {
									e.currentTarget.style.display = 'none';
									e.currentTarget.nextElementSibling?.classList.remove('hidden');
								}}
							/>
							<div class="hidden w-full aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-lg flex items-center justify-center">
								<svg class="w-16 h-16 text-gray-300 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
								</svg>
							</div>
						{:else}
							<div class="w-full aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-lg flex items-center justify-center">
								<svg class="w-16 h-16 text-gray-300 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
								</svg>
							</div>
						{/if}
					</div>

					<!-- Name -->
					<div>
						<h1 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
							{person.name}
						</h1>
						<div class="text-base text-gray-500 dark:text-gray-400">
							{person.birthYear} {person.deathYear ? `– ${person.deathYear}` : '–'}
						</div>
					</div>

					<!-- Occupations -->
					{#if person.occupations.length > 0}
						<div>
							<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
								Yrker
							</h3>
							<div class="flex flex-wrap gap-2">
								{#each person.occupations as occupation}
									<span
										class="px-3 py-1.5 rounded-lg text-sm font-medium text-white shadow-sm"
										style="background-color: {person.color}"
									>
										{occupation}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Summary -->
					<div>
						<h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
							Om
						</h3>
						<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
							{person.summary}
						</p>
					</div>
				</div>
			</div>

			<!-- Footer -->
			{#if person.wikipediaUrl}
				<div class="p-6 border-t border-gray-200 dark:border-gray-900">
					<button
						onclick={openWikipedia}
						class="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors font-medium flex items-center justify-center gap-2 shadow-sm"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							></path>
						</svg>
						Åpne på Wikipedia
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Backdrop -->
	{#if isOpen}
		<div
			class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
			onclick={close}
			role="button"
			tabindex="-1"
		></div>
	{/if}
{/if}

<style>
	.person-panel {
		overflow: hidden;
	}
</style>
