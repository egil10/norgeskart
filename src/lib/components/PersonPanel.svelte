<script lang="ts">
	import { fade, scale } from "svelte/transition";
	import type { Person } from "../types";

	export let person: Person | null = null;
	export let isOpen = false;
	export let allPeople: Person[] = [];

	function close() {
		isOpen = false;
		person = null;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			close();
		}
	}

	$: currentYear = new Date().getFullYear();
	$: lifespan = person
		? `${person.birthYear}–${person.deathYear || (person.birthYear < 1920 ? "?" : "present")}`
		: "";
	$: age = person
		? person.deathYear
			? person.deathYear - person.birthYear
			: currentYear - person.birthYear
		: 0;
</script>

{#if isOpen && person}
	<div
		class="modal-backdrop"
		on:click={handleBackdropClick}
		transition:fade={{ duration: 150 }}
		role="button"
		tabindex="-1"
	>
		<div
			class="modal-card"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<!-- Close button -->
			<button class="close-btn" on:click={close} aria-label="Close">
				<svg
					width="18"
					height="18"
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

			<!-- Content -->
			<div class="card-content">
				{#if person.imageUrl}
					<img
						src={person.imageUrl}
						alt={person.name}
						class="person-image"
					/>
				{/if}

				<h2 class="person-name">{person.name}</h2>

				<div class="info-row">
					<span class="info-label">Lifespan:</span>
					<span class="info-value">{lifespan} ({age} years)</span>
				</div>

				{#if person.occupations && person.occupations.length > 0}
					<div class="info-row">
						<span class="info-label">Occupation:</span>
						<span class="info-value"
							>{person.occupations.join(", ")}</span
						>
					</div>
				{/if}

				{#if person.summary}
					<p class="summary">{person.summary}</p>
				{/if}

				{#if person.wikipediaUrl}
					<a
						href={person.wikipediaUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="wiki-link"
					>
						Read more on Wikipedia →
					</a>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		padding: 20px;
	}

	.modal-card {
		background: white;
		border-radius: 4px;
		max-width: 400px;
		width: 100%;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		position: relative;
		border: 1px solid #e5e7eb;
	}

	.close-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: #000;
		transition: all 0.15s;
		z-index: 10;
	}

	.close-btn:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
	}

	.card-content {
		padding: 24px;
	}

	.person-image {
		width: 80px;
		height: 80px;
		border-radius: 4px;
		object-fit: cover;
		border: 1px solid #e5e7eb;
		margin-bottom: 16px;
	}

	.person-name {
		font-size: 18px;
		font-weight: 600;
		color: #000;
		margin: 0 0 12px 0;
	}

	.info-row {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
		font-size: 13px;
	}

	.info-label {
		color: #6b7280;
		font-weight: 400;
	}

	.info-value {
		color: #000;
		font-weight: 400;
	}

	.summary {
		font-size: 13px;
		line-height: 1.5;
		color: #374151;
		margin: 12px 0;
	}

	.wiki-link {
		display: inline-block;
		color: #000;
		text-decoration: none;
		font-size: 13px;
		font-weight: 500;
		border-bottom: 1px solid #000;
		transition: opacity 0.15s;
	}

	.wiki-link:hover {
		opacity: 0.7;
	}
</style>
