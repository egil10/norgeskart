<script lang="ts">
	import { allOccupations } from '../config/occupations';
	import { occupationColors } from '../config/colors';
	import { onMount } from 'svelte';

	export let selectedCategories: Set<string> = new Set(allOccupations);
	export let onCategoriesChange: (categories: Set<string>) => void = () => {};
	export let onClose: (() => void) | undefined = undefined;

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
		if (onClose) {
			onClose();
		}
	}

	function resetFilters() {
		pendingCategories = new Set(selectedCategories);
		hasChanges = false;
	}
</script>

<div class="category-filter">
	<div class="filter-header">
		<h2 class="filter-title">Filtre</h2>
		<button class="close-sidebar-btn" on:click={() => onClose?.()} aria-label="Lukk">
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<line x1="18" x2="6" y1="6" y2="18"></line>
				<line x1="6" x2="18" y1="6" y2="18"></line>
			</svg>
		</button>
	</div>
	<div class="filter-scrollable">
		<div class="filter-actions-row">
			<button class="action-btn" on:click={selectAll} title="Velg alle">
				Alle
			</button>
			<button class="action-btn" on:click={deselectAll} title="Fjern alle">
				Ingen
			</button>
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
					<span class="category-label">{categoryLabels[category] || category}</span>
				</button>
			{/each}
		</div>
	</div>
	<div class="filter-footer">
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
				Bruk filtre
			</button>
		</div>
	</div>
</div>

<style>
	.category-filter {
		display: flex;
		flex-direction: column;
		background: white;
		max-height: 80vh;
	}

	.filter-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-bottom: 1px solid #e5e7eb;
		flex-shrink: 0;
	}

	.filter-title {
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
		margin: 0;
	}

	.close-sidebar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		background: transparent;
		color: #6b7280;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
		-webkit-tap-highlight-color: transparent;
		flex-shrink: 0;
	}

	.close-sidebar-btn:hover {
		background: #f9fafb;
		color: #1f2937;
	}

	.close-sidebar-btn:active {
		transform: scale(0.95);
	}

	.filter-scrollable {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.filter-actions-row {
		display: flex;
		gap: 6px;
		padding: 8px 14px;
		flex-shrink: 0;
	}

	.action-btn {
		padding: 5px 10px;
		font-size: 11px;
		font-weight: 500;
		color: #6b7280;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
		flex: 1;
	}

	.action-btn:hover {
		background: white;
		color: #1f2937;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.action-btn:active {
		transform: scale(0.95);
	}

	.filter-buttons {
		padding: 0 14px 8px 14px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.category-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		font-size: 11px;
		font-weight: 500;
		color: #6b7280;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
		text-align: left;
		-webkit-tap-highlight-color: transparent;
		width: 100%;
	}

	.category-btn:hover {
		background: #f9fafb;
		color: #1f2937;
	}

	.category-btn.selected {
		background: var(--category-color);
		color: white;
	}

	.category-btn.selected:hover {
		background: var(--category-color);
		opacity: 0.9;
	}

	.category-btn:active {
		transform: scale(0.95);
	}

	.category-indicator {
		display: none;
	}

	.category-label {
		white-space: nowrap;
	}

	.filter-footer {
		padding: 8px 14px;
		border-top: 1px solid #e5e7eb;
		display: flex;
		flex-shrink: 0;
		background: white;
	}

	.filter-apply-actions {
		display: flex;
		gap: 8px;
		width: 100%;
	}

	.apply-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 5px 10px;
		font-size: 11px;
		font-weight: 500;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
		border: 1px solid #e5e7eb;
		background: #f9fafb;
		color: #6b7280;
	}

	.apply-btn:hover:not(:disabled) {
		background: white;
		border-color: #d1d5db;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.apply-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.apply-btn:active:not(:disabled) {
		transform: scale(0.98);
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
	}

	.apply-btn.apply.has-changes:hover:not(:disabled) {
		background: #374151;
		border-color: #374151;
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

	@media (max-width: 768px) {
		.filter-header {
			padding: 16px 20px;
		}

		.filter-actions-row {
			padding: 12px 20px;
		}

		.filter-buttons {
			padding: 12px 20px;
		}

		.filter-footer {
			padding: 16px 20px;
		}
	}
</style>