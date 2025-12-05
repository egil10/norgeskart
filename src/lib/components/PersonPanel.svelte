<script lang="ts">
	import type { Person } from '../types';
	import { getOccupationCategory } from '../config/colors';

	export let person: Person | null = null;
	export let isOpen: boolean = false;
	export let allPeople: Person[] = [];

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
		if (person?.wikipediaUrl && typeof window !== 'undefined') {
			window.open(person.wikipediaUrl, '_blank');
		}
	}

	// Find related people (same era + same occupation family)
	$: relatedPeople = person && allPeople.length > 0 ? (() => {
		if (!person) return [];
		
		const personOccFamilies = new Set(
			person.occupations.map(occ => getOccupationCategory(occ))
		);
		const eraStart = person.birthYear - 50;
		const eraEnd = (person.deathYear || new Date().getFullYear()) + 50;

		return allPeople
			.filter(p => {
				if (p.id === person.id) return false;
				
				const pOccFamilies = new Set(
					p.occupations.map(occ => getOccupationCategory(occ))
				);
				const hasCommonOcc = [...personOccFamilies].some(occ => pOccFamilies.has(occ));
				const inEra = p.birthYear >= eraStart && p.birthYear <= eraEnd;
				
				return hasCommonOcc && inEra;
			})
			.sort((a, b) => b.prominenceScore - a.prominenceScore)
			.slice(0, 8);
	})() : [];

	let scrollPosition = 0;

	function scrollRelated(direction: 'left' | 'right') {
		if (typeof document === 'undefined') return;
		
		const container = document.getElementById('related-carousel');
		if (!container) return;
		
		const scrollAmount = 280;
		scrollPosition += direction === 'right' ? scrollAmount : -scrollAmount;
		scrollPosition = Math.max(0, Math.min(container.scrollWidth - container.clientWidth, scrollPosition));
		container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
	}
</script>

{#if person}
	<div
		class="person-panel fixed top-0 right-0 h-full bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out border-l border-gray-200"
		class:translate-x-0={isOpen}
		class:translate-x-full={!isOpen}
		style="width: 480px; max-width: 90vw;"
	>
		<div class="flex flex-col h-full">
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-gray-200">
				<h2 class="text-lg font-semibold text-gray-900">Detaljer</h2>
				<button
					onclick={close}
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
					aria-label="Close panel"
				>
					<svg
						class="w-5 h-5 text-gray-600"
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
				<div class="space-y-6">
					<!-- Hero Image -->
					<div class="relative h-64 bg-gray-100">
						{#if person.imageUrl}
							<img
								src={person.imageUrl}
								alt={person.name}
								loading="lazy"
								class="w-full h-full object-cover"
								onerror={(e) => {
									e.currentTarget.style.display = 'none';
									e.currentTarget.nextElementSibling?.classList.remove('hidden');
								}}
							/>
							<div class="hidden absolute inset-0 bg-gray-100 flex items-center justify-center">
								<svg class="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
								</svg>
							</div>
						{:else}
							<div class="absolute inset-0 bg-gray-100 flex items-center justify-center">
								<svg class="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
								</svg>
							</div>
						{/if}
					</div>
					
					<!-- Name -->
					<div class="px-6 pt-6">
						<h1 class="text-3xl font-bold text-gray-900 mb-2">
							{person.name}
						</h1>
						<div class="text-lg text-gray-600 font-medium">
							{person.birthYear} {person.deathYear ? `– ${person.deathYear}` : '–'}
						</div>
					</div>

					<div class="px-6 pb-6 space-y-6">
						<!-- Occupations -->
						{#if person.occupations.length > 0}
							<div>
								<h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
									Yrker
								</h3>
								<div class="flex flex-wrap gap-2">
									{#each person.occupations as occupation}
										<span
											class="px-4 py-2 rounded-xl text-sm font-medium text-white shadow-lg"
											style="background: linear-gradient(135deg, {person.color}dd, {person.color}aa); border: 1px solid {person.color}66;"
										>
											{occupation}
										</span>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Summary -->
						<div>
							<h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
								Om
							</h3>
							<p class="text-sm text-gray-700 leading-relaxed">
								{person.summary || `${person.name} er en norsk person.`}
							</p>
						</div>

						<!-- Related People -->
						{#if relatedPeople.length > 0}
							<div>
								<div class="flex items-center justify-between mb-3">
									<h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wider">
										Relaterte personer
									</h3>
									<div class="flex gap-1">
										<button
									onclick={() => scrollRelated('left')}
									class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
									aria-label="Scroll left"
								>
									<svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
									</svg>
								</button>
								<button
									onclick={() => scrollRelated('right')}
									class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
									aria-label="Scroll right"
								>
									<svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
									</svg>
								</button>
									</div>
								</div>
								<div
									id="related-carousel"
									class="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
									style="scroll-behavior: smooth;"
								>
									{#each relatedPeople as related}
										<button
											onclick={() => { person = related; }}
											class="flex-shrink-0 w-64 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl overflow-hidden transition-all hover:scale-105 cursor-pointer"
										>
											{#if related.imageUrl}
												<img
													src={related.imageUrl}
													alt={related.name}
													loading="lazy"
													class="w-full h-32 object-cover"
													onerror={(e) => {
														e.currentTarget.style.display = 'none';
													}}
												/>
											{:else}
												<div class="w-full h-32 bg-gray-200 flex items-center justify-center">
													<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
													</svg>
												</div>
											{/if}
											<div class="p-3">
												<div class="text-sm font-semibold text-gray-900 truncate">
													{related.name}
												</div>
												<div class="text-xs text-gray-600 mt-0.5">
													{related.birthYear} {related.deathYear ? `– ${related.deathYear}` : '–'}
												</div>
											</div>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Footer -->
			{#if person.wikipediaUrl}
				<div class="p-6 border-t border-gray-200">
					<button
						onclick={openWikipedia}
						class="w-full px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							></path>
						</svg>
						Les mer på Wikipedia
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Backdrop -->
	{#if isOpen}
		<div
			class="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
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

	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
