<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as d3 from "d3";
    import type { Person } from "../types";

    export let people: Person[] = [];
    export let onPersonClick: (person: Person) => void = () => {};

    // Elements
    let viewport: HTMLDivElement;
    let mainSvg: SVGSVGElement;
    let mainGElement: SVGGElement;

    let axisContainer: HTMLDivElement;
    let axisSvg: SVGSVGElement;
    let axisGElement: SVGGElement;

    // Dimensions
    let width = 0;
    let height = 0; // Viewport height
    const AXIS_HEIGHT = 40;
    const currentYear = 2025;

    const MIN_YEAR = 700;
    const MAX_YEAR = 2026;
    const ROW_HEIGHT = 36; // Slightly taller for better readability
    const BAR_HEIGHT = 28;
    // Split margins
    const margin = { top: 20, right: 80, bottom: 20, left: 150 }; // For main content
    const axisMargin = { top: 0, right: 80, bottom: 0, left: 150 }; // For axis

    let baseXScale: d3.ScaleLinear<number, number>;
    let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;

    // Selections
    let mainG: d3.Selection<SVGGElement, unknown, null, undefined> | null =
        null;
    let axisG: d3.Selection<SVGGElement, unknown, null, undefined> | null =
        null;

    let zoomTransform: d3.ZoomTransform = d3.zoomIdentity;
    let hoveredPerson: Person | null = null;

    function getVisiblePeople(
        people: Person[],
        zoomTransform: d3.ZoomTransform,
        width: number,
        height: number,
    ): Person[] {
        if (people.length === 0 || !baseXScale || height === 0) return [];

        const currentXScale = zoomTransform.rescaleX(baseXScale);
        const [minYear, maxYear] = currentXScale.domain();

        // 1. Filter by Time Range (Visible Domain)
        // We add a buffer so bars don't pop in/out abruptly
        let candidates = people.filter((p) => {
            const birth = p.birthYear;
            const death = p.deathYear || currentYear;
            return death >= minYear - 20 && birth <= maxYear + 20;
        });

        // 2. Sort candidates by prominence descending
        // Important: We prioritize showcasing the most famous people in the current view
        candidates.sort((a, b) => b.prominenceScore - a.prominenceScore);

        // 3. Limit to what fits in the viewport
        const maxRows = Math.floor(
            (height - margin.top - margin.bottom) / ROW_HEIGHT,
        );
        // Ensure at least 5 rows if possible
        const limit = Math.max(5, maxRows);
        const visible = candidates.slice(0, limit);

        // 4. Sort by birth year for display
        return visible.sort((a, b) => a.birthYear - b.birthYear);
    }

    function updateDimensions() {
        if (!viewport || typeof window === "undefined") return;

        width = viewport.clientWidth;
        height = viewport.clientHeight;

        if (mainSvg && width > 0 && height > 0) {
            d3.select(mainSvg).attr("width", width).attr("height", height); // Fixed height to viewport

            if (baseXScale) {
                baseXScale.range([margin.left, width - margin.right]);
            }
        }

        if (axisSvg && width > 0) {
            d3.select(axisSvg).attr("width", width);
        }
    }

    function initializeZoom() {
        if (!mainSvg || width === 0) return;

        baseXScale = d3
            .scaleLinear()
            .domain([MIN_YEAR, MAX_YEAR])
            .range([margin.left, width - margin.right]);

        // Init Selections
        if (!mainG && mainGElement) mainG = d3.select(mainGElement);
        if (!axisG && axisGElement) axisG = d3.select(axisGElement);

        if (!mainG || !axisG) return;

        zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([1, 200]) // Allow deep zoom
            .translateExtent([
                [margin.left - 500, -Infinity],
                [width - margin.right + 500, Infinity],
            ])
            // No filter! Wheel = Zoom.
            .on("zoom", (event) => {
                zoomTransform = event.transform;
                render();
            });

        d3.select(mainSvg).call(zoom as any);
    }

    function render() {
        if (
            !mainG ||
            !axisG ||
            !baseXScale ||
            width === 0 ||
            people.length === 0
        )
            return;

        const xScale = zoomTransform.rescaleX(baseXScale);

        // ----- MAIN CONTENT RENDER -----

        const visiblePeople = getVisiblePeople(
            people,
            zoomTransform,
            width,
            height,
        );

        // Grid lines (in Main only)
        const gridData = d3.range(
            Math.ceil(MIN_YEAR / 100) * 100,
            MAX_YEAR + 1,
            100,
        );
        const gridLines = mainG
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
            .attr("y1", 0) // Full height
            .attr("y2", height)
            .attr("stroke", "#e5e7eb")
            .attr("stroke-width", 1)
            .attr("opacity", 0.5);

        // Rows
        const rows = mainG
            .selectAll(".person-row")
            .data(visiblePeople, (d) => d.id);

        rows.exit().remove();
        const rowsEnter = rows.enter().append("g").attr("class", "person-row");
        const rowsMerged = rowsEnter.merge(rows as any);

        rowsMerged.attr("transform", (d, i) => {
            const y = margin.top + i * ROW_HEIGHT;
            return `translate(0, ${y})`;
        });

        // Lifespan bars
        const bars = rowsMerged.selectAll(".lifespan-bar").data((d) => [d]);

        const barWidthFn = (d: Person) => {
            const endYear = d.deathYear || currentYear;
            return Math.max(0, xScale(endYear) - xScale(d.birthYear));
        };

        bars.enter()
            .append("rect")
            .attr("class", "lifespan-bar")
            .merge(bars as any)
            .attr("x", (d) => xScale(d.birthYear))
            .attr("y", 0)
            .attr("width", barWidthFn)
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

        // Clip Paths (strictly contain text)
        const clips = rowsMerged.selectAll(".bar-clip").data((d) => [d]);
        const clipsEnter = clips
            .enter()
            .append("defs")
            .append("clipPath")
            .attr("class", "bar-clip")
            .attr("id", (d) => `clip-${d.id}`);
        clipsEnter.append("rect");

        clips
            .merge(
                clipsEnter.select(function () {
                    return this.parentNode;
                }) as any,
            )
            .select("clipPath")
            .attr("id", (d) => `clip-${d.id}`)
            .select("rect")
            .attr("x", (d) => xScale(d.birthYear))
            .attr("y", 0)
            .attr("width", barWidthFn)
            .attr("height", BAR_HEIGHT);

        // Labels
        const labels = rowsMerged.selectAll(".bar-label").data((d) => [d]);

        labels
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .merge(labels as any)
            .attr("y", BAR_HEIGHT / 2 + 4)
            .attr("fill", "#000")
            .attr("font-size", "11px")
            .attr("font-weight", "500")
            .attr("font-family", "system-ui, sans-serif")
            .attr("pointer-events", "none")
            .attr("clip-path", (d) => `url(#clip-${d.id})`)
            .each(function (d) {
                // STICKY LABEL LOGIC
                const startX = xScale(d.birthYear);
                const endX = xScale(d.deathYear || currentYear);
                const barWidth = endX - startX;

                // Sticky X: clamp to 0 (left edge), but offset by 6px padding
                // AND ensure we don't push past the end of the bar
                const stickyX = Math.max(startX, 0) + 6;
                d3.select(this).attr("x", stickyX);

                // Calculate space available for text from sticky start to end of bar
                const available = endX - stickyX - 6;

                if (available < 20) {
                    d3.select(this).text("");
                    return;
                }

                let text = d.name;
                const charWidth = 7;
                const maxChars = Math.floor(available / charWidth);

                // Show dates if bar is wide enough relative to screen
                if (barWidth > 160 && available > 100) {
                    const longText = `${d.name} (${d.birthYear}–${d.deathYear || "present"})`;
                    if (longText.length * charWidth < available) {
                        text = longText;
                    }
                }

                if (text.length > maxChars) {
                    text = text.slice(0, Math.max(0, maxChars - 2)) + "...";
                }
                d3.select(this).text(text);
            });

        // ----- AXIS RENDER -----

        let xAxisG = axisG.select(".x-axis");
        if (xAxisG.empty()) {
            xAxisG = axisG.append("g").attr("class", "x-axis axis");
        }

        const xAxis = d3
            .axisBottom(xScale)
            .tickFormat(d3.format("d"))
            .ticks(Math.min(20, Math.floor(width / 80)));

        xAxisG
            .attr("transform", `translate(0, 10)`)
            .call(xAxis as any)
            .selectAll("text")
            .attr("fill", "#000")
            .attr("font-size", "11px")
            .attr("font-weight", "400");

        xAxisG.select(".domain").attr("stroke", "#000").attr("stroke-width", 1);
        xAxisG.selectAll(".tick line").attr("stroke", "#000");
    }

    function zoomIn() {
        if (!mainSvg) return;
        const newK = Math.min(200, zoomTransform.k * 1.5);
        d3.select(mainSvg)
            .transition()
            .duration(200)
            .call(zoom.scaleTo as any, newK);
    }

    function zoomOut() {
        if (!mainSvg) return;
        const newK = Math.max(1, zoomTransform.k / 1.5);
        d3.select(mainSvg)
            .transition()
            .duration(200)
            .call(zoom.scaleTo as any, newK);
    }

    function resetZoom() {
        if (!mainSvg) return;
        d3.select(mainSvg)
            .transition()
            .duration(500)
            .call(zoom.transform as any, d3.zoomIdentity);
    }

    onMount(() => {
        if (typeof window === "undefined") return;

        const resizeObserver = new ResizeObserver(() => {
            updateDimensions();
            if (mainG && baseXScale) {
                render();
            }
        });

        if (viewport) resizeObserver.observe(viewport);
        if (viewport?.parentElement)
            resizeObserver.observe(viewport.parentElement);

        if (mainGElement) mainG = d3.select(mainGElement);
        if (axisGElement) axisG = d3.select(axisGElement);

        requestAnimationFrame(() => {
            updateDimensions();
            initializeZoom();
            render();
            // Retry for layout stabilization
            setTimeout(() => {
                updateDimensions();
                render();
            }, 100);
        });

        return () => {
            resizeObserver.disconnect();
        };
    });

    $: if (people.length > 0 && mainG && baseXScale && width > 0) {
        render();
    }
