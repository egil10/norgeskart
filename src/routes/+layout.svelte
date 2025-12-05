<script>
	import '../app.css';
	import type { LayoutData } from './$types';

	export let data: LayoutData;
	export let params: Record<string, string> = {};

	// Accept params to avoid warning, but we don't use it
</script>

<div class="h-screen overflow-hidden flex flex-col">
	<slot />
</div>

