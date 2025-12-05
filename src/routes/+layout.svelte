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

</div>

