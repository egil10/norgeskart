<script lang="ts">
	import { fade, fly } from "svelte/transition";
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
		? `${person.birthYear}–${person.deathYear || "present"}`
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
		transition:fade={{ duration: 200 }}
	>
		<div class="modal-card" transition:fly={{ y: 50, duration: 300 }}>
			<!-- Close button -->
			<button class="close-btn" on:click={close} aria-label="Close">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>

			<!-- Header with image -->
			<div class="card-header">
				{#if person.imageUrl}
					<img
						src={person.imageUrl}
						alt={person.name}
						class="person-image"
					/>
				{:else}
					<div class="person-image-placeholder">
						<svg
							width="80"
							height="80"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
							></path>
							<circle cx="12" cy="7" r="4"></circle>
						</svg>
					</div>
				{/if}
			</div>

			<!-- Content -->
			<div class="card-content">
				<h2 class="person-name">{person.name}</h2>

				<div class="info-grid">
					<div class="info-item">
						<div class="info-label">Lifespan</div>
						<div class="info-value">{lifespan}</div>
					</div>

					<div class="info-item">
						<div class="info-label">Age</div>
						<div class="info-value">
							{age} years {person.deathYear ? "" : "(living)"}
						</div>
					</div>

					<div class="info-item">
						<div class="info-label">Birth Year</div>
						<div class="info-value">{person.birthYear}</div>
					</div>

					{#if person.deathYear}
						<div class="info-item">
							<div class="info-label">Death Year</div>
							<div class="info-value">{person.deathYear}</div>
						</div>
					{/if}
				</div>

				{#if person.occupations && person.occupations.length > 0}
					<div class="occupations">
						<div class="info-label mb-2">Occupations</div>
						<div class="occupation-tags">
							{#each person.occupations as occupation}
								<span class="occupation-tag">{occupation}</span>
							{/each}
						</div>
					</div>
				{/if}

				{#if person.summary}
					<div class="summary">
						<div class="info-label mb-2">Biography</div>
						<p class="summary-text">{person.summary}</p>
					</div>
				{/if}

				{#if person.wikipediaUrl}
					<a
						href={person.wikipediaUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="wiki-link"
					>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
							></path>
							<polyline points="15 3 21 3 21 9"></polyline>
							<line x1="10" y1="14" x2="21" y2="3"></line>
						</svg>
						Read more on Wikipedia
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
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		padding: 20px;
		backdrop-filter: blur(4px);
	}

	.modal-card {
		background: white;
		border-radius: 16px;
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		position: relative;
	}

	.close-btn {
		position: absolute;
		top: 16px;
		right: 16px;
		background: white;
		border: none;
		border-radius: 50%;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: #6b7280;
		transition: all 0.2s;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		z-index: 10;
	}

	.close-btn:hover {
		background: #f3f4f6;
		color: #111827;
		transform: scale(1.05);
	}

	.card-header {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 40px 32px;
		display: flex;
		justify-content: center;
		align-items: center;
		border-radius: 16px 16px 0 0;
	}

	.person-image {
		width: 160px;
		height: 160px;
		border-radius: 50%;
		object-fit: cover;
		border: 4px solid white;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
	}

	.person-image-placeholder {
		width: 160px;
		height: 160px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		border: 4px solid white;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
	}

	.card-content {
		padding: 32px;
	}

	.person-name {
		font-size: 28px;
		font-weight: 700;
		color: #111827;
		margin: 0 0 24px 0;
		text-align: center;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
		margin-bottom: 24px;
	}

	.info-item {
		background: #f9fafb;
		padding: 16px;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.info-label {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		color: #6b7280;
		letter-spacing: 0.05em;
		margin-bottom: 4px;
	}

	.info-value {
		font-size: 16px;
		font-weight: 600;
		color: #111827;
	}

	.occupations {
		margin-bottom: 24px;
	}

	.occupation-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.occupation-tag {
		background: #eff6ff;
		color: #1e40af;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 500;
		border: 1px solid #bfdbfe;
	}

	.summary {
		margin-bottom: 24px;
	}

	.summary-text {
		font-size: 15px;
		line-height: 1.6;
		color: #374151;
		margin: 0;
	}

	.wiki-link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #2563eb;
		color: white;
		padding: 12px 20px;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 600;
		font-size: 14px;
		transition: all 0.2s;
	}

	.wiki-link:hover {
		background: #1d4ed8;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
	}

	.mb-2 {
		margin-bottom: 8px;
	}
</style>
