<script lang="ts">
	import { allOccupations } from '../config/occupations';
	import { occupationColors } from '../config/colors';
	import { onMount } from 'svelte';

	export let selectedCategories: Set<string> = new Set(allOccupations);
	export let onCategoriesChange: (categories: Set<string>) => void = () => {};

	let pendingCategories: Set<string> = new Set(selectedCategories);
	let hasChanges = false;
	let isInitialized = false;

	onMount(() => {
		// Initialize pending categories from selected categories
		pendingCategories = new Set(selectedCategories);
		isInitialized = true;
	});

	// Update pending categories when selectedCategories changes externally (after apply)
	$: if (isInitialized && selectedCategories) {
		const currentStr = Array.from(selectedCategories).sort().join(',');
		const pendingStr = Array.from(pendingCategories).sort().join(',');
		if (currentStr !== pendingStr && !hasChanges) {
			// Only update if not from user interaction
			pendingCategories = new Set(selectedCategories);
		}
	}

	const categoryLabels: Record<string, string> = {
		artist: 'Kunstner',
		writer: 'Forfatter',
		politician: 'Politiker',
		scientist: 'Forsker',
		athlete: 'Idrett',
		musician: 'Musiker',
		business: 'Forretning',
		explorer: 'Utforsker',
		actor: 'Skuespiller',
		military: 'Militær',
		religious: 'Religiøs',
		academic: 'Akademiker',
		engineer: 'Ingeniør',
		default: 'Annet'
	};

	function toggleCategory(category: string) {
		const newSet = new Set(pendingCategories);
		if (newSet.has(category)) {
			newSet.delete(category);
		} else {
			newSet.add(category);
		}
		pendingCategories = newSet;
		checkForChanges();
	}

	function selectAll() {
		const all = new Set(allOccupations);
		pendingCategories = all;
		checkForChanges();
	}

	function deselectAll() {
		pendingCategories = new Set();
		checkForChanges();
	}

	function checkForChanges() {
		const currentStr = Array.from(selectedCategories).sort().join(',');
		const pendingStr = Array.from(pendingCategories).sort().join(',');
		hasChanges = currentStr !== pendingStr;
	}

	function applyFilters() {
		selectedCategories = new Set(pendingCategories);
		onCategoriesChange(new Set(pendingCategories));
		hasChanges = false;
	}

	function resetFilters() {
		pendingCategories = new Set(selectedCategories);
		hasChanges = false;
	}
</script>

<div class="category-filter">
	<div class="filter-header">
		<span class="filter-label">Kategorier</span>
		<div class="filter-actions">
			<button class="action-btn" on:click={selectAll} title="Velg alle">
				Alle
			</button>
			<button class="action-btn" on:click={deselectAll} title="Fjern alle">
				Ingen
			</button>
		</div>
	</div>
	<div class="filter-buttons">
		{#each allOccupations as category}
			{@const isSelected = pendingCategories.has(category)}
			{@const color = occupationColors[category] || occupationColors.default}
			<button
				type="button"
				class="category-btn"
				class:selected={isSelected}
				on:click={() => toggleCategory(category)}
				style="--category-color: {color};"
			>
				<span class="category-indicator" style="background-color: {color};"></span>
				<span class="category-label">{categoryLabels[category] || category}</span>
			</button>
		{/each}
	</div>
	<div class="filter-footer">
		{#if hasChanges}
			<div class="filter-status">Endringer ikke lagret</div>
		{/if}
		<div class="filter-apply-actions">
			{#if hasChanges}
				<button class="apply-btn reset" on:click={resetFilters} title="Tilbakestill">
					Avbryt
				</button>
			{/if}
			<button
				class="apply-btn apply"
				class:has-changes={hasChanges}
				on:click={applyFilters}
				disabled={!hasChanges}
				title="Bruk filtre"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
				<span>Bruk filtre</span>
			</button>
		</div>
	</div>
</div>

<style>
	.category-filter {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.filter-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	.filter-label {
		font-size: 12px;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.filter-actions {
		display: flex;
		gap: 6px;
	}

	.action-btn {
		padding: 4px 10px;
		font-size: 11px;
		font-weight: 500;
		color: #6b7280;
		background: transparent;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn:hover {
		background: #f9fafb;
		color: #1f2937;
		border-color: #d1d5db;
	}

	.filter-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.category-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		font-size: 12px;
		font-weight: 500;
		color: #6b7280;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
	}

	.category-btn:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.category-btn.selected {
		background: var(--category-color);
		color: white;
		border-color: var(--category-color);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
	}

	.category-btn.selected:hover {
		opacity: 0.9;
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.category-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		background-color: var(--category-color);
		transition: all 0.2s ease;
	}

	.category-btn.selected .category-indicator {
		background-color: rgba(255, 255, 255, 0.3);
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
	}

	.category-label {
		white-space: nowrap;
	}

	.filter-footer {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid #e5e7eb;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.filter-status {
		font-size: 11px;
		color: #f59e0b;
		font-weight: 500;
	}

	.filter-apply-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}

	.apply-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		font-size: 12px;
		font-weight: 500;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		border: 1px solid #e5e7eb;
		background: #f9fafb;
		color: #6b7280;
	}

	.apply-btn:hover:not(:disabled) {
		background: #f3f4f6;
		border-color: #d1d5db;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.apply-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.apply-btn.apply {
		background: #1f2937;
		color: white;
		border-color: #1f2937;
	}

	.apply-btn.apply.has-changes {
		background: #1f2937;
		color: white;
		border-color: #1f2937;
		box-shadow: 0 2px 6px rgba(31, 41, 55, 0.2);
	}

	.apply-btn.apply.has-changes:hover {
		background: #374151;
		border-color: #374151;
		box-shadow: 0 4px 8px rgba(31, 41, 55, 0.3);
	}

	.apply-btn.reset {
		background: transparent;
		color: #6b7280;
		border-color: #e5e7eb;
	}

	.apply-btn.reset:hover {
		background: #f9fafb;
		color: #1f2937;
		border-color: #d1d5db;
	}
</style>