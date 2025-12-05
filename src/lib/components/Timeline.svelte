<script lang="ts">
	import { onMount, onDestroy, afterUpdate } from 'svelte';
	import * as d3 from 'd3';
	import type { Person } from '../types';

	export let people: Person[] = [];
	export let selectedPerson: Person | null = null;
	export let onPersonClick: (person: Person) => void = () => {};

	let svg: SVGSVGElement;
	let container: HTMLDivElement;
	let width = 0;
	let height = 600;
	let currentYear = new Date().getFullYear();

	let baseXScale: d3.ScaleLinear<number, number>;
	let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
	let g: d3.Selection<SVGGElement, unknown, null, undefined>;
	let zoomTransform: d3.ZoomTransform = d3.zoomIdentity;

	const margin = { top: 60, right: 40, bottom: 40, left: 80 };
	const barHeight = 28;

	let isInitialized = false;

	onMount(() => {
		if (!svg || !container) return;

		updateDimensions();
		initD3();

		const resizeObserver = new ResizeObserver(() => {
			updateDimensions();
			if (isInitialized) {
				initD3();
			}
		});

		resizeObserver.observe(container);
		onDestroy(() => resizeObserver.disconnect());
	});

	afterUpdate(() => {
		if (isInitialized && svg && people.length > 0) {
			updateChartData();
		}
	});

	function updateDimensions() {
		if (!container) return;
		width = container.clientWidth || 1200;
	}

	function initD3() {
		if (!svg || !people.length) return;

		// Calculate year range from people data
		const allYears = people.flatMap(p => [p.birthYear, p.deathYear || currentYear]);
		const minYear = Math.min(...allYears) - 5;
		const maxYear = Math.max(...allYears) + 5;

		// Set up base scale
		baseXScale = d3
			.scaleLinear()
			.domain([minYear, maxYear])
			.range([margin.left, width - margin.right]);

		// Create main group if it doesn't exist
		if (!isInitialized) {
			d3.select(svg).selectAll('*').remove();
			g = d3.select(svg).append('g');
			
			// Create defs for patterns
			g.append('defs');
			
			// Create axes group
			g.append('g')
				.attr('class', 'x-axis')
				.attr('transform', `translate(0, ${height - margin.bottom})`);
			
			// Add year label
			g.append('text')
				.attr('x', width / 2)
				.attr('y', height - 10)
				.attr('text-anchor', 'middle')
				.attr('class', 'axis-label fill-gray-600 dark:fill-gray-400')
				.text('År');

			// Create zoom behavior
			zoom = d3
				.zoom<SVGSVGElement, unknown>()
				.scaleExtent([0.1, 20])
				.translateExtent([
					[-margin.left, -margin.top],
					[width - margin.right, height - margin.bottom]
				])
				.on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
					zoomTransform = event.transform;
					updateChartData();
				});

			d3.select(svg).call(zoom);
			isInitialized = true;
		}

		updateChartData();
	}

	function updateChartData() {
		if (!g || !people.length || !baseXScale) return;

		const xScale = zoomTransform ? zoomTransform.rescaleX(baseXScale) : baseXScale;
		
		// Calculate year range
		const allYears = people.flatMap(p => [p.birthYear, p.deathYear || currentYear]);
		const minYear = Math.min(...allYears) - 5;
		const maxYear = Math.max(...allYears) + 5;
		
		// Update base scale domain if needed
		baseXScale.domain([minYear, maxYear]);
		const currentXScale = zoomTransform ? zoomTransform.rescaleX(baseXScale) : baseXScale;

		// Update x-axis
		const xAxis = d3.axisBottom(currentXScale).tickFormat(d3.format('d'));
		g.select('.x-axis').transition().duration(200).call(xAxis as any);

		const yScale = d3
			.scaleBand()
			.domain(people.map((_, i) => i.toString()))
			.range([margin.top, height - margin.bottom])
			.padding(0.1);

		// Update/create image patterns
		const defs = g.select<SVGDefsElement>('defs');
		defs.selectAll('pattern').remove(); // Clear old patterns

		people.forEach((person, i) => {
			const pattern = defs
				.append('pattern')
				.attr('id', `pattern-${person.id}`)
				.attr('patternUnits', 'userSpaceOnUse')
				.attr('width', 28)
				.attr('height', 28)
				.attr('x', margin.left - 44)
				.attr('y', (yScale(i.toString()) || 0) - 14);

			pattern
				.append('image')
				.attr('href', person.imageUrl)
				.attr('width', 28)
				.attr('height', 28)
				.attr('preserveAspectRatio', 'xMidYMid slice');
		});

		// Bind data
		const bars = g.selectAll<SVGGElement, Person>('.person-bar').data(people, (d: Person) => d.id);

		// Remove old bars
		bars.exit().remove();

		// Update existing bars
		bars.select('.bar')
			.transition()
			.duration(200)
			.attr('x', (d) => currentXScale(d.birthYear))
			.attr('width', (d) => {
				const endYear = d.deathYear || currentYear;
				return Math.max(currentXScale(endYear) - currentXScale(d.birthYear), 2);
			});

		bars.select('.bar-label')
			.transition()
			.duration(200)
			.attr('x', (d) => currentXScale(d.birthYear) + 8)
			.style('display', () => {
				const zoomLevel = zoomTransform?.k || 1;
				return zoomLevel > 0.5 ? 'block' : 'none';
			});

		// Create new bars
		const barsEnter = bars
			.enter()
			.append('g')
			.attr('class', 'person-bar')
			.attr('transform', (_, i) => `translate(0, ${yScale(i.toString()) || 0})`);

		// Add image circle
		barsEnter
			.append('circle')
			.attr('class', 'person-image')
			.attr('cx', margin.left - 30)
			.attr('cy', barHeight / 2)
			.attr('r', 14)
			.attr('fill', (d: Person) => `url(#pattern-${d.id})`)
			.attr('stroke', '#e5e7eb')
			.attr('stroke-width', 2)
			.attr('cursor', 'pointer')
			.on('click', (event, d) => {
				event.stopPropagation();
				onPersonClick(d);
			});

		// Add bar
		barsEnter
			.append('rect')
			.attr('class', 'bar')
			.attr('x', (d) => currentXScale(d.birthYear))
			.attr('y', 0)
			.attr('height', barHeight)
			.attr('width', (d) => {
				const endYear = d.deathYear || currentYear;
				return Math.max(currentXScale(endYear) - currentXScale(d.birthYear), 2);
			})
			.attr('fill', (d) => d.color)
			.attr('rx', 4)
			.attr('cursor', 'pointer')
			.on('click', (event, d) => {
				event.stopPropagation();
				onPersonClick(d);
			})
			.on('mouseenter', function (event, d) {
				d3.select(this).attr('opacity', 0.8);
				showTooltip(event, d);
			})
			.on('mouseleave', function () {
				d3.select(this).attr('opacity', 1);
				hideTooltip();
			})
			.on('mousemove', (event, d) => {
				showTooltip(event, d);
			});

		// Add name label
		barsEnter
			.append('text')
			.attr('class', 'bar-label')
			.attr('x', (d) => currentXScale(d.birthYear) + 8)
			.attr('y', barHeight / 2)
			.attr('dy', '0.35em')
			.attr('fill', 'white')
			.attr('font-size', '12px')
			.attr('font-weight', '500')
			.attr('pointer-events', 'none')
			.text((d) => d.name)
			.style('display', () => {
				const zoomLevel = zoomTransform?.k || 1;
				return zoomLevel > 0.5 ? 'block' : 'none';
			});

		// Merge
		barsEnter.merge(bars as any);
	}

	function showTooltip(event: MouseEvent, person: Person) {
		const tooltip = d3.select('body').select('.tooltip').empty()
			? d3.select('body').append('div').attr('class', 'tooltip')
			: d3.select('body').select('.tooltip');

		tooltip
			.style('opacity', 1)
			.style('left', event.pageX + 10 + 'px')
			.style('top', event.pageY - 10 + 'px')
			.html(`
				<div class="font-semibold">${person.name}</div>
				<div class="text-sm">${person.birthYear}${person.deathYear ? `-${person.deathYear}` : '-'}</div>
				<div class="text-xs mt-1">${person.summary.substring(0, 100)}...</div>
			`);
	}

	function hideTooltip() {
		d3.select('.tooltip').style('opacity', 0);
	}
</script>

<div bind:this={container} class="w-full h-full relative">
	<svg
		bind:this={svg}
		class="w-full timeline-svg"
		style="height: {height}px;"
	></svg>
</div>

<style>
	:global(.timeline-svg) {
		cursor: grab;
	}

	:global(.timeline-svg:active) {
		cursor: grabbing;
	}

	:global(.x-axis text) {
		fill: rgb(75 85 99);
		font-size: 12px;
	}

	:global(.dark .x-axis text) {
		fill: rgb(156 163 175);
	}

	:global(.x-axis path),
	:global(.x-axis line) {
		stroke: rgb(209 213 219);
	}

	:global(.dark .x-axis path),
	:global(.dark .x-axis line) {
		stroke: rgb(75 85 99);
	}

	:global(.axis-label) {
		font-size: 14px;
	}

	:global(.tooltip) {
		position: absolute;
		padding: 8px 12px;
		background: rgba(17, 24, 39, 0.95);
		color: white;
		border-radius: 6px;
		pointer-events: none;
		font-size: 14px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		opacity: 0;
		transition: opacity 0.2s;
		max-width: 250px;
	}

	:global(.dark .tooltip) {
		background: rgba(31, 41, 55, 0.95);
	}
</style>
