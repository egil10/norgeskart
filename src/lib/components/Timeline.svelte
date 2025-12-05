<script lang="ts">
	import { onMount, onDestroy, afterUpdate } from 'svelte';
	import * as d3 from 'd3';
	import type { Person } from '../types';

	export let people: Person[] = [];
	export let onPersonClick: (person: Person) => void = () => {};

	let svg: SVGSVGElement;
	let container: HTMLDivElement;
	let width = 0;
	let height = 800;
	let currentYear = new Date().getFullYear();

	let baseXScale: d3.ScaleLinear<number, number>;
	let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
	let g: d3.Selection<SVGGElement, unknown, null, undefined>;
	let zoomTransform: d3.ZoomTransform = d3.zoomIdentity;

	const margin = { top: 80, right: 40, bottom: 60, left: 40 };
	const barHeight = 24;
	const MIN_PIXELS_PER_PERSON = 3; // Minimum pixels per person before clustering

	interface Cluster {
		startYear: number;
		endYear: number;
		persons: Person[];
		count: number;
		y: number;
		height: number;
	}

	let isInitialized = false;
	let renderTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		if (!svg || !container) return;

		updateDimensions();
		initD3();

		const resizeObserver = new ResizeObserver(() => {
			updateDimensions();
			if (isInitialized) {
				scheduleUpdate();
			}
		});

		resizeObserver.observe(container);
		onDestroy(() => resizeObserver.disconnect());
	});

	afterUpdate(() => {
		if (isInitialized && svg && people.length > 0) {
			scheduleUpdate();
		}
	});

	function scheduleUpdate() {
		if (renderTimeout) clearTimeout(renderTimeout);
		renderTimeout = setTimeout(() => {
			updateChartData();
		}, 16);
	}

	function updateDimensions() {
		if (!container) return;
		width = container.clientWidth || 1200;
	}

	function initD3() {
		if (!svg || !people.length) return;

		const allYears = people.flatMap(p => [p.birthYear, p.deathYear || currentYear]);
		const minYear = Math.min(...allYears) - 5;
		const maxYear = Math.max(...allYears) + 5;

		baseXScale = d3
			.scaleLinear()
			.domain([minYear, maxYear])
			.range([margin.left, width - margin.right]);

		if (!isInitialized) {
			d3.select(svg).selectAll('*').remove();
			g = d3.select(svg).append('g');
			
			g.append('defs');
			
			g.append('g')
				.attr('class', 'x-axis')
				.attr('transform', `translate(0, ${height - margin.bottom})`);

			g.append('g')
				.attr('class', 'grid-lines');

			zoom = d3
				.zoom<SVGSVGElement, unknown>()
				.scaleExtent([0.05, 50])
				.translateExtent([
					[-margin.left, -margin.top],
					[width - margin.right, height - margin.bottom]
				])
				.on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
					zoomTransform = event.transform;
					scheduleUpdate();
				});

			d3.select(svg).call(zoom);
			isInitialized = true;
		}

		updateChartData();
	}

	function createClusters(
		visiblePeople: Person[],
		xScale: d3.ScaleLinear<number, number>
	): Cluster[] {
		if (visiblePeople.length === 0) return [];

		const zoomLevel = zoomTransform?.k || 1;
		const pixelsPerPerson = (height - margin.top - margin.bottom) / visiblePeople.length;
		
		// If we have enough space, don't cluster
		if (pixelsPerPerson >= MIN_PIXELS_PER_PERSON) {
			return visiblePeople.map((person, i) => ({
				startYear: person.birthYear,
				endYear: person.deathYear || currentYear,
				persons: [person],
				count: 1,
				y: margin.top + (i * pixelsPerPerson),
				height: pixelsPerPerson * 0.8
			}));
		}

		// Cluster by time periods
		const yearSpan = Math.max(...visiblePeople.map(p => p.deathYear || currentYear)) - 
		                Math.min(...visiblePeople.map(p => p.birthYear));
		const clusterWindow = Math.max(50, yearSpan / Math.max(1, (height - margin.top - margin.bottom) / MIN_PIXELS_PER_PERSON));

		const clusters: Cluster[] = [];
		const sortedPeople = [...visiblePeople].sort((a, b) => a.birthYear - b.birthYear);

		let currentCluster: Person[] = [];
		let clusterStartYear = sortedPeople[0]?.birthYear || 0;

		for (const person of sortedPeople) {
			if (currentCluster.length === 0 || person.birthYear - clusterStartYear < clusterWindow) {
				currentCluster.push(person);
				clusterStartYear = Math.min(clusterStartYear, person.birthYear);
			} else {
				// Finalize current cluster
				const endYear = Math.max(...currentCluster.map(p => p.deathYear || currentYear));
				clusters.push({
					startYear: clusterStartYear,
					endYear,
					persons: currentCluster,
					count: currentCluster.length,
					y: 0, // Will be set later
					height: 0
				});

				// Start new cluster
				currentCluster = [person];
				clusterStartYear = person.birthYear;
			}
		}

		// Add last cluster
		if (currentCluster.length > 0) {
			const endYear = Math.max(...currentCluster.map(p => p.deathYear || currentYear));
			clusters.push({
				startYear: clusterStartYear,
				endYear,
				persons: currentCluster,
				count: currentCluster.length,
				y: 0,
				height: 0
			});
		}

		// Calculate y positions
		const clusterHeight = (height - margin.top - margin.bottom) / clusters.length;
		clusters.forEach((cluster, i) => {
			cluster.y = margin.top + (i * clusterHeight);
			cluster.height = clusterHeight * 0.8;
		});

		return clusters;
	}

	function getVisiblePeople(xScale: d3.ScaleLinear<number, number>): Person[] {
		const visibleStart = xScale.invert(-margin.left);
		const visibleEnd = xScale.invert(width + margin.right);
		
		// Binary search for efficiency
		let start = 0;
		let end = people.length - 1;

		// Find start index
		while (start < end) {
			const mid = Math.floor((start + end) / 2);
			const midEndYear = people[mid].deathYear || currentYear;
			if (midEndYear < visibleStart) {
				start = mid + 1;
			} else {
				end = mid;
			}
		}
		const startIdx = Math.max(0, start - 50);

		// Find end index
		end = people.length - 1;
		while (start < end) {
			const mid = Math.ceil((start + end) / 2);
			if (people[mid].birthYear > visibleEnd) {
				end = mid - 1;
			} else {
				start = mid;
			}
		}
		const endIdx = Math.min(people.length - 1, end + 50);

		return people.slice(startIdx, endIdx + 1);
	}

	function updateChartData() {
		if (!g || !people.length || !baseXScale) return;

		const xScale = zoomTransform ? zoomTransform.rescaleX(baseXScale) : baseXScale;
		const zoomLevel = zoomTransform?.k || 1;

		// Get visible people
		const visiblePeople = getVisiblePeople(xScale);
		
		// Create clusters or individual items based on zoom
		const clusters = createClusters(visiblePeople, xScale);
		const shouldCluster = clusters[0]?.count > 1 || false;

		// Update x-axis
		const xAxis = d3.axisBottom(xScale)
			.tickFormat(d3.format('d'))
			.ticks(Math.min(20, width / 80));
		
		g.select('.x-axis')
			.transition()
			.duration(200)
			.call(xAxis as any);

		// Grid lines
		const gridLines = g.select('.grid-lines')
			.selectAll('.grid-line')
			.data(xScale.ticks(10));

		gridLines.exit().remove();

		gridLines.enter()
			.append('line')
			.attr('class', 'grid-line')
			.merge(gridLines as any)
			.attr('x1', d => xScale(d))
			.attr('x2', d => xScale(d))
			.attr('y1', margin.top)
			.attr('y2', height - margin.bottom)
			.attr('stroke', 'currentColor')
			.attr('stroke-opacity', 0.1)
			.attr('stroke-width', 1);

		if (shouldCluster) {
			// Render clusters
			const clusterGroups = g.selectAll<SVGGElement, Cluster>('.cluster-group')
				.data(clusters, (d, i) => `cluster-${i}`);

			clusterGroups.exit().remove();

			const clusterEnter = clusterGroups.enter()
				.append('g')
				.attr('class', 'cluster-group');

			const clusterMerged = clusterEnter.merge(clusterGroups as any);

			// Cluster bars
			clusterMerged.selectAll<SVGRectElement, Cluster>('.cluster-bar')
				.data(d => [d])
				.join(
					enter => enter.append('rect').attr('class', 'cluster-bar'),
					update => update,
					exit => exit.remove()
				)
				.attr('x', d => xScale(d.startYear))
				.attr('y', d => d.y)
				.attr('width', d => Math.max(xScale(d.endYear) - xScale(d.startYear), 4))
				.attr('height', d => d.height)
				.attr('fill', '#3b82f6')
				.attr('opacity', 0.6)
				.attr('rx', 8)
				.attr('cursor', 'pointer')
				.on('click', (event, d) => {
					if (d.persons.length === 1) {
						onPersonClick(d.persons[0]);
					}
				})
				.on('mouseenter', function (event, d) {
					d3.select(this).attr('opacity', 0.8);
					showClusterTooltip(event, d);
				})
				.on('mouseleave', function () {
					d3.select(this).attr('opacity', 0.6);
					hideTooltip();
				});

			// Cluster labels
			clusterMerged.selectAll<SVGTextElement, Cluster>('.cluster-label')
				.data(d => [d])
				.join(
					enter => enter.append('text').attr('class', 'cluster-label'),
					update => update,
					exit => exit.remove()
				)
				.attr('x', d => xScale(d.startYear) + 8)
				.attr('y', d => d.y + d.height / 2)
				.attr('dy', '0.35em')
				.attr('fill', 'white')
				.attr('font-size', '11px')
				.attr('font-weight', '600')
				.text(d => `${d.count} personer`)
				.attr('pointer-events', 'none');
		} else {
			// Render individual items
			g.selectAll('.cluster-group').remove();

			const yScale = d3.scaleBand()
				.domain(clusters.map((_, i) => i.toString()))
				.range([margin.top, height - margin.bottom])
				.padding(0.1);

			const bars = g.selectAll<SVGGElement, Cluster>('.person-bar')
				.data(clusters, (d, i) => d.persons[0]?.id || `person-${i}`);

			bars.exit().remove();

			const barsEnter = bars.enter()
				.append('g')
				.attr('class', 'person-bar')
				.attr('transform', (_, i) => `translate(0, ${yScale(i.toString()) || 0})`);

			// Individual bars
			barsEnter.append('rect')
				.attr('class', 'bar')
				.merge(bars.select('.bar') as any)
				.attr('x', d => xScale(d.startYear))
				.attr('y', 0)
				.attr('height', barHeight)
				.attr('width', d => Math.max(xScale(d.endYear) - xScale(d.startYear), 2))
				.attr('fill', d => d.persons[0]?.color || '#6b7280')
				.attr('rx', 6)
				.attr('cursor', 'pointer')
				.on('click', (event, d) => onPersonClick(d.persons[0]))
				.on('mouseenter', function (event, d) {
					d3.select(this).attr('opacity', 0.85);
					showTooltip(event, d.persons[0]);
				})
				.on('mouseleave', function () {
					d3.select(this).attr('opacity', 1);
					hideTooltip();
				});

			// Labels (only when zoomed enough)
			if (zoomLevel > 1) {
				barsEnter.append('text')
					.attr('class', 'bar-label')
					.merge(bars.select('.bar-label') as any)
					.attr('x', d => xScale(d.startYear) + 10)
					.attr('y', barHeight / 2)
					.attr('dy', '0.35em')
					.attr('fill', 'white')
					.attr('font-size', '12px')
					.attr('font-weight', '500')
					.text(d => d.persons[0]?.name || '')
					.attr('pointer-events', 'none');
			}
		}

		// Update zoom indicator
		updateZoomIndicator(zoomLevel, shouldCluster);
	}

	function updateZoomIndicator(zoomLevel: number, isClustered: boolean) {
		let indicator = g.select('.zoom-indicator');
		if (indicator.empty()) {
			indicator = g.append('g').attr('class', 'zoom-indicator');
			indicator.append('rect')
				.attr('class', 'zoom-indicator-bg')
				.attr('rx', 8)
				.attr('fill', 'rgba(255, 255, 255, 0.95)')
				.attr('stroke', '#e5e7eb');
			indicator.append('text')
				.attr('class', 'zoom-indicator-text')
				.attr('x', 10)
				.attr('y', 20)
				.attr('font-size', '12px')
				.attr('fill', '#374151');
		}

		const text = isClustered 
			? `Zoom inn for detaljer • ${people.length.toLocaleString()} personer totalt`
			: `${Math.round(zoomLevel * 100)}% zoom`;

		indicator.select('.zoom-indicator-text').text(text);
		
		const bbox = (indicator.select('.zoom-indicator-text').node() as SVGTextElement)?.getBBox();
		if (bbox) {
			indicator.select('.zoom-indicator-bg')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', bbox.width + 20)
				.attr('height', bbox.height + 10);
		}

		indicator.attr('transform', `translate(${width - (bbox?.width || 200) - 30}, 20)`);
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
				<div class="font-semibold text-sm">${person.name}</div>
				<div class="text-xs text-gray-400 mt-1">${person.birthYear}${person.deathYear ? `–${person.deathYear}` : '–'}</div>
			`);
	}

	function showClusterTooltip(event: MouseEvent, cluster: Cluster) {
		const tooltip = d3.select('body').select('.tooltip').empty()
			? d3.select('body').append('div').attr('class', 'tooltip')
			: d3.select('body').select('.tooltip');

		const yearRange = cluster.startYear === cluster.endYear 
			? cluster.startYear.toString()
			: `${cluster.startYear}–${cluster.endYear}`;

		tooltip
			.style('opacity', 1)
			.style('left', event.pageX + 10 + 'px')
			.style('top', event.pageY - 10 + 'px')
			.html(`
				<div class="font-semibold text-sm">${cluster.count} personer</div>
				<div class="text-xs text-gray-400 mt-1">${yearRange}</div>
				<div class="text-xs text-gray-500 mt-1">Zoom inn for detaljer</div>
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
		background: transparent;
	}

	:global(.timeline-svg:active) {
		cursor: grabbing;
	}

	:global(.x-axis text) {
		fill: #6b7280;
		font-size: 11px;
		font-weight: 500;
	}

	:global(.dark .x-axis text) {
		fill: #9ca3af;
	}

	:global(.x-axis path),
	:global(.x-axis line) {
		stroke: #e5e7eb;
		stroke-width: 1.5;
	}

	:global(.dark .x-axis path),
	:global(.dark .x-axis line) {
		stroke: #374151;
	}

	:global(.tooltip) {
		position: absolute;
		padding: 10px 14px;
		background: rgba(17, 24, 39, 0.98);
		backdrop-filter: blur(8px);
		color: white;
		border-radius: 8px;
		pointer-events: none;
		font-size: 13px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
		z-index: 1000;
		opacity: 0;
		transition: opacity 0.15s;
		min-width: 150px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	:global(.dark .tooltip) {
		background: rgba(31, 41, 55, 0.98);
	}
</style>
