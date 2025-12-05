<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	import type { Person } from '../types';

	export let people: Person[] = [];
	export let onPersonClick: (person: Person) => void = () => {};

	let svg: SVGSVGElement;
	let container: HTMLDivElement;
	let gElement: SVGGElement;
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
	let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
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
		if (!container || typeof window === 'undefined') return;
		width = container.clientWidth;
		
		// Get height from container's bounding rect
		const rect = container.getBoundingClientRect();
		height = Math.max(rect.height, container.clientHeight || 0);
		
		// If still 0, try parent
		if (height === 0 && container.parentElement) {
			const parent = container.parentElement;
			const parentRect = parent.getBoundingClientRect();
			// Get wrapper height
			const wrapper = parent.parentElement;
			if (wrapper) {
				const wrapperRect = wrapper.getBoundingClientRect();
				height = wrapperRect.height;
			} else {
				height = parentRect.height;
			}
		}
		
		// Fallback: use viewport height
		if (height === 0) {
			height = window.innerHeight - 200; // Approximate header + footer
		}
		
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

		// Initialize g as D3 selection from gElement
		if (!g && gElement) {
			g = d3.select(gElement);
		}

		if (!g) return;

		zoom = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.5, 20])
			.translateExtent([
				[margin.left - (MAX_YEAR - MIN_YEAR) * 0.2, -Infinity],
				[width - margin.right + (MAX_YEAR - MIN_YEAR) * 0.2, Infinity]
			])
			.on('zoom', (event) => {
				zoomTransform = event.transform;
				render();
				updateZoomSlider();
			});

		d3.select(svg).call(zoom as any);
	}

	function render() {
		if (!g || !gElement || !baseXScale || width === 0 || height === 0 || people.length === 0) return;

		const xScale = zoomTransform.rescaleX(baseXScale);
		const zoomScale = zoomTransform.k;
		const visiblePeople = getVisiblePeople(people, zoomScale);
		
		// Grid lines (every 100 years) - using proper enter/update/exit
		const gridData = d3.range(MIN_YEAR, MAX_YEAR + 1, 100);
		const gridLines = g.selectAll('.grid-line')
			.data(gridData, d => d.toString());

		gridLines.exit().remove();

		const gridEnter = gridLines.enter()
			.append('line')
			.attr('class', 'grid-line');

		gridEnter.merge(gridLines as any)
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
			.style('opacity', 0)
			.remove();

		const rowsEnter = rows.enter()
			.append('g')
			.attr('class', 'person-row')
			.style('opacity', 0);

		rowsEnter.transition()
			.duration(400)
			.style('opacity', 1);

		const rowsMerged = rowsEnter.merge(rows as any);

		// Update row positions - spread across full height
		rowsMerged
			.attr('transform', (d, i) => {
				const y = getRowY(i, visiblePeople.length);
				return `translate(0, ${y - ROW_HEIGHT / 2})`;
			})
			// Ensure opacity is set correctly for both new and existing rows
			.style('opacity', 1);

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

		// X-axis - ensure only one exists
		let xAxisG = g.select('.x-axis');
		if (xAxisG.empty()) {
			xAxisG = g.append('g').attr('class', 'x-axis axis');
		}
		
		const xAxis = d3.axisBottom(xScale)
			.tickFormat(d3.format('d'))
			.ticks(Math.min(15, Math.floor(width / 100)));

		xAxisG
			.attr('transform', `translate(0, ${height - margin.bottom})`)
			.call(xAxis as any)
			.selectAll('text')
			.attr('fill', '#6b7280')
			.attr('font-size', '11px');
	}


	function zoomIn() {
		if (!svg) return;
		const newK = Math.min(20, zoomTransform.k * 1.5);
		zoomTransform = zoomTransform.scale(newK);
		d3.select(svg).call(zoom.transform as any, zoomTransform);
		render();
		updateZoomSlider();
	}

	function zoomOut() {
		if (!svg) return;
		const newK = Math.max(0.5, zoomTransform.k / 1.5);
		zoomTransform = zoomTransform.scale(newK);
		d3.select(svg).call(zoom.transform as any, zoomTransform);
		render();
		updateZoomSlider();
	}

	function handleZoomSliderChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = parseFloat(target.value);
		// Map slider value (0-100) to zoom scale (0.5-20)
		const minK = 0.5;
		const maxK = 20;
		const newK = minK + (value / 100) * (maxK - minK);
		zoomTransform = zoomTransform.scale(newK / zoomTransform.k);
		d3.select(svg).call(zoom.transform as any, zoomTransform);
		render();
	}

	function updateZoomSlider() {
		if (typeof window === 'undefined') return;
		const slider = document.getElementById('zoom-slider') as HTMLInputElement;
		if (!slider) return;
		const minK = 0.5;
		const maxK = 20;
		const value = ((zoomTransform.k - minK) / (maxK - minK)) * 100;
		slider.value = value.toString();
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		
		const resizeObserver = new ResizeObserver(() => {
			updateDimensions();
			if (g && baseXScale) {
				render();
			}
		});
		
		if (container) {
			resizeObserver.observe(container);
		}
		
		// Also observe parent for height changes
		if (container?.parentElement) {
			resizeObserver.observe(container.parentElement);
		}
		
		// Initialize g when element is available
		if (gElement) {
			g = d3.select(gElement);
		}
		
		// Use requestAnimationFrame for proper timing
		requestAnimationFrame(() => {
			updateDimensions();
			initializeZoom();
			if (g) {
				render();
				updateZoomSlider();
			}
			
			// Force another render after layout stabilizes
			setTimeout(() => {
				updateDimensions();
				if (g && baseXScale && width > 0 && height > 0) {
					render();
				}
			}, 200);
		});

		return () => {
			resizeObserver.disconnect();
		};
	});

	$: if (people.length > 0 && g && baseXScale && width > 0) {
		render();
		updateZoomSlider();
	}
</script>

<div class="timeline-wrapper">
	<div class="timeline-container" bind:this={container}>
		<svg bind:this={svg}>
			<g bind:this={gElement}></g>
		</svg>
		
		<!-- Zoom controls -->
		<div class="zoom-controls">
			<button class="zoom-btn" on:click={zoomIn} title="Zoom in">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				</svg>
			</button>
			<div class="zoom-slider-container">
				<input
					id="zoom-slider"
					type="range"
					min="0"
					max="100"
					value="0"
					class="zoom-slider"
					on:input={handleZoomSliderChange}
					title="Zoom level"
				/>
			</div>
			<button class="zoom-btn" on:click={zoomOut} title="Zoom out">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				</svg>
			</button>
		</div>
	</div>

</div>

<style>
	.timeline-wrapper {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.timeline-container {
		width: 100%;
		flex: 1;
		min-height: 0;
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
		overflow: visible;
		z-index: 10;
		border: 1px solid #e5e7eb;
	}

	.zoom-slider-container {
		padding: 4px 8px;
		background: white;
		border-top: 1px solid #e5e7eb;
		border-bottom: 1px solid #e5e7eb;
	}

	.zoom-slider {
		width: 20px;
		height: 120px;
		writing-mode: vertical-lr;
		direction: rtl;
		cursor: pointer;
		accent-color: #374151;
		-webkit-appearance: none;
		appearance: none;
		background: transparent;
	}

	.zoom-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		background: #374151;
		border-radius: 50%;
		cursor: pointer;
	}

	.zoom-slider::-moz-range-thumb {
		width: 12px;
		height: 12px;
		background: #374151;
		border-radius: 50%;
		cursor: pointer;
		border: none;
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