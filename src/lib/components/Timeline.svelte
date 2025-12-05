<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	import type { Person } from '../types';

	export let people: Person[] = [];
	export let onPersonClick: (person: Person) => void = () => {};

	let svg: SVGSVGElement;
	let container: HTMLDivElement;
	let width = 0;
	let height = 0;
	let currentYear = new Date().getFullYear();

	const MIN_YEAR = 1500;
	const MAX_YEAR = 2025;
	const NUM_VISIBLE_ROWS = 15;
	const ROW_HEIGHT = 50;
	const BAR_HEIGHT = 12;

	const margin = { top: 40, right: 80, bottom: 100, left: 200 };
	
	let baseXScale: d3.ScaleLinear<number, number>;
	let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
	let g: d3.Selection<SVGGElement, unknown, null, undefined>;
	let zoomTransform: d3.ZoomTransform = d3.zoomIdentity;
	let hoveredPerson: Person | null = null;

	function getProminenceThreshold(zoomScale: number): number {
		const minK = 0.5;
		const maxK = 20;
		const clamped = Math.max(minK, Math.min(maxK, zoomScale));
		const ratio = (clamped - minK) / (maxK - minK);
		return Math.round(100 - (ratio * 99));
	}

	function getVisiblePeople(people: Person[], zoomScale: number): Person[] {
		if (people.length === 0) return [];
		
		const threshold = getProminenceThreshold(zoomScale);
		const filtered = people.filter(p => p.prominenceScore >= threshold);
		
		const sorted = [...filtered].sort((a, b) => {
			if (b.prominenceScore !== a.prominenceScore) {
				return b.prominenceScore - a.prominenceScore;
			}
			return a.birthYear - b.birthYear;
		});

		const minRows = NUM_VISIBLE_ROWS;
		const maxRows = Math.min(sorted.length, NUM_VISIBLE_ROWS * 5);
		const rowCount = Math.floor(minRows + (zoomScale - 0.5) / (20 - 0.5) * (maxRows - minRows));
		
		return sorted.slice(0, Math.max(minRows, Math.min(rowCount, sorted.length)));
	}

	function getRowY(rowIndex: number, totalRows: number): number {
		const totalHeight = totalRows * ROW_HEIGHT;
		const startY = (height - margin.top - margin.bottom) / 2 - totalHeight / 2 + margin.top;
		return startY + (rowIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
	}

	function updateDimensions() {
		if (!container) return;
		width = container.clientWidth;
		height = container.clientHeight;
		
		if (svg && width > 0 && height > 0) {
			d3.select(svg)
				.attr('width', width)
				.attr('height', height);
				
			if (baseXScale) {
				baseXScale.range([margin.left, width - margin.right]);
			}
		}
	}

	function initializeZoom() {
		if (!svg || width === 0) return;

		baseXScale = d3.scaleLinear()
			.domain([MIN_YEAR, MAX_YEAR])
			.range([margin.left, width - margin.right]);

		zoom = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.5, 20])
			.translateExtent([
				[margin.left - (MAX_YEAR - MIN_YEAR) * 0.2, -Infinity],
				[width - margin.right + (MAX_YEAR - MIN_YEAR) * 0.2, Infinity]
			])
			.on('zoom', (event) => {
				zoomTransform = event.transform;
				render();
				renderMiniTimeline();
			});

		d3.select(svg).call(zoom as any);
	}

	function render() {
		if (!g || !baseXScale || width === 0 || height === 0 || people.length === 0) return;

		const xScale = zoomTransform.rescaleX(baseXScale);
		const zoomScale = zoomTransform.k;
		const visiblePeople = getVisiblePeople(people, zoomScale);
		
		// Clear existing
		g.selectAll('.person-row, .grid-line, .axis').remove();

		// Grid lines (every 100 years)
		const gridLines = g.selectAll('.grid-line')
			.data(d3.range(MIN_YEAR, MAX_YEAR + 1, 100));

		gridLines.enter()
			.append('line')
			.attr('class', 'grid-line')
			.attr('x1', d => xScale(d))
			.attr('x2', d => xScale(d))
			.attr('y1', margin.top)
			.attr('y2', height - margin.bottom)
			.attr('stroke', '#e5e7eb')
			.attr('stroke-width', 1)
			.attr('opacity', 0.5);

		// Person rows
		const rows = g.selectAll('.person-row')
			.data(visiblePeople, d => d.id);

		rows.exit()
			.transition()
			.duration(300)
			.attr('opacity', 0)
			.remove();

		const rowsEnter = rows.enter()
			.append('g')
			.attr('class', 'person-row')
			.attr('opacity', 0);

		rowsEnter.transition()
			.duration(400)
			.attr('opacity', 1);

		const rowsMerged = rowsEnter.merge(rows as any);

		// Update row positions - spread across full height
		rowsMerged.attr('transform', (d, i) => {
			const y = getRowY(i, visiblePeople.length);
			return `translate(0, ${y - ROW_HEIGHT / 2})`;
		});

		// Lifespan bars
		const bars = rowsMerged.selectAll('.lifespan-bar')
			.data(d => [d]);

		bars.enter()
			.append('rect')
			.attr('class', 'lifespan-bar')
			.merge(bars as any)
			.attr('x', d => {
				const startX = xScale(d.birthYear);
				return Math.max(margin.left, startX);
			})
			.attr('y', ROW_HEIGHT / 2 - BAR_HEIGHT / 2)
			.attr('width', d => {
				const endYear = d.deathYear || currentYear;
				const startX = xScale(d.birthYear);
				const endX = xScale(endYear);
				return Math.max(10, endX - startX);
			})
			.attr('height', BAR_HEIGHT)
			.attr('fill', d => d.color)
			.attr('opacity', d => hoveredPerson?.id === d.id ? 1 : 0.8)
			.attr('stroke', d => hoveredPerson?.id === d.id ? '#111827' : 'rgba(17,24,39,0.2)')
			.attr('stroke-width', d => hoveredPerson?.id === d.id ? 2 : 0.5)
			.attr('rx', BAR_HEIGHT / 2)
			.attr('cursor', 'pointer')
			.on('click', (event, d) => {
				event.stopPropagation();
				onPersonClick(d);
			})
			.on('mouseenter', (event, d) => {
				hoveredPerson = d;
				render();
			})
			.on('mouseleave', () => {
				hoveredPerson = null;
				render();
			});

		// Name labels
		const nameLabels = rowsMerged.selectAll('.name-label')
			.data(d => [d]);

		nameLabels.enter()
			.append('text')
			.attr('class', 'name-label')
			.merge(nameLabels as any)
			.attr('x', margin.left - 10)
			.attr('y', ROW_HEIGHT / 2 + 4)
			.attr('text-anchor', 'end')
			.attr('fill', '#111827')
			.attr('font-size', '13px')
			.attr('font-weight', '500')
			.attr('font-family', 'Inter, system-ui, sans-serif')
			.text(d => d.name);

		// Year labels
		const yearLabels = rowsMerged.selectAll('.year-label')
			.data(d => [d]);

		yearLabels.enter()
			.append('text')
			.attr('class', 'year-label')
			.merge(yearLabels as any)
			.attr('x', d => {
				const endYear = d.deathYear || currentYear;
				return xScale(endYear) + 5;
			})
			.attr('y', ROW_HEIGHT / 2 + 4)
			.attr('fill', '#6b7280')
			.attr('font-size', '11px')
			.attr('font-family', 'ui-monospace, monospace')
			.text(d => {
				const endYear = d.deathYear || currentYear;
				return `${d.birthYear}–${endYear}`;
			});

		// X-axis
		const xAxis = d3.axisBottom(xScale)
			.tickFormat(d3.format('d'))
			.ticks(Math.min(15, Math.floor(width / 100)));

		g.selectAll('.x-axis').remove();
		g.append('g')
			.attr('class', 'x-axis axis')
			.attr('transform', `translate(0, ${height - margin.bottom})`)
			.call(xAxis as any)
			.selectAll('text')
			.attr('fill', '#6b7280')
			.attr('font-size', '11px');
	}

	// Mini timeline
	let miniTimelineSvg: SVGSVGElement;
	let miniG: d3.Selection<SVGGElement, unknown, null, undefined>;

	function renderMiniTimeline() {
		if (!miniTimelineSvg || !baseXScale || width === 0) return;

		const xScale = zoomTransform.rescaleX(baseXScale);
		
		if (!miniG) {
			miniG = d3.select(miniTimelineSvg).append('g');
		}
		
		miniG.selectAll('*').remove();
		
		const miniWidth = width - margin.left - margin.right;
		const miniScale = d3.scaleLinear()
			.domain([MIN_YEAR, MAX_YEAR])
			.range([0, miniWidth]);

		// Mini axis
		const miniAxis = d3.axisBottom(miniScale)
			.tickFormat(d3.format('d'))
			.ticks(Math.min(10, Math.floor(miniWidth / 60)));

		miniG.append('g')
			.attr('transform', `translate(${margin.left}, 30)`)
			.call(miniAxis as any)
			.selectAll('text')
			.attr('fill', '#6b7280')
			.attr('font-size', '10px');

		// Viewport indicator
		const viewStart = Math.max(MIN_YEAR, xScale.invert(margin.left));
		const viewEnd = Math.min(MAX_YEAR, xScale.invert(width - margin.right));
		const viewStartX = miniScale(viewStart);
		const viewEndX = miniScale(viewEnd);

		if (viewEndX > viewStartX) {
			miniG.append('rect')
				.attr('x', margin.left + viewStartX)
				.attr('y', 0)
				.attr('width', viewEndX - viewStartX)
				.attr('height', 30)
				.attr('fill', 'rgba(59, 130, 246, 0.2)')
				.attr('stroke', '#3b82f6')
				.attr('stroke-width', 2)
				.attr('cursor', 'pointer')
				.on('click', (event) => {
					const clickX = d3.pointer(event, miniTimelineSvg)[0] - margin.left;
					const targetYear = Math.max(MIN_YEAR, Math.min(MAX_YEAR, miniScale.invert(clickX)));
					const targetX = baseXScale(targetYear);
					const centerX = width / 2;
					const translateX = (centerX - targetX) / zoomTransform.k;
					
					zoomTransform = zoomTransform.translate(translateX, 0);
					d3.select(svg).call(zoom.transform as any, zoomTransform);
					render();
					renderMiniTimeline();
				});
		}

		// Clickable background
		miniG.append('rect')
			.attr('x', margin.left)
			.attr('y', 0)
			.attr('width', miniWidth)
			.attr('height', 60)
			.attr('fill', 'transparent')
			.attr('cursor', 'pointer')
			.on('click', (event) => {
				const clickX = d3.pointer(event, miniTimelineSvg)[0] - margin.left;
				const targetYear = Math.max(MIN_YEAR, Math.min(MAX_YEAR, miniScale.invert(clickX)));
				const targetX = baseXScale(targetYear);
				const centerX = width / 2;
				const translateX = (centerX - targetX) / zoomTransform.k;
				
				zoomTransform = zoomTransform.translate(translateX, 0);
				d3.select(svg).call(zoom.transform as any, zoomTransform);
				render();
				renderMiniTimeline();
			});
	}

	function zoomIn() {
		if (!svg) return;
		const newK = Math.min(20, zoomTransform.k * 1.5);
		zoomTransform = zoomTransform.scale(newK);
		d3.select(svg).call(zoom.transform as any, zoomTransform);
		render();
		renderMiniTimeline();
	}

	function zoomOut() {
		if (!svg) return;
		const newK = Math.max(0.5, zoomTransform.k / 1.5);
		zoomTransform = zoomTransform.scale(newK);
		d3.select(svg).call(zoom.transform as any, zoomTransform);
		render();
		renderMiniTimeline();
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		
		const resizeObserver = new ResizeObserver(() => {
			updateDimensions();
			if (g && baseXScale) {
				render();
				renderMiniTimeline();
			}
		});
		
		if (container) {
			resizeObserver.observe(container);
		}
		
		setTimeout(() => {
			updateDimensions();
			initializeZoom();
			if (g) {
				render();
				renderMiniTimeline();
			}
		}, 100);

		return () => {
			resizeObserver.disconnect();
		};
	});

	$: if (people.length > 0 && g && baseXScale && width > 0) {
		render();
		renderMiniTimeline();
	}
