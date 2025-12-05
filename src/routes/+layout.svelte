<script>
	import '../app.css';
	import { onMount } from 'svelte';

	let darkMode = false;

	onMount(() => {
		// Check for saved theme preference or default to light mode
		const saved = localStorage.getItem('darkMode');
		darkMode = saved === 'true';
		updateTheme();
	});

	function toggleDarkMode() {
		darkMode = !darkMode;
		localStorage.setItem('darkMode', darkMode.toString());
		updateTheme();
	}

	function updateTheme() {
		if (darkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}
</script>

<div class="min-h-screen bg-white dark:bg-[#0a0a0a]">
	<slot />

	<!-- Dark mode toggle -->
	<button
		onclick={toggleDarkMode}
		class="fixed bottom-6 right-6 p-3.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-xl shadow-lg hover:shadow-xl transition-all z-50 border border-gray-200 dark:border-gray-800 hover:scale-105"
		aria-label="Toggle dark mode"
	>
		{#if darkMode}
			<svg class="w-6 h-6 text-gray-800 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
			</svg>
		{:else}
			<svg class="w-6 h-6 text-gray-800 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
			</svg>
		{/if}
	</button>
</div>

