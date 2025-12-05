<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { spring } from 'svelte/motion';
	import * as d3 from 'd3';
	import type { Person } from '../types';

	export let people: Person[] = [];
	export let onPersonClick: (person: Person) => void = () => {};

	let svg: SVGSVGElement;
	let container: HTMLDivElement;
	let width = 0;
	let height = 1200; // Much taller to spread people out
	let currentYear = new Date().getFullYear();

	const MIN_YEAR = 1500;
	const MAX_YEAR = 2025;
	const margin = { top: 80, right: 60, bottom: 100, left: 60 };
	const densityBarWidth = 40;
	const VERTICAL_SPREAD = 1200; // Vertical space to spread people
	const MIN_SPACING = 40; // Minimum pixels between people at same time

	let baseXScale: d3.ScaleLinear<number, number>;
	let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
	let g: d3.Selection<SVGGElement, unknown, null, undefined>;
	let zoomTransform: d3.ZoomTransform = d3.zoomIdentity;
	let isDragging = false;
	let hoveredPerson: Person | null = null;
	let isAltDragging = false;
	let selectionStart: number | null = null;
	let selectionEnd: number | null = null;

	// Y position map for consistent vertical spreading
	const yPositionMap = new Map<string, number>();

	function calculateYPositions(people: Person[], xScale: d3.ScaleLinear<number, number>): Map<string, number> {
		const positions = new Map<string, number>();
		const timelineTop = margin.top;
		const timelineBottom = height - margin.bottom;
		const timelineHeight = timelineBottom - timelineTop;
		
		// Group people by their X position (birth year)
		const peopleByX = new Map<number, Person[]>();
		people.forEach(person => {
			const x = Math.round(xScale(person.birthYear) / MIN_SPACING) * MIN_SPACING;
			if (!peopleByX.has(x)) {
				peopleByX.set(x, []);
			}
			peopleByX.get(x)!.push(person);
		});

		// Spread people out vertically
		peopleByX.forEach((peopleAtX, x) => {
			if (peopleAtX.length === 1) {
				// Single person - place in middle area
				const hash = peopleAtX[0].id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
				const y = timelineTop + (timelineHeight / 2) + (hash % (timelineHeight / 4)) - (timelineHeight / 8);
				positions.set(peopleAtX[0].id, Math.max(timelineTop + 20, Math.min(timelineBottom - 20, y)));
			} else {
				// Multiple people - spread evenly
				peopleAtX.sort((a, b) => {
					const hashA = a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
					const hashB = b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
					return hashA - hashB;
				});
				
				const spacing = Math.min(MIN_SPACING, timelineHeight / peopleAtX.length);
				const startY = timelineTop + (timelineHeight - (peopleAtX.length - 1) * spacing) / 2;
				
				peopleAtX.forEach((person, index) => {
					positions.set(person.id, startY + index * spacing);
				});
			}
		});

		return positions;
	}

	function getYPosition(person: Person, xScale: d3.ScaleLinear<number, number>, allVisiblePeople: Person[]): number {
		// Recalculate if needed
		const key = `${person.id}_${xScale.range()[0]}_${xScale.range()[1]}`;
		if (!yPositionMap.has(key)) {
			const positions = calculateYPositions(allVisiblePeople, xScale);
			positions.forEach((y, id) => {
				yPositionMap.set(`${id}_${xScale.range()[0]}_${xScale.range()[1]}`, y);
			});
		}
		return yPositionMap.get(key) || (height / 2);
	}

	function zoomThreshold(scale: number): number {
		// Map zoom scale (k) to prominence threshold
		// k: 1 (zoomed out) -> threshold 95 (only most famous)
		// k: 10 (zoomed in) -> threshold 5 (almost everyone)
		const minK = 0.5;
		const maxK = 15;
		const clamped = Math.max(minK, Math.min(maxK, scale));
		const ratio = (clamped - minK) / (maxK - minK);
		return Math.round(100 - (ratio * 90)); // 100 to 10
	}

	function getTopPeople(): Person[] {
		return [...people]
			.sort((a, b) => b.prominenceScore - a.prominenceScore)
			.slice(0, 10);
	}

	let isInitialized = false;

	onMount(() => {
		if (!svg || !container) return;

		updateDimensions();
		initD3();

		const resizeObserver = new ResizeObserver(() => {
			updateDimensions();
			if (isInitialized) {
				updateChart();
			}
		});

		resizeObserver.observe(container);
		onDestroy(() => resizeObserver.disconnect());
	});

	function updateDimensions() {
		if (!container) return;
		width = container.clientWidth || 1200;
	}

	function initD3() {
		if (!svg || !people.length) return;

		baseXScale = d3
			.scaleLinear()
			.domain([MIN_YEAR, MAX_YEAR])
			.range([margin.left + densityBarWidth, width - margin.right]);

		if (!isInitialized) {
			d3.select(svg).selectAll('*').remove();
			g = d3.select(svg).append('g');

			// Create defs for clipping (for circular images)
			const defs = g.append('defs');
			// Create a reusable circular clip path that we can scale
			const clipCircle = defs.append('clipPath')
				.attr('id', 'clip-circle');
			clipCircle.append('circle')
				.attr('r', 50)
				.attr('cx', 50)
				.attr('cy', 50);

			// Create groups
			g.append('g').attr('class', 'density-bars');
			g.append('g').attr('class', 'lifespan-segments');
			g.append('g').attr('class', 'person-images');
			g.append('g').attr('class', 'labels');
			g.append('g').attr('class', 'x-axis')
				.attr('transform', `translate(0, ${height - margin.bottom})`);
			g.append('g').attr('class', 'grid-lines');

			// Zoom behavior
			zoom = d3
				.zoom<SVGSVGElement, unknown>()
				.scaleExtent([0.5, 20])
				.translateExtent([
					[-margin.left - densityBarWidth, -margin.top],
					[width - margin.right, height - margin.bottom]
				])
				.on('start', (event) => {
					isDragging = true;
					// Check if Alt key is pressed for selection mode
					if (event.sourceEvent && (event.sourceEvent.altKey || event.sourceEvent.metaKey)) {
						isAltDragging = true;
						selectionStart = event.sourceEvent.offsetX;
					}
				})
				.on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
					if (isAltDragging && event.sourceEvent) {
						selectionEnd = event.sourceEvent.offsetX;
					}
					zoomTransform = event.transform;
					updateChart();
				})
				.on('end', () => {
					isDragging = false;
					if (isAltDragging) {
						isAltDragging = false;
						selectionStart = null;
						selectionEnd = null;
					}
				});

			d3.select(svg).call(zoom);
			isInitialized = true;
		}

		updateChart();
	}

	function getVisiblePeople(): Person[] {
		if (!people.length) return [];

		const threshold = zoomThreshold(zoomTransform?.k || 1);
		const top = getTopPeople();

		// Always include top 10
		const topIds = new Set(top.map(p => p.id));

		// Filter by prominence and get visible range
		const xScale = zoomTransform ? zoomTransform.rescaleX(baseXScale) : baseXScale;
		const visibleStart = xScale.invert(-margin.left - densityBarWidth);
		const visibleEnd = xScale.invert(width);

		const filtered = people.filter(p => {
			const endYear = p.deathYear || currentYear;
			const isVisibleInRange = p.birthYear <= visibleEnd && endYear >= visibleStart;
			const meetsThreshold = topIds.has(p.id) || p.prominenceScore >= threshold;
			return isVisibleInRange && meetsThreshold;
		});

		return filtered;
	}

	function calculateDensity(): Array<{ year: number; births: number; deaths: number }> {
		const density: Array<{ year: number; births: number; deaths: number }> = [];
		
		// Calculate by decade
		for (let year = MIN_YEAR; year <= MAX_YEAR; year += 10) {
			const decadeStart = Math.floor(year / 10) * 10;
			const births = people.filter(p => Math.floor(p.birthYear / 10) * 10 === decadeStart).length;
			const deaths = people.filter(p => 
				p.deathYear && Math.floor(p.deathYear / 10) * 10 === decadeStart
			).length;
			density.push({ year: decadeStart, births, deaths });
		}
		
		return density;
	}

	function updateChart() {
		if (!g || !people.length || !baseXScale) return;

		const xScale = zoomTransform ? zoomTransform.rescaleX(baseXScale) : baseXScale;
		const visiblePeople = getVisiblePeople();
		const zoomLevel = zoomTransform?.k || 1;
		const showLabels = zoomLevel > 3;
		const topPeople = getTopPeople();
		const topIds = new Set(topPeople.map(p => p.id));

		// Update x-axis
		const xAxis = d3.axisBottom(xScale)
			.tickFormat(d3.format('d'))
			.ticks(Math.min(30, width / 60));
		
		g.select('.x-axis')
			.transition()
			.duration(200)
			.call(xAxis as any);

		// Grid lines
		const gridLines = g.select('.grid-lines')
			.selectAll<SVGLineElement, number>('.grid-line')
			.data(xScale.ticks(20));

		gridLines.exit().remove();

		gridLines.enter()
			.append('line')
			.attr('class', 'grid-line')
			.merge(gridLines)
			.attr('x1', d => xScale(d))
			.attr('x2', d => xScale(d))
			.attr('y1', margin.top)
			.attr('y2', height - margin.bottom)
			.attr('stroke', 'currentColor')
			.attr('stroke-opacity', 0.05)
			.attr('stroke-width', 1);

		// Density bars (vertical bars on left side, aligned to timeline)
		const density = calculateDensity();
		const maxDensity = Math.max(1, ...density.map(d => d.births + d.deaths));
		const densityScale = d3.scaleLinear()
			.domain([0, maxDensity])
			.range([0, 60]); // Max bar height

		const densityBars = g.select('.density-bars')
			.selectAll<SVGRectElement, typeof density[0]>('.density-bar')
			.data(density, d => d.year.toString());

		densityBars.exit().remove();

		const densityEnter = densityBars.enter()
			.append('rect')
			.attr('class', 'density-bar');

		densityEnter.merge(densityBars as any)
			.attr('x', densityBarWidth - 12)
			.attr('y', d => {
				// Position at timeline center, offset by bar height
				const decadeX = xScale(d.year);
				const centerY = (height - margin.top - margin.bottom) / 2 + margin.top;
				const barHeight = densityScale(d.births + d.deaths);
				return centerY - barHeight / 2;
			})
			.attr('width', 6)
			.attr('height', d => densityScale(d.births + d.deaths))
			.attr('fill', '#3b82f6')
			.attr('opacity', 0.5)
			.attr('rx', 3);

		// Density heatmap (horizontal bar above timeline)
		const heatmapData = density.map(d => ({
			year: d.year,
			intensity: (d.births + d.deaths) / maxDensity
		}));

		const heatmap = g.select('.heatmap').empty()
			? g.append('g').attr('class', 'heatmap')
			: g.select('.heatmap');

		const heatmapRects = heatmap
			.selectAll<SVGRectElement, typeof heatmapData[0]>('.heatmap-bar')
			.data(heatmapData, d => d.year.toString());

		heatmapRects.exit().remove();

		const heatmapEnter = heatmapRects.enter()
			.append('rect')
			.attr('class', 'heatmap-bar');

		heatmapEnter.merge(heatmapRects as any)
			.attr('x', d => xScale(d.year))
			.attr('y', margin.top - 30)
			.attr('width', Math.max(2, (xScale(MAX_YEAR) - xScale(MIN_YEAR)) / heatmapData.length))
			.attr('height', 8)
			.attr('fill', d => d3.interpolateViridis(d.intensity))
			.attr('opacity', 0.6)
			.attr('rx', 2);

		// Check if person is in selection range
		const isInSelection = (person: Person): boolean => {
			if (!isAltDragging || selectionStart === null || selectionEnd === null) return false;
			const startYear = Math.round(xScale.invert(selectionStart));
			const endYear = Math.round(xScale.invert(selectionEnd));
			const minYear = Math.min(startYear, endYear);
			const maxYear = Math.max(startYear, endYear);
			const personEndYear = person.deathYear || currentYear;
			return person.birthYear <= maxYear && personEndYear >= minYear;
		};

		// Lifespan segments (horizontal bars like the Big Map)
		const segmentHeight = Math.max(2, Math.min(6, 20 / zoomLevel));
		const segments = g.select('.lifespan-segments')
			.selectAll<SVGRectElement, Person>('.lifespan-segment')
			.data(visiblePeople, d => d.id);

		segments.exit()
			.transition()
			.duration(200)
			.attr('opacity', 0)
			.attr('height', 0)
			.remove();

		const segmentsEnter = segments.enter()
			.append('rect')
			.attr('class', 'lifespan-segment')
			.attr('opacity', 0)
			.attr('height', 0);

		segmentsEnter.merge(segments as any)
			.transition()
			.duration(300)
			.attr('x', d => {
				const startX = xScale(d.birthYear);
				return Math.max(margin.left + densityBarWidth, startX);
			})
			.attr('y', d => {
				const yPos = getYPosition(d, xScale, visiblePeople);
				return yPos - segmentHeight / 2;
			})
			.attr('width', d => {
				const endYear = d.deathYear || currentYear;
				const startX = xScale(d.birthYear);
				const endX = xScale(endYear);
				const width = Math.max(10, endX - startX);
				return width;
			})
			.attr('height', segmentHeight)
			.attr('fill', d => d.color)
			.attr('opacity', d => {
				if (hoveredPerson?.id === d.id) return 1;
				if (isInSelection(d)) return 0.95;
				return topIds.has(d.id) ? 0.85 : 0.7;
			})
			.attr('stroke', d => {
				if (isInSelection(d)) return '#fbbf24';
				return topIds.has(d.id) ? '#111827' : 'rgba(17,24,39,0.2)';
			})
			.attr('stroke-width', d => {
				if (isInSelection(d)) return 2;
				return topIds.has(d.id) ? 1.5 : 0.5;
			})
			.attr('cursor', 'pointer')
			.attr('rx', 1)
			.style('filter', d => {
				if (hoveredPerson?.id === d.id) return 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
				return 'none';
			})
			.on('click', (event, d) => {
				event.stopPropagation();
				onPersonClick(d);
			})
			.on('mouseenter', (event, d) => {
				hoveredPerson = d;
				d3.select(event.currentTarget)
					.attr('opacity', 1)
					.transition()
					.duration(150)
					.attr('height', segmentHeight * 1.5);
				showTooltip(event, d);
			})
			.on('mouseleave', (event) => {
				hoveredPerson = null;
				d3.select(event.currentTarget)
					.attr('opacity', 0.7)
					.transition()
					.duration(150)
					.attr('height', segmentHeight);
				hideTooltip();
			})
			.on('mousemove', (event, d) => {
				showTooltip(event, d);
			});

		// Images (only when zoomed in enough)
		const showImages = zoomLevel > 5;
		const imageSize = Math.max(20, Math.min(40, zoomLevel * 3));
		
		if (showImages) {
			const imageGroups = g.select('.person-images')
				.selectAll<SVGGElement, Person>('.person-image-group')
				.data(visiblePeople.filter(p => p.imageUrl && (topIds.has(p.id) || zoomLevel > 8)), d => d.id);

			imageGroups.exit().remove();

			const imageGroupsEnter = imageGroups.enter()
				.append('g')
				.attr('class', 'person-image-group')
				.attr('opacity', 0);

			imageGroupsEnter.merge(imageGroups as any)
				.transition()
				.duration(300)
				.attr('opacity', d => hoveredPerson?.id === d.id ? 1 : 0.9)
				.attr('transform', d => {
					const startX = xScale(d.birthYear);
					const x = Math.max(margin.left + densityBarWidth, startX) - imageSize / 2;
					const y = getYPosition(d, xScale, visiblePeople) - imageSize / 2;
					return `translate(${x}, ${y})`;
				})
				.style('cursor', 'pointer')
				.on('click', (event, d) => {
					event.stopPropagation();
					onPersonClick(d);
				});

			// Create clip paths for circular images
			imageGroupsEnter.each(function(d, i) {
				const clipId = `clip-person-${i}-${d.id.replace(/[^a-zA-Z0-9]/g, '')}`;
				const defs = g.select('defs');
				const existingClip = defs.select(`#${clipId}`);
				if (existingClip.empty()) {
					defs.append('clipPath')
						.attr('id', clipId)
						.append('circle')
						.attr('r', imageSize / 2)
						.attr('cx', imageSize / 2)
						.attr('cy', imageSize / 2);
				}
				
				// Add image to group with clip path
				d3.select(this).append('image')
					.attr('class', 'person-image')
					.attr('width', imageSize)
					.attr('height', imageSize)
					.attr('href', d.imageUrl || '')
					.attr('clip-path', `url(#${clipId})`)
					.on('error', function() {
						d3.select(this.parentElement).attr('opacity', 0);
					});
			});

			// Update existing images
			imageGroups.selectAll('.person-image')
				.attr('width', imageSize)
				.attr('height', imageSize);
		} else {
			g.select('.person-images').selectAll('.person-image-group').remove();
		}

		// Labels (on segments - name and years)
		const showNameLabels = zoomLevel > 2 || topIds.size > 0;
		const labels = g.select('.labels')
			.selectAll<SVGGElement, Person>('.person-label-group')
			.data(visiblePeople.filter(p => showNameLabels && (topIds.has(p.id) || zoomLevel > 2.5)), d => d.id);

		labels.exit().remove();

		const labelsEnter = labels.enter()
			.append('g')
			.attr('class', 'person-label-group')
			.attr('pointer-events', 'none');

		const labelGroups = labelsEnter.merge(labels as any);

		// Name label
		const nameLabels = labelGroups.selectAll<SVGTextElement, Person>('.name-label')
			.data(d => [d]);

		nameLabels.enter()
			.append('text')
			.attr('class', 'name-label')
			.merge(nameLabels as any)
			.transition()
			.duration(300)
			.attr('x', d => {
				const startX = xScale(d.birthYear);
				return Math.max(margin.left + densityBarWidth + 4, startX);
			})
			.attr('y', d => {
				const yPos = getYPosition(d, xScale, visiblePeople);
				return yPos - segmentHeight / 2 - 3;
			})
			.attr('fill', '#111827')
			.attr('font-size', d => topIds.has(d.id) ? '12px' : '10px')
			.attr('font-weight', d => topIds.has(d.id) ? '600' : '500')
			.style('paint-order', 'stroke')
			.style('stroke', '#faf9f6')
			.style('stroke-width', '3px')
			.style('stroke-linejoin', 'round')
			.text(d => d.name);

		// Years label (on segment or below)
		const yearLabels = labelGroups.selectAll<SVGTextElement, Person>('.year-label')
			.data(d => [d]);

		yearLabels.enter()
			.append('text')
			.attr('class', 'year-label')
			.merge(yearLabels as any)
			.transition()
			.duration(300)
			.attr('x', d => {
				const endYear = d.deathYear || currentYear;
				const endX = xScale(endYear);
				return endX - 2;
			})
			.attr('y', d => {
				const yPos = getYPosition(d, xScale, visiblePeople);
				return yPos + segmentHeight / 2 + 12;
			})
			.attr('fill', '#6b7280')
			.attr('font-size', '9px')
			.attr('font-weight', '400')
			.attr('text-anchor', 'end')
			.style('paint-order', 'stroke')
			.style('stroke', '#faf9f6')
			.style('stroke-width', '2px')
			.style('stroke-linejoin', 'round')
			.text(d => {
				const endYear = d.deathYear || currentYear;
				return `${d.birthYear}–${endYear}`;
			});

		// Selection highlight (Alt-drag)
		const selection = g.select('.selection');
		if (isAltDragging && selectionStart !== null && selectionEnd !== null && baseXScale) {
			const xScale = zoomTransform ? zoomTransform.rescaleX(baseXScale) : baseXScale;
			const startYear = Math.round(xScale.invert(selectionStart));
			const endYear = Math.round(xScale.invert(selectionEnd));
			const minYear = Math.min(startYear, endYear);
			const maxYear = Math.max(startYear, endYear);
			
			if (selection.empty()) {
				g.append('rect').attr('class', 'selection');
			}
			
			selection
				.attr('x', xScale(minYear))
				.attr('y', margin.top)
				.attr('width', xScale(maxYear) - xScale(minYear))
				.attr('height', height - margin.top - margin.bottom)
				.attr('fill', 'rgba(59, 130, 246, 0.2)')
				.attr('stroke', '#3b82f6')
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', '5,5');
		} else {
			selection.remove();
		}

		// Update zoom indicator
		updateZoomIndicator(zoomLevel);
	}

	function updateZoomIndicator(zoomLevel: number) {
		if (!g) return;
		
		let indicator = g.select('.zoom-indicator');
		if (indicator.empty()) {
			indicator = g.append('g').attr('class', 'zoom-indicator');
			indicator.append('rect')
				.attr('class', 'zoom-indicator-bg')
				.attr('rx', 12)
				.attr('fill', 'rgba(255,255,255,0.9)');
			indicator.append('text')
				.attr('class', 'zoom-indicator-text')
				.attr('x', 12)
				.attr('y', 22)
				.attr('font-size', '12px')
				.attr('fill', '#111827')
				.attr('font-weight', '500');
		}

		const threshold = zoomThreshold(zoomLevel);
		const visibleCount = getVisiblePeople().length;
		const text = `${visibleCount.toLocaleString()} personer • Prominence ≥ ${threshold}`;

		indicator.select('.zoom-indicator-text').text(text);
		
		const textNode = indicator.select('.zoom-indicator-text').node() as SVGTextElement;
		const bbox = textNode?.getBBox();
		if (bbox) {
			indicator.select('.zoom-indicator-bg')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', bbox.width + 24)
				.attr('height', bbox.height + 16);
			
			indicator.attr('transform', `translate(${width - bbox.width - 54}, 20)`);
		}
	}

	function showTooltip(event: MouseEvent, person: Person) {
		const tooltip = d3.select('body').select('.tooltip').empty()
			? d3.select('body').append('div').attr('class', 'tooltip')
			: d3.select('body').select('.tooltip');

		tooltip
			.style('opacity', 1)
			.style('left', event.pageX + 15 + 'px')
			.style('top', event.pageY - 10 + 'px')
			.html(`
				<div class="font-semibold text-sm text-gray-900">${person.name}</div>
				<div class="text-xs text-gray-600 mt-0.5">${person.birthYear}${person.deathYear ? `–${person.deathYear}` : '–'}</div>
				<div class="text-xs text-gray-500 mt-1">${person.occupations.slice(0, 2).join(', ')}</div>
			`);
	}

	function hideTooltip() {
		d3.select('.tooltip').style('opacity', 0);
	}

	function handleZoomIn() {
		if (!svg || !zoom) return;
		
		const centerX = width / 2;
		const centerY = height / 2;
		const currentK = zoomTransform?.k || 1;
		const newK = currentK * 1.5;
		
		// Zoom centered on screen center
		const newTransform = (zoomTransform || d3.zoomIdentity)
			.scale(newK);
		
		d3.select(svg)
			.transition()
			.duration(300)
			.call(zoom.scaleBy as any, 1.5);
	}

	function handleZoomOut() {
		if (!svg || !zoom) return;
		
		const currentK = zoomTransform?.k || 1;
		const newK = Math.max(0.5, currentK / 1.5);
		
		d3.select(svg)
			.transition()
			.duration(300)
			.call(zoom.scaleBy as any, 1/1.5);
	}

	function handleGoToToday() {
		const todayX = baseXScale(currentYear);
		const centerX = width / 2;
		const translateX = centerX - todayX;
		
		const newTransform = d3.zoomIdentity
			.translate(translateX, 0)
			.scale(zoomTransform?.k || 1);
		
		d3.select(svg)
			.transition()
			.duration(500)
			.call(zoom.transform as any, newTransform);
	}

	// Sync with URL hash
	function syncURL() {
		if (typeof window === 'undefined') return;
		
		const xScale = zoomTransform ? zoomTransform.rescaleX(baseXScale) : baseXScale;
		const centerYear = Math.round(xScale.invert(width / 2));
		const zoom = Math.round((zoomTransform?.k || 1) * 10) / 10;
		
		const hash = `#year=${centerYear}&zoom=${zoom}`;
		if (window.location.hash !== hash) {
			window.history.replaceState(null, '', hash);
		}
	}

	function loadFromURL() {
		if (typeof window === 'undefined') return;
		
		const hash = window.location.hash;
		if (!hash) return;
		
		const params = new URLSearchParams(hash.substring(1));
		const year = params.get('year');
		const zoom = params.get('zoom');
		
		if (year && zoom && isInitialized) {
			const targetYear = parseInt(year, 10);
			const targetZoom = parseFloat(zoom);
			const targetX = baseXScale(targetYear);
			const centerX = width / 2;
			const translateX = centerX - targetX * targetZoom;
			
			const newTransform = d3.zoomIdentity
				.translate(translateX, 0)
				.scale(targetZoom);
			
			d3.select(svg)
				.transition()
				.duration(0)
				.call(zoom.transform as any, newTransform);
		}
	}

	$: if (isInitialized && people.length > 0) {
		updateChart();
		syncURL();
	}

	// Keyboard shortcuts
	function handleKeyDown(event: KeyboardEvent) {
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement ||
			event.ctrlKey ||
			event.metaKey
		) {
			return;
		}

		const xScale = zoomTransform ? zoomTransform.rescaleX(baseXScale) : baseXScale;
		const centerYear = Math.round(xScale.invert(width / 2));

		// Arrow keys: navigate by decade
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			const newYear = Math.max(MIN_YEAR, centerYear - 10);
			const newX = baseXScale(newYear);
			const centerX = width / 2;
			const translateX = centerX - newX * (zoomTransform?.k || 1);
			const newTransform = d3.zoomIdentity
				.translate(translateX, 0)
				.scale(zoomTransform?.k || 1);
			d3.select(svg)
				.transition()
				.duration(200)
				.call(zoom.transform as any, newTransform);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			const newYear = Math.min(MAX_YEAR, centerYear + 10);
			const newX = baseXScale(newYear);
			const centerX = width / 2;
			const translateX = centerX - newX * (zoomTransform?.k || 1);
			const newTransform = d3.zoomIdentity
				.translate(translateX, 0)
				.scale(zoomTransform?.k || 1);
			d3.select(svg)
				.transition()
				.duration(200)
				.call(zoom.transform as any, newTransform);
		}

		// +/- for zoom
		if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			handleZoomIn();
		} else if (event.key === '-' || event.key === '_') {
			event.preventDefault();
			handleZoomOut();
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			setTimeout(loadFromURL, 100);
			window.addEventListener('keydown', handleKeyDown);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeyDown);
		}
	});