</script>

<div class="timeline-container" bind:this={container}>
	<svg bind:this={svg}>
		<g bind:this={g}></g>
	</svg>
	
	<!-- Zoom controls -->
	<div class="zoom-controls">
		<button class="zoom-btn" on:click={zoomIn} title="Zoom in">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
				<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		</button>
		<button class="zoom-btn" on:click={zoomOut} title="Zoom out">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
				<path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		</button>
	</div>
</div>

<!-- Mini timeline -->
<div class="mini-timeline-container">
	<svg bind:this={miniTimelineSvg} class="mini-timeline-svg"></svg>
</div>

<style>
	.timeline-container {
		width: 100%;
		height: 100%;
		position: relative;
		background: #faf9f6;
		overflow: hidden;
	}

	svg {
		width: 100%;
		height: 100%;
		cursor: grab;
		display: block;
	}

	svg:active {
		cursor: grabbing;
	}

	.zoom-controls {
		position: absolute;
		right: 16px;
		top: 60px;
		display: flex;
		flex-direction: column;
		gap: 0;
		background: white;
		border-radius: 2px;
		box-shadow: 0 1px 4px rgba(0,0,0,0.3);
		overflow: hidden;
		z-index: 10;
		border: 1px solid #e5e7eb;
	}

	.zoom-btn {
		width: 32px;
		height: 32px;
		background: white;
		border: none;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: #374151;
		transition: background 0.15s;
		padding: 0;
	}

	.zoom-btn:last-child {
		border-bottom: none;
	}

	.zoom-btn:hover {
		background: #f9fafb;
	}

	.zoom-btn:active {
		background: #f3f4f6;
	}

	.zoom-btn svg {
		width: 16px;
		height: 16px;
	}

	.mini-timeline-container {
		width: 100%;
		height: 70px;
		background: white;
		border-top: 1px solid #e5e7eb;
		padding: 10px 0;
	}

	.mini-timeline-svg {
		width: 100%;
		height: 100%;
	}

	:global(.person-row) {
		pointer-events: none;
	}

	:global(.lifespan-bar) {
		pointer-events: all;
		transition: opacity 0.2s, stroke-width 0.2s;
	}

	:global(.lifespan-bar:hover) {
		filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
	}
</style>