</script>

<div class="timeline-app">
    <div class="main-viewport" bind:this={viewport}>
        <div class="help-text">
            <b>Scroll</b> to zoom in/out • <b>Drag</b> to pan
        </div>
        <svg bind:this={mainSvg}>
            <g bind:this={mainGElement}></g>
        </svg>
    </div>

    <!-- Fixed Axis at bottom -->
    <div class="axis-container" bind:this={axisContainer}>
        <svg bind:this={axisSvg} height={AXIS_HEIGHT}>
            <g bind:this={axisGElement}></g>
        </svg>
    </div>

    <!-- Zoom controls (Absolute to timeline-app) -->
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
                <line x1="11" x2="11" y1="8" y2="14"></line>
                <line x1="8" x2="14" y1="11" y2="11"></line>
            </svg>
        </button>
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
                <line x1="8" x2="14" y1="11" y2="11"></line>
            </svg>
        </button>
        <div class="divider"></div>
        <button class="zoom-btn" on:click={resetZoom} title="Reset View">
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
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                ></path>
                <path d="M3 3v5h5"></path>
            </svg>
        </button>
    </div>

    <!-- Info badge -->
    <div class="info-badge">
        <p class="info-text">
            {getVisiblePeople(people, zoomTransform, width, height).length} prominent
            people visible
        </p>
        <p class="info-text zoom-level">
            Zoom: {Math.round(zoomTransform.k * 10) / 10}x
        </p>
    </div>
</div>

<style>
    .timeline-app {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
        background: #faf9f6;
        overflow: hidden;
    }

    .main-viewport {
        flex: 1;
        overflow: hidden; /* No scrollbars! */
        position: relative;
        cursor: grab;
    }

    .main-viewport:active {
        cursor: grabbing;
    }

    .axis-container {
        flex-shrink: 0;
        height: 40px;
        background: #faf9f6;
        border-top: 1px solid #e5e7eb;
        z-index: 5;
    }

    .help-text {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.9);
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        color: #666;
        border: 1px solid #ddd;
        pointer-events: none;
        z-index: 20;
        width: fit-content;
        margin: 0 auto;
    }

    svg {
        display: block;
    }

    .zoom-controls {
        position: absolute;
        right: 16px;
        top: 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 30; /* Higher than axis */
    }

    .divider {
        height: 1px;
        background: #e5e7eb;
        margin: 2px 4px;
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
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .zoom-btn:hover {
        background: #f3f4f6;
        border-color: #d1d5db;
    }

    .info-badge {
        position: absolute;
        left: 16px;
        bottom: 56px; /* Above axis (40px) + padding */
        background: white;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid #e5e7eb;
        z-index: 30;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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
