<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as d3 from "d3";
    import type { Person } from "../types";
    import { palette } from "../theme/palette";

    const MIN_YEAR = 700;
    const MAX_YEAR = 2100;
    const ROW_HEIGHT = 90; // Fit approx 6 rows in 500-600px
    const BAR_HEIGHT = 50; // Taller bars
    const AXIS_HEIGHT = 40;
    const currentYear = 2025;

    // Split margins
    const margin = { top: 20, right: 80, bottom: 20, left: 150 }; // For main content
    const axisMargin = { top: 0, right: 80, bottom: 0, left: 150 }; // For axis

    export let people: Person[] = [];
    export let onPersonClick: (p: Person) => void = () => {};

    // Elements
    let mainSvg: SVGSVGElement;
    let mainGElement: SVGGElement;
    let axisSvg: SVGSVGElement;
    let axisGElement: SVGGElement;
    let axisContainer: HTMLDivElement;
    let viewport: HTMLDivElement;

    // Dimensions
    let width = 0;
    let height = 0; // Viewport height
    let scrollTop = 0; // Virtualization scroll position

    let zoom: any;
    let mainG: d3.Selection<SVGGElement, unknown, null, undefined>;
    let axisG: d3.Selection<SVGGElement, unknown, null, undefined>;
    let baseXScale: d3.ScaleLinear<number, number>;

    let zoomTransform: d3.ZoomTransform = d3.zoomIdentity;
    let hoveredPerson: Person | null = null;

    // Theme
    // Helper to get color based on ID hashing
    function getPersonColor(id: string): string {
        const colors = palette.light; // Always Light Mode
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 45%)`; // Slightly darker for lines
    }

    function handleScroll(e: Event) {
        const target = e.target as HTMLDivElement;
        scrollTop = target.scrollTop;
        requestAnimationFrame(() => render());
    }

    onMount(() => {
        if (!people || people.length === 0) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === viewport) {
                    width = entry.contentRect.width;
                    height = entry.contentRect.height;
                }
            }
            initializeZoom();
            render();
        });

        resizeObserver.observe(viewport);

        // Listen to scroll
        viewport.addEventListener("scroll", handleScroll);

        return () => {
            resizeObserver.disconnect();
            viewport?.removeEventListener("scroll", handleScroll);
        };
    });

    function getProminenceThreshold(zoomScale: number): number {
        const minK = 1;
        const maxK = 20;
        const clamped = Math.max(minK, Math.min(maxK, zoomScale));
        const ratio = (clamped - minK) / (maxK - minK);
        return Math.round(80 - ratio * 80);
    }

    function getEffectiveDeathYear(p: Person): number {
        if (p.deathYear) return p.deathYear;
        if (p.birthYear < 1915) {
            return p.birthYear + 80;
        }
        return currentYear;
    }

    function packLanes(
        people: Person[],
        xScale: d3.ScaleLinear<number, number>,
    ): (Person & { laneIndex: number })[] {
        const lanes: number[] = [];
        const packed: (Person & { laneIndex: number })[] = [];

        // Tighter packing: Gap equal to ~2 years or just 5px
        // Let's use 5px constant gap for density
        const minPixelGap = 5;

        const sorted = [...people].sort((a, b) => a.birthYear - b.birthYear);

        for (const p of sorted) {
            const birthX = xScale(p.birthYear);
            const deathX = xScale(getEffectiveDeathYear(p));
            // Add width of text? rough estimate
            // For now, strict bar width + gap
            const endX = deathX + minPixelGap;

            let placed = false;
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] <= birthX) {
                    lanes[i] = endX;
                    packed.push({ ...p, laneIndex: i });
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                lanes.push(endX);
                packed.push({ ...p, laneIndex: lanes.length - 1 });
            }
        }
        return packed;
    }

    function getVisiblePeople(
        people: Person[],
        zoomTransform: d3.ZoomTransform,
        width: number,
        height: number,
    ): (Person & { laneIndex: number })[] {
        if (people.length === 0 || !baseXScale || height === 0) return [];

        const currentXScale = zoomTransform.rescaleX(baseXScale);
        const [minYear, maxYear] = currentXScale.domain();

        const yearWidth = maxYear - minYear;
        const buffer = yearWidth * 1.5;

        let candidates = people.filter((p) => {
            const birth = p.birthYear;
            const death = getEffectiveDeathYear(p);
            return death >= minYear - buffer && birth <= maxYear + buffer;
        });

        const zoomScale = zoomTransform.k;
        const threshold = getProminenceThreshold(zoomScale) * 0.7;

        candidates = candidates.filter((p) => p.prominenceScore >= threshold);

        return packLanes(candidates, currentXScale);
    }

    function updateDimensions() {
        if (!viewport || typeof window === "undefined") return;

        width = viewport.clientWidth;
        height = viewport.clientHeight;

        if (mainSvg && width > 0 && height > 0) {
            d3.select(mainSvg).attr("width", width).attr("height", height);

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
            .filter((event) => {
                // Disable wheel to allow native scrolling
                return event.type !== "wheel";
            })
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

        const colors = palette.light; // Always Light Mode

        const xScale = zoomTransform.rescaleX(baseXScale);

        const visiblePeopleAll = getVisiblePeople(
            people,
            zoomTransform,
            width,
            height,
        );

        // Calculate Dynamic Height based on content
        const maxLane =
            visiblePeopleAll.length > 0
                ? Math.max(...visiblePeopleAll.map((p) => p.laneIndex))
                : 0;
        const totalContentHeight =
            (maxLane + 1) * ROW_HEIGHT + margin.top + margin.bottom;
        // Ensure at least viewport height
        const renderHeight = Math.max(height, totalContentHeight);

        d3.select(mainSvg).attr("height", renderHeight);

        // --- VIRTUALIZATION ---
        // Calc visible row range
        const buffer = 2; // Extra rows top/bottom
        const startRow = Math.max(
            0,
            Math.floor((scrollTop - margin.top) / ROW_HEIGHT) - buffer,
        );
        const endRow = Math.min(
            maxLane + 1,
            Math.ceil((scrollTop + height - margin.top) / ROW_HEIGHT) + buffer,
        );

        // Filter for virtualization AND min-width
        const MIN_SEGMENT_WIDTH = 5;

        const visiblePeople = visiblePeopleAll.filter((p) => {
            // Virtualization check
            if (p.laneIndex < startRow || p.laneIndex > endRow) return false;

            // Min Width Check
            const startX = xScale(p.birthYear);
            const endX = xScale(getEffectiveDeathYear(p));
            const w = endX - startX;

            return w >= MIN_SEGMENT_WIDTH;
        });

        // Grid lines
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
            .attr("x1", (d: any) => xScale(d))
            .attr("x2", (d: any) => xScale(d))
            .attr("y1", 0) // Full height
            .attr("y2", renderHeight)
            .attr("stroke", colors.border)
            .attr("stroke-width", 1)
            .attr("opacity", 0.5);

        // Rows
        const rows = mainG
            .selectAll(".person-row")
            .data(visiblePeople, (d) => d.id);

        rows.exit().remove();
        const rowsEnter = rows.enter().append("g").attr("class", "person-row");
        const rowsMerged = rowsEnter.merge(rows as any);

        rowsMerged.attr("transform", (d: any) => {
            const y = margin.top + d.laneIndex * ROW_HEIGHT;
            return `translate(0, ${y})`;
        });

        // Lifespan Lines (The "Line" aesthetic)
        const groups = rowsMerged.selectAll(".person-group").data((d) => [d]);
        groups.exit().remove();

        const groupsEnter = groups
            .enter()
            .append("g")
            .attr("class", "person-group");
        const groupsMerged = groupsEnter.merge(groups as any);

        groupsMerged
            .attr("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                onPersonClick(d as Person);
            })
            .on("mouseenter", (event, d) => {
                hoveredPerson = d as Person;
                d3.select(event.currentTarget)
                    .select("line")
                    .attr("stroke-width", 6);
            })
            .on("mouseleave", (event) => {
                hoveredPerson = null;
                d3.select(event.currentTarget)
                    .select("line")
                    .attr("stroke-width", 4);
            });

        // 1. The Line
        const lines = groupsMerged.selectAll("line").data((d) => [d]);
        lines
            .enter()
            .append("line")
            .merge(lines as any)
            .attr("x1", (d: any) => xScale(d.birthYear))
            .attr("x2", (d: any) => xScale(getEffectiveDeathYear(d)))
            .attr("y1", BAR_HEIGHT / 2)
            .attr("y2", BAR_HEIGHT / 2)
            .attr("stroke", (d: any) => getPersonColor(d.id))
            .attr("stroke-width", 4)
            .attr("stroke-linecap", "square");

        // 2. The Text (Centered)
        const labels = groupsMerged.selectAll("text").data((d) => [d]);
        labels
            .enter()
            .append("text")
            .merge(labels as any)
            .attr("x", (d: any) => {
                const start = xScale(d.birthYear);
                const end = xScale(getEffectiveDeathYear(d));
                return start + (end - start) / 2; // Center
            })
            .attr("y", BAR_HEIGHT / 2 + 5) // Vertically centered
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("font-family", "system-ui, sans-serif")
            .attr("paint-order", "stroke")
            .attr("stroke", "white") // Halo
            .attr("stroke-width", 3)
            .attr("stroke-linejoin", "round")
            .text((d: any) => {
                const death =
                    d.deathYear || (d.birthYear < 1920 ? "?" : "pres");
                return `${d.name.toUpperCase()} (${d.birthYear}-${death})`;
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
            .attr("fill", colors.text)
            .attr("font-size", "11px")
            .attr("font-weight", "400");

        xAxisG
            .select(".domain")
            .attr("stroke", colors.text)
            .attr("stroke-width", 1);
        xAxisG
            .selectAll(".tick line")
            .attr("stroke", colors.text)
            .attr("opacity", 0.3);
    }

    function handleZoomIn() {
        if (!mainSvg || !zoom) return;
        d3.select(mainSvg).transition().duration(500).call(zoom.scaleBy, 1.5);
    }

    function handleZoomOut() {
        if (!mainSvg || !zoom) return;
        d3.select(mainSvg).transition().duration(500).call(zoom.scaleBy, 0.66);
    }

    function scrollLeft() {
        if (!mainSvg || !zoom) return;
        d3.select(mainSvg)
            .transition()
            .duration(500)
            .call(zoom.translateBy, 300, 0);
    }

    function scrollRight() {
        if (!mainSvg || !zoom) return;
        d3.select(mainSvg)
            .transition()
            .duration(500)
            .call(zoom.translateBy, -300, 0);
    }

    function resetZoom() {
        if (!mainSvg || !zoom || !baseXScale) return;
        d3.select(mainSvg)
            .transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity);
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
        <!-- Controls -->
        <div class="controls">
            <!-- Reverted to simple +/- buttons -->
            <div class="btn-group">
                <button on:click={handleZoomIn} aria-label="Zoom In">+</button>
                <button on:click={handleZoomOut} aria-label="Zoom Out">-</button
                >
            </div>
            <button class="reset-btn" on:click={resetZoom} title="Reset Zoom"
                >⟲</button
            >
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
        transition: background-color 0.3s ease;
    }

    .main-viewport {
        flex: 1;
        overflow-y: auto; /* Enable Vertical Scroll */
        overflow-x: hidden;
        position: relative;
    }

    /* Modern Scrollbar */
    .main-viewport::-webkit-scrollbar {
        width: 10px;
        height: 10px;
    }
    .main-viewport::-webkit-scrollbar-track {
        background: transparent;
    }
    .main-viewport::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 5px;
        border: 2px solid transparent;
        background-clip: content-box;
    }
    .main-viewport::-webkit-scrollbar-thumb:hover {
        background-color: rgba(0, 0, 0, 0.3);
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
        transition:
            background-color 0.3s ease,
            border-color 0.3s ease;
    }

    svg {
        display: block;
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
    .controls {
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 100;
        filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
    }

    .btn-group {
        display: flex;
        flex-direction: column; /* Stack vertically like Maps */
        gap: 0;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        overflow: hidden;
    }

    button {
        width: 36px;
        height: 36px;
        border: none;
        background: white;
        font-size: 18px;
        cursor: pointer;
        color: #555;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border-bottom: 1px solid #eee;
    }

    button:last-child {
        border-bottom: none;
    }

    button:hover {
        background: #f9f9f9;
        color: #000;
    }

    .reset-btn {
        width: 36px;
        height: 36px;
        padding: 0;
        font-size: 16px;
        font-weight: bold;
        border-radius: 4px; /* Separate square */
        background: white;
        border: 1px solid #ccc;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #555;
    }

    .reset-btn:hover {
        background: #f9f9f9;
        color: #000;
    }
</style>
