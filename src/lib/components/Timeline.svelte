<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as d3 from "d3";
    import type { Person } from "../types";

    export let people: Person[] = [];
    export let onPersonClick: (person: Person) => void = () => {};

    let svg: SVGSVGElement;
    let container: HTMLDivElement;
    let gElement: SVGGElement;
    let width = 0;
    let height = 0;
    const currentYear = 2025;

    const MIN_YEAR = 800;
    const MAX_YEAR = 2025;
    const ROW_HEIGHT = 40;
    const BAR_HEIGHT = 24;
    const margin = { top: 60, right: 100, bottom: 80, left: 180 };

    let baseXScale: d3.ScaleLinear<number, number>;
    let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
    let zoomTransform: d3.ZoomTransform = d3.zoomIdentity;
    let hoveredPerson: Person | null = null;

    // Smart filtering based on zoom level
    function getProminenceThreshold(zoomScale: number): number {
        // At zoom 1x, show only prominence >= 70 (most famous)
        // At zoom 10x, show prominence >= 20 (more people)
        // At zoom 20x, show all (prominence >= 1)
        const minK = 1;
        const maxK = 20;
        const clamped = Math.max(minK, Math.min(maxK, zoomScale));
        const ratio = (clamped - minK) / (maxK - minK);
        return Math.round(70 - ratio * 69); // 70 down to 1
    }

    function getVisiblePeople(people: Person[], zoomScale: number): Person[] {
        if (people.length === 0) return [];

        const threshold = getProminenceThreshold(zoomScale);
        const filtered = people.filter((p) => p.prominenceScore >= threshold);

        // Sort by prominence first, then birth year
        const sorted = [...filtered].sort((a, b) => {
            if (b.prominenceScore !== a.prominenceScore) {
                return b.prominenceScore - a.prominenceScore;
            }
            return a.birthYear - b.birthYear;
        });

        // Limit number of rows based on available height
        const maxRows = Math.floor(
            (height - margin.top - margin.bottom) / ROW_HEIGHT,
        );
        return sorted.slice(0, Math.max(10, maxRows));
    }

    function updateDimensions() {
        if (!container || typeof window === "undefined") return;
        width = container.clientWidth;
        height = container.clientHeight || window.innerHeight - 200;

        if (svg && width > 0 && height > 0) {
            d3.select(svg).attr("width", width).attr("height", height);

            if (baseXScale) {
                baseXScale.range([margin.left, width - margin.right]);
            }
        }
    }

    function initializeZoom() {
        if (!svg || width === 0) return;

        baseXScale = d3
            .scaleLinear()
            .domain([MIN_YEAR, MAX_YEAR])
            .range([margin.left, width - margin.right]);

        if (!g && gElement) {
            g = d3.select(gElement);
        }

        if (!g) return;

        zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([1, 20])
            .translateExtent([
                [margin.left - 200, -Infinity],
                [width - margin.right + 200, Infinity],
            ])
            .on("zoom", (event) => {
                zoomTransform = event.transform;
                render();
                updateZoomSlider();
            });

        d3.select(svg).call(zoom as any);
    }

    function render() {
        if (
            !g ||
            !gElement ||
            !baseXScale ||
            width === 0 ||
            height === 0 ||
            people.length === 0
        )
            return;

        const xScale = zoomTransform.rescaleX(baseXScale);
        const zoomScale = zoomTransform.k;
        const visiblePeople = getVisiblePeople(people, zoomScale);

        // Grid lines (century markers)
        const gridData = d3.range(
            Math.ceil(MIN_YEAR / 100) * 100,
            MAX_YEAR + 1,
            100,
        );
        const gridLines = g
            .selectAll(".grid-line")
            .data(gridData, (d) => d.toString());

        gridLines.exit().remove();

        const gridEnter = gridLines
            .enter()
            .append("line")
            .attr("class", "grid-line");

        gridEnter
            .merge(gridLines as any)
            .attr("x1", (d) => xScale(d))
            .attr("x2", (d) => xScale(d))
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom)
            .attr("stroke", "#e5e7eb")
            .attr("stroke-width", 1)
            .attr("opacity", 0.3);

        // Person rows
        const rows = g
            .selectAll(".person-row")
            .data(visiblePeople, (d) => d.id);

        rows.exit().transition().duration(300).style("opacity", 0).remove();

        const rowsEnter = rows
            .enter()
            .append("g")
            .attr("class", "person-row")
            .style("opacity", 0);

        rowsEnter.transition().duration(400).style("opacity", 1);

        const rowsMerged = rowsEnter.merge(rows as any);

        // Position rows
        rowsMerged
            .attr("transform", (d, i) => {
                const y = margin.top + i * ROW_HEIGHT;
                return `translate(0, ${y})`;
            })
            .style("opacity", 1);

        // Lifespan bars
        const bars = rowsMerged.selectAll(".lifespan-bar").data((d) => [d]);

        bars.enter()
            .append("rect")
            .attr("class", "lifespan-bar")
            .merge(bars as any)
            .attr("x", (d) => xScale(d.birthYear))
            .attr("y", 0)
            .attr("width", (d) => {
                const endYear = d.deathYear || currentYear;
                return Math.max(5, xScale(endYear) - xScale(d.birthYear));
            })
            .attr("height", BAR_HEIGHT)
            .attr("fill", (d) => d.color)
            .attr("opacity", (d) => (hoveredPerson?.id === d.id ? 1 : 0.85))
            .attr("stroke", (d) =>
                hoveredPerson?.id === d.id ? "#111827" : "rgba(17,24,39,0.3)",
            )
            .attr("stroke-width", (d) => (hoveredPerson?.id === d.id ? 2 : 1))
            .attr("rx", 4)
            .attr("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                onPersonClick(d);
            })
            .on("mouseenter", (event, d) => {
                hoveredPerson = d;
                render();
            })
            .on("mouseleave", () => {
                hoveredPerson = null;
                render();
            });

        // Name labels on bars
        const nameLabels = rowsMerged.selectAll(".name-label").data((d) => [d]);

        nameLabels
            .enter()
            .append("text")
            .attr("class", "name-label")
            .merge(nameLabels as any)
            .attr("x", (d) => xScale(d.birthYear) + 8)
            .attr("y", BAR_HEIGHT / 2 + 5)
            .attr("fill", "#ffffff")
            .attr("font-size", "13px")
            .attr("font-weight", "600")
            .attr("font-family", "Inter, system-ui, sans-serif")
            .attr("pointer-events", "none")
            .text((d) => d.name);

        // Year labels
        const yearLabels = rowsMerged.selectAll(".year-label").data((d) => [d]);

        yearLabels
            .enter()
            .append("text")
            .attr("class", "year-label")
            .merge(yearLabels as any)
            .attr("x", (d) => {
                const endYear = d.deathYear || currentYear;
                return xScale(endYear) + 8;
            })
            .attr("y", BAR_HEIGHT / 2 + 5)
            .attr("fill", "#6b7280")
            .attr("font-size", "11px")
            .attr("font-weight", "500")
            .attr("font-family", "ui-monospace, monospace")
            .text((d) => {
                const endYear = d.deathYear || "present";
                return `${d.birthYear}–${endYear}`;
            });

        // X-axis
        let xAxisG = g.select(".x-axis");
        if (xAxisG.empty()) {
            xAxisG = g.append("g").attr("class", "x-axis axis");
        }

        const xAxis = d3
            .axisBottom(xScale)
            .tickFormat(d3.format("d"))
            .ticks(Math.min(20, Math.floor(width / 80)));

        xAxisG
            .attr("transform", `translate(0, ${height - margin.bottom})`)
            .call(xAxis as any)
            .selectAll("text")
            .attr("fill", "#374151")
            .attr("font-size", "12px")
            .attr("font-weight", "500");

        // Axis line
        xAxisG
            .select(".domain")
            .attr("stroke", "#9ca3af")
            .attr("stroke-width", 2);

        // Tick lines
        xAxisG.selectAll(".tick line").attr("stroke", "#9ca3af");
    }

    function zoomIn() {
        if (!svg) return;
        const newK = Math.min(20, zoomTransform.k * 1.5);
        d3.select(svg)
            .transition()
            .duration(300)
            .call(zoom.scaleTo as any, newK);
    }

    function zoomOut() {
        if (!svg) return;
        const newK = Math.max(1, zoomTransform.k / 1.5);
        d3.select(svg)
            .transition()
            .duration(300)
            .call(zoom.scaleTo as any, newK);
    }

    function handleZoomSliderChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = parseFloat(target.value);
        const minK = 1;
        const maxK = 20;
        const newK = minK + (value / 100) * (maxK - minK);
        d3.select(svg).call(zoom.scaleTo as any, newK);
    }

    function updateZoomSlider() {
        if (typeof window === "undefined") return;
        const slider = document.getElementById(
            "zoom-slider",
        ) as HTMLInputElement;
        if (!slider) return;
        const minK = 1;
        const maxK = 20;
        const value = ((zoomTransform.k - minK) / (maxK - minK)) * 100;
        slider.value = value.toString();
    }

    onMount(() => {
        if (typeof window === "undefined") return;

        const resizeObserver = new ResizeObserver(() => {
            updateDimensions();
            if (g && baseXScale) {
                render();
            }
        });

        if (container) {
            resizeObserver.observe(container);
        }

        if (container?.parentElement) {
            resizeObserver.observe(container.parentElement);
        }

        if (gElement) {
            g = d3.select(gElement);
        }

        requestAnimationFrame(() => {
            updateDimensions();
            initializeZoom();
            if (g) {
                render();
                updateZoomSlider();
            }

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

<div class="timeline-wrapper" bind:this={container}>
    <svg bind:this={svg}>
        <g bind:this={gElement}></g>
    </svg>

    <!-- Zoom controls -->
    <div class="zoom-controls">
        <button class="zoom-btn" on:click={zoomIn} title="Zoom in">
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
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
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
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
                <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
        </button>
    </div>

    <!-- Info badge -->
    <div class="info-badge">
        <p class="text-xs text-gray-600">
            Showing {getVisiblePeople(people, zoomTransform.k).length} of {people.length}
            explorers
        </p>
        <p class="text-xs text-gray-500">
            Zoom: {Math.round(zoomTransform.k * 10) / 10}x
        </p>
    </div>
</div>

<style>
    .timeline-wrapper {
        width: 100%;
        height: 100%;
        position: relative;
        background: linear-gradient(to bottom, #faf9f6 0%, #f5f3ef 100%);
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
        right: 20px;
        top: 20px;
        display: flex;
        flex-direction: column;
        gap: 0;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        z-index: 10;
        border: 1px solid #e5e7eb;
    }

    .zoom-slider-container {
        padding: 8px 12px;
        background: white;
        border-top: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
    }

    .zoom-slider {
        width: 24px;
        height: 140px;
        writing-mode: vertical-lr;
        direction: rtl;
        cursor: pointer;
        accent-color: #2563eb;
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
    }

    .zoom-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        background: #2563eb;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.15s;
    }

    .zoom-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
    }

    .zoom-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: #2563eb;
        border-radius: 50%;
        cursor: pointer;
        border: none;
        transition: transform 0.15s;
    }

    .zoom-slider::-moz-range-thumb:hover {
        transform: scale(1.1);
    }

    .zoom-btn {
        width: 48px;
        height: 48px;
        background: white;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #2563eb;
        transition: all 0.2s;
        padding: 0;
    }

    .zoom-btn:hover {
        background: #eff6ff;
        color: #1d4ed8;
    }

    .zoom-btn:active {
        background: #dbeafe;
        transform: scale(0.95);
    }

    .info-badge {
        position: absolute;
        left: 20px;
        top: 20px;
        background: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border: 1px solid #e5e7eb;
        z-index: 10;
    }

    .text-xs {
        font-size: 12px;
    }

    .text-gray-600 {
        color: #4b5563;
    }

    .text-gray-500 {
        color: #6b7280;
    }

    :global(.person-row) {
        pointer-events: none;
    }

    :global(.lifespan-bar) {
        pointer-events: all;
        transition: all 0.2s ease;
    }

    :global(.lifespan-bar:hover) {
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
        transform: translateY(-1px);
    }

    :global(.name-label) {
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
</style>