</script>

<div bind:this={container} class="w-full h-full relative bg-[#faf9f6]">
	<svg
		bind:this={svg}
		class="w-full timeline-svg"
		class:grabbing={isDragging}
		style="height: {height}px;"
	></svg>

	<!-- Controls -->
	<div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl border border-gray-200 shadow-lg">
		<button
			onclick={handleZoomOut}
			class="p-2 hover:bg-gray-100 rounded-lg transition-all"
			aria-label="Zoom out"
		>
			<svg class="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"></path>
			</svg>
		</button>
		<button
			onclick={handleZoomIn}
			class="p-2 hover:bg-gray-100 rounded-lg transition-all"
			aria-label="Zoom in"
		>
			<svg class="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"></path>
			</svg>
		</button>
		<div class="w-px h-6 bg-gray-300"></div>
		<button
			onclick={handleGoToToday}
			class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all font-medium text-sm"
		>
			I dag
		</button>
	</div>
</div>

<style>
	:global(.timeline-svg) {
		cursor: grab;
		user-select: none;
	}

	:global(.timeline-svg.grabbing) {
		cursor: grabbing;
	}

	:global(.x-axis text) {
		fill: #6b7280;
		font-size: 11px;
		font-weight: 500;
	}

	:global(.x-axis path),
	:global(.x-axis line) {
		stroke: #d1d5db;
		stroke-width: 1.5;
	}

	:global(.tooltip) {
		position: absolute;
		padding: 10px 14px;
		background: white;
		color: #111827;
		border-radius: 8px;
		pointer-events: none;
		font-size: 13px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		z-index: 1000;
		opacity: 0;
		transition: opacity 0.2s;
		min-width: 150px;
		border: 1px solid #e5e7eb;
	}
</style>
