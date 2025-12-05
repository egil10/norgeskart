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
    const ROW_HEIGHT = 32;
    const BAR_HEIGHT = 28;
    const margin = { top: 50, right: 80, bottom: 60, left: 150 };

    let baseXScale: d3.ScaleLinear<number, number>;
    let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
    let zoomTransform: d3.ZoomTransform = d3.zoomIdentity;
    let hoveredPerson: Person | null = null;

    // Smart filtering based on zoom level
    function getProminenceThreshold(zoomScale: number): number {
        const minK = 1;
        const maxK = 20;
        const clamped = Math.max(minK, Math.min(maxK, zoomScale));
        const ratio = (clamped - minK) / (maxK - minK);
        return Math.round(70 - ratio * 69);
    }

    function getVisiblePeople(people: Person[], zoomScale: number): Person[] {
        if (people.length === 0) return [];

        const threshold = getProminenceThreshold(zoomScale);
        const filtered = people.filter((p) => p.prominenceScore >= threshold);

        const sorted = [...filtered].sort((a, b) => {
            if (b.prominenceScore !== a.prominenceScore) {
                return b.prominenceScore - a.prominenceScore;
            }
            return a.birthYear - b.birthYear;
        });

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

        // Grid lines
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
            .attr("opacity", 0.5);

        // Person rows - use key function for better performance
        const rows = g
            .selectAll(".person-row")
            .data(visiblePeople, (d) => d.id);

        rows.exit().remove(); // Remove without transition for better performance

        const rowsEnter = rows.enter().append("g").attr("class", "person-row");

        const rowsMerged = rowsEnter.merge(rows as any);

        // Position rows
        rowsMerged.attr("transform", (d, i) => {
            const y = margin.top + i * ROW_HEIGHT;
            return `translate(0, ${y})`;
        });

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
            .attr("stroke", "#000")
            .attr("stroke-width", 1)
            .attr("rx", 2)
            .attr("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                onPersonClick(d);
            })
            .on("mouseenter", (event, d) => {
                hoveredPerson = d;
                d3.select(event.currentTarget).attr("stroke-width", 2);
            })
            .on("mouseleave", (event) => {
                hoveredPerson = null;
                d3.select(event.currentTarget).attr("stroke-width", 1);
            });

        // Name and year labels inside bars
        const labels = rowsMerged.selectAll(".bar-label").data((d) => [d]);

        labels
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .merge(labels as any)
            .attr("x", (d) => xScale(d.birthYear) + 6)
            .attr("y", BAR_HEIGHT / 2 + 4)
            .attr("fill", "#000")
            .attr("font-size", "11px")
            .attr("font-weight", "500")
            .attr("font-family", "system-ui, sans-serif")
            .attr("pointer-events", "none")
            .text((d) => {
                const endYear = d.deathYear || currentYear;
                const barWidth = xScale(endYear) - xScale(d.birthYear);
                // Only show text if bar is wide enough
                if (barWidth > 80) {
                    return `${d.name} (${d.birthYear}–${d.deathYear || "present"})`;
                } else if (barWidth > 40) {
                    return d.name;
                }
                return "";
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
            .attr("fill", "#000")
            .attr("font-size", "11px")
            .attr("font-weight", "400");

        xAxisG.select(".domain").attr("stroke", "#000").attr("stroke-width", 1);
        xAxisG.selectAll(".tick line").attr("stroke", "#000");
    }

    function zoomIn() {
        if (!svg) return;
        const newK = Math.min(20, zoomTransform.k * 1.5);
        d3.select(svg)
            .transition()
            .duration(200)
            .call(zoom.scaleTo as any, newK);
    }

    function zoomOut() {
        if (!svg) return;
        const newK = Math.max(1, zoomTransform.k / 1.5);
        d3.select(svg)
            .transition()
            .duration(200)
            .call(zoom.scaleTo as any, newK);
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
            }

            setTimeout(() => {
                updateDimensions();
                if (g && baseXScale && width > 0 && height > 0) {
                    render();
                }
            }, 100);
        });

        return () => {
            resizeObserver.disconnect();
        };
    });

    $: if (people.length > 0 && g && baseXScale && width > 0) {
        render();
    }
</script>

<div class="timeline-wrapper" bind:this={container}>
    <svg bind:this={svg}>
        <g bind:this={gElement}></g>
    </svg>

    <!-- Zoom controls -->
    <div class="zoom-controls">
        <button
            class="zoom-btn"
            on:click={zoomIn}
            title="Zoom in"
            aria-label="Zoom in"
        >
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
                <line x1="11" x2="11" y1="8" y2="14"></line>
                <line x1="8" x2="14" y1="11" y2="11"></line>
            </svg>
        </button>
        <button
            class="zoom-btn"
            on:click={zoomOut}
            title="Zoom out"
            aria-label="Zoom out"
        >
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
                <line x1="8" x2="14" y1="11" y2="11"></line>
            </svg>
        </button>
    </div>

    <!-- Info badge -->
    <div class="info-badge">
        <p class="info-text">
            {getVisiblePeople(people, zoomTransform.k).length} of {people.length}
            people
        </p>
        <p class="info-text zoom-level">
            Zoom: {Math.round(zoomTransform.k * 10) / 10}x
        </p>
    </div>
</div>

<style>
    .timeline-wrapper {
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
        top: 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 10;
    }

    .zoom-btn {
        width: 36px;
        height: 36px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #000;
        transition: all 0.15s;
        padding: 0;
    }

    .zoom-btn:hover {
        background: #f3f4f6;
        border-color: #d1d5db;
    }

    .zoom-btn:active {
        background: #e5e7eb;
    }

    .info-badge {
        position: absolute;
        left: 16px;
        top: 16px;
        background: white;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid #e5e7eb;
        z-index: 10;
    }

    .info-text {
        font-size: 11px;
        color: #000;
        margin: 0;
        font-weight: 400;
    }

    .zoom-level {
        color: #6b7280;
        margin-top: 2px;
    }

    :global(.person-row) {
        pointer-events: none;
    }

    :global(.lifespan-bar) {
        pointer-events: all;
    }

    :global(.lifespan-bar:hover) {
        filter: brightness(0.95);
    }
</style>
