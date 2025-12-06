<script lang="ts">
    import { onMount } from "svelte";
    import {
        scaleLinear,
        zoom as d3Zoom,
        zoomIdentity,
        range,
        axisBottom,
        format,
        select,
    } from "d3";
    import type { ZoomBehavior, ScaleLinear, ZoomTransform } from "d3";
    import type { Person } from "../types";
    import { palette } from "../theme/palette";

    const MIN_YEAR = 600;
    const MAX_YEAR = 2100;
    const TOTAL_YEARS = MAX_YEAR - MIN_YEAR;

    // Config
    const ROW_HEIGHT = 45;
    const BAR_HEIGHT = 30;
    const AXIS_HEIGHT = 40;
    const INITIAL_VISIBLE_LANES = 30;
    const LOAD_MORE_INCREMENT = 10;
    const currentYear = 2025;

    // Zoom Constraints (Years Visible)
    const MIN_VISIBLE_YEARS = 150; // Zoomed In
    const MAX_VISIBLE_YEARS = 600; // Zoomed Out

    const margin = { top: 20, right: 80, bottom: 20, left: 150 };

    export let people: Person[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    export let onPersonClick: (p: Person) => void = () => {};

    // Expose control functions
    export function resetView() {
        if (!mainSvg || !zoom || !baseXScale || width === 0) return;
        
        const initialVisibleYears = 400;
        const initialK = TOTAL_YEARS / initialVisibleYears;
        const centerYear = 1800;
        const centerX = baseXScale(centerYear);
        const centerView = width / 2;
        const tX = centerView - centerX * initialK;
        
        select(mainSvg).call(
            zoom.transform as any,
            zoomIdentity.translate(tX, 0).scale(initialK),
        );
    }

    export function scrollToLeft() {
        if (!mainSvg || !zoom || !baseXScale || width === 0) return;
        
        const k = zoomTransform.k;
        const minYearPixel = baseXScale(MIN_YEAR);
        const minTx = margin.left - minYearPixel * k;
        
        // Ensure we're at the leftmost valid position (year 600)
        select(mainSvg).call(
            zoom.transform as any,
            zoomIdentity.translate(minTx, zoomTransform.y).scale(k),
        );
    }

    export function scrollToRight() {
        if (!mainSvg || !zoom || !baseXScale || width === 0) return;
        
        const k = zoomTransform.k;
        const maxYearPixel = baseXScale(MAX_YEAR);
        const maxTx = width - margin.right - maxYearPixel * k;
        
        // Ensure we're at the rightmost valid position (year 2100)
        select(mainSvg).call(
            zoom.transform as any,
            zoomIdentity.translate(maxTx, zoomTransform.y).scale(k),
        );
    }

    export function zoomIn() {
        if (!mainSvg || !zoom || !baseXScale || width === 0 || !zoomTransform) return;
        
        const currentK = zoomTransform.k;
        const maxK = TOTAL_YEARS / MIN_VISIBLE_YEARS;
        
        // Check if we're already at max zoom
        if (currentK >= maxK) return;
        
        // Get the viewport center point
        const centerX = width / 2;
        const centerY = 0;
        const point = [centerX, centerY] as [number, number];
        
        // Use D3's scaleBy method which scales by a factor relative to current scale
        // This keeps the center point fixed, just like Ctrl+wheel zoom
        // Smaller increment for finer control
        select(mainSvg).call(
            zoom.scaleBy as any,
            1.1,
            point
        );
    }

    export function zoomOut() {
        if (!mainSvg || !zoom || !baseXScale || width === 0 || !zoomTransform) return;
        
        const currentK = zoomTransform.k;
        const minK = TOTAL_YEARS / MAX_VISIBLE_YEARS;
        
        // Check if we're already at min zoom
        if (currentK <= minK) return;
        
        // Get the viewport center point
        const centerX = width / 2;
        const centerY = 0;
        const point = [centerX, centerY] as [number, number];
        
        // Use D3's scaleBy method which scales by a factor relative to current scale
        // This keeps the center point fixed, just like Ctrl+wheel zoom
        // Smaller increment for finer control
        select(mainSvg).call(
            zoom.scaleBy as any,
            1 / 1.1,
            point
        );
    }

    export function getZoomLevel(): number {
        if (!zoom || !baseXScale) return 50;
        
        const minK = TOTAL_YEARS / MAX_VISIBLE_YEARS; // 2.5 (zoomed out)
        const maxK = TOTAL_YEARS / MIN_VISIBLE_YEARS; // 10 (zoomed in)
        const currentK = zoomTransform?.k || minK;
        
        // Convert k value to percentage (0-100)
        // 0% = minK (zoomed out), 100% = maxK (zoomed in)
        const percentage = ((currentK - minK) / (maxK - minK)) * 100;
        return Math.max(0, Math.min(100, percentage));
    }

    export function captureCenterYear() {
        // Capture the center year when drag starts - use this fixed value throughout the drag
        if (!baseXScale || !zoomTransform || width === 0) return;
        const centerX = width / 2;
        const currentScale = zoomTransform.rescaleX(baseXScale);
        fixedCenterYear = currentScale.invert(centerX);
    }

    export function clearCenterYear() {
        fixedCenterYear = null;
    }

    export function setZoomLevel(percentage: number) {
        if (!mainSvg || !zoom || !baseXScale || width === 0 || !zoomTransform) return;
        
        const minK = TOTAL_YEARS / MAX_VISIBLE_YEARS; // 2.5 (zoomed out)
        const maxK = TOTAL_YEARS / MIN_VISIBLE_YEARS; // 10 (zoomed in)
        
        // Clamp percentage to 0-100
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        
        // Convert percentage to k value
        const newK = minK + (clampedPercentage / 100) * (maxK - minK);
        
        // Get the viewport center point
        const centerX = width / 2;
        const centerY = 0;
        const point = [centerX, centerY] as [number, number];
        
        // Use D3's scaleTo method which zooms to a specific scale while keeping a point fixed
        // This is exactly how Ctrl+wheel zoom works - it zooms around the pointer/center point
        select(mainSvg).call(
            zoom.scaleTo as any,
            newK,
            point
        );
        
        // Update zoom level variable
        currentZoomLevel = clampedPercentage;
    }

    // Elements
    let mainSvg: SVGSVGElement;
    let axisSvg: SVGSVGElement;
    let axisGElement: SVGGElement;
    let viewport: HTMLDivElement;

    // Dimensions
    let width = 0;
    let height = 0;

    // D3 State
    let zoom: ZoomBehavior<SVGSVGElement, unknown>;
    let baseXScale: ScaleLinear<number, number>;
    let xScale: ScaleLinear<number, number> | null = null;
    let zoomTransform: ZoomTransform = zoomIdentity;
    let isInitialLoad = true;
    let currentZoomLevel = 50; // 0-100 percentage
    let fixedCenterYear: number | null = null; // Center year to preserve during zoom drag
    let isNearBottom = false; // Track if user is scrolled near bottom

    // Data State
    type VisiblePerson = Person & { laneIndex: number };

    // Stable "Layout" State: Calculated once per Zoom Level change
    let layoutPeople: VisiblePerson[] = [];

    // Render State: Filtered from layoutPeople for Viewport + Lane Limit
    let renderPeople: VisiblePerson[] = [];
    let visibleLaneCount = INITIAL_VISIBLE_LANES;
    let maxLaneIndex = 0;
    let hasMoreDataInViewport = false; // Track if there's more data in current viewport

    function getPersonColor(person: Person): string {
        // Use the person's color if available (based on occupation)
        if (person.color) {
            return person.color;
        }
        
        // Fallback to hash-based color if no color is set
        let hash = 0;
        for (let i = 0; i < person.id.length; i++) {
            hash = person.id.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 65%, 45%)`;
    }

    // Utils - Defined early to avoid issues
    function getEffectiveDeathYear(p: Person): number {
        if (p.deathYear) return p.deathYear;

        // If missing death year and would be older than 100, cap it
        if (currentYear - p.birthYear > 100) {
            return p.birthYear + 100;
        }
        return currentYear;
    }

    function getLabelStr(p: Person) {
        if (p.deathYear) {
            return `${p.name} (${p.birthYear}-${p.deathYear})`;
        }

        const age = currentYear - p.birthYear;
        if (age > 100) {
            return `${p.name} (${p.birthYear}-?)`;
        }

        return `${p.name} (${p.birthYear}-pres)`;
    }

    function renderAxis() {
        if (!axisGElement || !xScale) return;
        select(axisGElement).call(
            axisBottom(xScale)
                .tickFormat(format("d") as any)
                .ticks(width / 100) as any,
        );
        // Reset styles d3 overrides
        const g = select(axisGElement);
        g.selectAll("text").attr("fill", "#666");
        g.selectAll("path, line").attr("stroke", "#ddd");
    }

    onMount(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === viewport) {
                    width = entry.contentRect.width;
                    height = entry.contentRect.height;
                }
            }
            // Initialize zoom when viewport is sized and we have people data
            if (width > 0 && !zoom && people && people.length > 0) {
                initializeZoom();
            } else if (zoom) {
                // Update zoom extents if width changes
                updateZoomExtents();
                updateRenderState(); // Just re-render, don't re-layout unless zoom k changed
            }
        });

        // Track scroll position to show/hide load more button
        function handleScroll() {
            if (!viewport) return;
            const scrollTop = viewport.scrollTop;
            const scrollHeight = viewport.scrollHeight;
            const clientHeight = viewport.clientHeight;
            // Show button when within 200px of bottom
            isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
        }

        if (viewport) {
            resizeObserver.observe(viewport);
            viewport.addEventListener('scroll', handleScroll);
            // Check initial state
            handleScroll();
        }

        return () => {
            resizeObserver.disconnect();
            if (viewport) {
                viewport.removeEventListener('scroll', handleScroll);
            }
        };
    });

    function updateZoomExtents() {
        if (!zoom || width === 0 || !baseXScale) return;

        const minK = TOTAL_YEARS / MAX_VISIBLE_YEARS;
        const maxK = TOTAL_YEARS / MIN_VISIBLE_YEARS;

        zoom.scaleExtent([minK, maxK]);
        
        // Set the extent to the SVG bounds - this defines the pannable area
        const svgHeight = mainSvg ? mainSvg.getBoundingClientRect().height : height || 1000;
        zoom.extent([
            [0, 0],
            [width, svgHeight]
        ]);
        
        // Calculate translateExtent based on current zoom level
        // This constrains panning to keep MIN_YEAR and MAX_YEAR within view
        const currentK = zoomTransform?.k || minK;
        const minYearPixel = baseXScale(MIN_YEAR);
        const maxYearPixel = baseXScale(MAX_YEAR);
        
        // translateExtent constrains the translation in the coordinate space
        // We want: after transform, MIN_YEAR at left edge and MAX_YEAR at right edge
        const minTx = margin.left - minYearPixel * currentK;
        const maxTx = width - margin.right - maxYearPixel * currentK;
        
        // Ensure minTx <= maxTx (should always be true, but safety check)
        if (minTx <= maxTx) {
            zoom.translateExtent([
                [minTx, -Infinity],
                [maxTx, Infinity],
            ]);
        }
    }

    function initializeZoom() {
        if (!mainSvg || width === 0 || !people || people.length === 0) return;

        // Base scale spans the ENTIRE possible time range
        baseXScale = scaleLinear()
            .domain([MIN_YEAR, MAX_YEAR])
            .range([margin.left, width - margin.right]);

        xScale = baseXScale; // Initial

        zoom = d3Zoom<SVGSVGElement, unknown>()
            .filter((event) => {
                // Allow all mouse and touch events for dragging/panning
                if (event.type === "mousedown" || event.type === "touchstart" || 
                    event.type === "mousemove" || event.type === "touchmove" ||
                    event.type === "mouseup" || event.type === "touchend")
                    return true;
                // Only allow wheel zoom with modifier keys (Ctrl/Cmd + wheel)
                if (event.type === "wheel")
                    return event.ctrlKey || event.metaKey;
                return false;
            })
            .on("zoom", (event) => {
                const oldK = zoomTransform.k;
                zoomTransform = event.transform;

                // Update zoom level for slider
                const minK = TOTAL_YEARS / MAX_VISIBLE_YEARS;
                const maxK = TOTAL_YEARS / MIN_VISIBLE_YEARS;
                currentZoomLevel = ((zoomTransform.k - minK) / (maxK - minK)) * 100;
                currentZoomLevel = Math.max(0, Math.min(100, currentZoomLevel));

                // Only update translate extents when zoom level (scale) changes
                // Don't update during panning to avoid teleporting
                if (Math.abs(oldK - zoomTransform.k) > 0.001) {
                    updateZoomExtents();
                    recalculateLayout();
                } else {
                    // Just update render state during panning
                    updateRenderState();
                }
            });

        // Transform to initial state - show fewer years initially to get more people visible
        // Use 400 years instead of 600 to lower the prominence threshold and show more people
        const initialVisibleYears = 400;
        const initialK = TOTAL_YEARS / initialVisibleYears;

        // Set initial transform before calculating extents
        const centerYear = 1800;
        const centerX = baseXScale(centerYear);
        const centerView = width / 2;
        const tX = centerView - centerX * initialK;
        
        // Set initial transform state
        zoomTransform = zoomIdentity.translate(tX, 0).scale(initialK);
        
        // Update initial zoom level
        const minK = TOTAL_YEARS / MAX_VISIBLE_YEARS;
        const maxK = TOTAL_YEARS / MIN_VISIBLE_YEARS;
        currentZoomLevel = ((initialK - minK) / (maxK - minK)) * 100;
        currentZoomLevel = Math.max(0, Math.min(100, currentZoomLevel));
        
        // Now update extents with the correct initial transform
        updateZoomExtents();

        // Apply the zoom behavior and initial transform
        select(mainSvg)
            .call(zoom as any)
            .call(
                zoom.transform as any,
                zoomTransform,
            );

        // Calculate initial layout after setting up zoom
        recalculateLayout();
    }

    function getProminenceThreshold(zoomScale: number): number {
        // Map current visible years to threshold
        // visibleYears = TOTAL_YEARS / zoomScale
        const visibleYears = TOTAL_YEARS / zoomScale;

        // Linear interpolation or similar
        const ratio =
            (visibleYears - MIN_VISIBLE_YEARS) /
            (MAX_VISIBLE_YEARS - MIN_VISIBLE_YEARS);
        // Ratio 1.0 = Zoomed Out (600y) -> Score 90+
        // Ratio 0.0 = Zoomed In (150y) -> Score 40+

        const minScore = 40;
        const maxScore = 90;

        return Math.round(minScore + ratio * (maxScore - minScore));
    }

    // STABLE LAYOUT ALGORITHM
    function recalculateLayout() {
        if (!baseXScale || !zoomTransform || !people || people.length === 0) return;

        // 1. Identify all candidates for this Scale
        const currentScale = zoomTransform.rescaleX(baseXScale);
        let threshold = getProminenceThreshold(zoomTransform.k);

        // On initial load, ensure we show at least 30 people
        if (isInitialLoad) {
            // Try to get at least 30 people by lowering threshold if needed
            const initialCandidates = people.filter((p) => p.prominenceScore >= threshold);
            
            // If we have fewer than 30 candidates, lower the threshold
            if (initialCandidates.length < 30) {
                // Sort people by prominence score descending
                const sortedByProminence = [...people].sort(
                    (a, b) => b.prominenceScore - a.prominenceScore
                );
                // Get the 30th person's score (or last person if fewer than 30)
                const minPeopleToShow = Math.min(30, people.length);
                if (sortedByProminence.length >= minPeopleToShow) {
                    const targetPerson = sortedByProminence[minPeopleToShow - 1];
                    if (targetPerson) {
                        threshold = targetPerson.prominenceScore;
                    } else {
                        threshold = 0;
                    }
                } else {
                    threshold = 0; // Show all if we have fewer than 30 total
                }
            }
        }

        let candidates = people.filter((p) => p.prominenceScore >= threshold);

        // 2. Strict Text Fitting Check (Global)
        const CHAR_WIDTH_EST = 7;
        const PADDING = 12;

        candidates = candidates.filter((p) => {
            // width = (year2 - year1) * k * constant
            const width =
                (getEffectiveDeathYear(p) - p.birthYear) *
                (baseXScale(2) - baseXScale(1)) *
                zoomTransform.k;
            const textStr = getLabelStr(p);
            const reqComp = textStr.length * CHAR_WIDTH_EST + PADDING;

            return width >= reqComp;
        });

        // 3. Pack Lanes Globally
        layoutPeople = packLanes(candidates, currentScale);

        maxLaneIndex =
            layoutPeople.length > 0
                ? Math.max(...layoutPeople.map((p) => p.laneIndex))
                : 0;

        // Mark initial load as complete after first layout
        if (isInitialLoad) {
            isInitialLoad = false;
        }

        updateRenderState();
    }

    // Recalculate layout when people data changes (but only after zoom is initialized)
    let lastPeopleLength = 0;
    $: if (people && people.length !== lastPeopleLength && baseXScale && zoomTransform && zoom) {
        lastPeopleLength = people.length;
        // Only recalculate if zoom is already initialized and we have a valid state
        if (width > 0 && mainSvg) {
            recalculateLayout();
        }
    }

    function updateRenderState() {
        if (!xScale) return;

        xScale = zoomTransform.rescaleX(baseXScale);

        // 1. Filter by Viewport X (Horizontal Optimization)
        const [minYear, maxYear] = xScale.domain();
        const buffer = (maxYear - minYear) * 0.5; // Render bit outside

        const xFiltered = layoutPeople.filter((p) => {
            const death = getEffectiveDeathYear(p);
            return death >= minYear - buffer && p.birthYear <= maxYear + buffer;
        });

        // 2. Filter by Vertical Lane Limit (Lazy Loading)
        renderPeople = xFiltered.filter((p) => p.laneIndex < visibleLaneCount);

        // 3. Check if there's more data in the current viewport that hasn't been loaded
        hasMoreDataInViewport = xFiltered.some((p) => p.laneIndex >= visibleLaneCount);

        renderAxis();
    }

    // Lane Packing Helper
    function packLanes(
        candidates: Person[],
        scale: ScaleLinear<number, number>,
    ): VisiblePerson[] {
        const lanes: number[] = [];
        const packed: VisiblePerson[] = [];
        const minPixelGap = 10;

        // Sort by birth year
        const sorted = [...candidates].sort(
            (a, b) => a.birthYear - b.birthYear,
        );

        for (const p of sorted) {
            const startPos = scale(p.birthYear);
            const endPos = scale(getEffectiveDeathYear(p));
            const endX = endPos + minPixelGap;

            let placed = false;
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] <= startPos) {
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

    function loadMore() {
        // Use requestAnimationFrame to prevent lag
        requestAnimationFrame(() => {
            const previousScrollTop = viewport?.scrollTop || 0;
            visibleLaneCount += LOAD_MORE_INCREMENT;
            updateRenderState();
            
            // After rendering, scroll down to keep the button visible
            // Scroll by approximately the height of the newly loaded lanes
            if (viewport) {
                requestAnimationFrame(() => {
                    const scrollAmount = LOAD_MORE_INCREMENT * ROW_HEIGHT;
                    const newScrollTop = previousScrollTop + scrollAmount;
                    viewport.scrollTo({
                        top: newScrollTop,
                        behavior: 'smooth'
                    });
                });
            }
        });
    }

    // Track mouse down position to distinguish clicks from drags
    let mouseDownPos: { x: number; y: number } | null = null;
    const DRAG_THRESHOLD = 5; // pixels

    function handleMouseDown(e: MouseEvent) {
        mouseDownPos = { x: e.clientX, y: e.clientY };
    }

    function handleMouseUp(e: MouseEvent | { clientX: number; clientY: number }, person: Person) {
        if (!mouseDownPos) return;
        
        const dx = Math.abs(e.clientX - mouseDownPos.x);
        const dy = Math.abs(e.clientY - mouseDownPos.y);
        
        // Only trigger click if mouse didn't move much (it was a click, not a drag)
        if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
            onPersonClick(person);
        }
        
        mouseDownPos = null;
    }

    function handleMouseEnter(e: MouseEvent) {
        (e.currentTarget as SVGGElement)
            .querySelector("rect")
            ?.setAttribute("filter", "brightness(1.1)");
    }
    function handleMouseLeave(e: MouseEvent) {
        (e.currentTarget as SVGGElement)
            .querySelector("rect")
            ?.removeAttribute("filter");
    }

    // No wheel handler needed - let browser handle vertical scrolling natively
    // Horizontal panning is done via drag (grab and drag)
    // Zoom is handled by D3 with Ctrl/Cmd + wheel

    // Calculated Grid Lines
    $: gridLines = baseXScale
        ? range(Math.ceil(MIN_YEAR / 100) * 100, MAX_YEAR + 1, 100)
        : [];
</script>

<div class="timeline-app">
    <div class="main-viewport" bind:this={viewport}>
        <!-- SVG Height: Cap strictly at visible lanes -->
        <svg
            bind:this={mainSvg}
            {width}
            height={margin.top +
                Math.min(visibleLaneCount, maxLaneIndex + 1) * ROW_HEIGHT +
                60}
            class="zoomable-svg"
        >
            {#if xScale}
                {@const curX = xScale}
                <!-- Background rect for dragging - placed FIRST so it's behind everything -->
                <!-- This ensures empty areas are draggable while person blocks on top can still be clicked -->
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="transparent"
                    style="pointer-events: all;"
                />

                <!-- Grid -->
                {#each gridLines as year}
                    <line
                        x1={curX(year)}
                        x2={curX(year)}
                        y1="0"
                        y2="100%"
                        stroke="#e5e7eb"
                        stroke-width="1"
                        style="pointer-events: none;"
                    />
                {/each}

                <!-- Blocks -->
                {#each renderPeople as person (person.id)}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <g
                        class="person-block"
                        transform="translate(0, {margin.top +
                            person.laneIndex * ROW_HEIGHT})"
                        on:mousedown={(e) => {
                            e.stopPropagation();
                            handleMouseDown(e);
                        }}
                        on:mouseup={(e) => {
                            e.stopPropagation();
                            handleMouseUp(e, person);
                        }}
                        on:touchstart={(e) => {
                            e.stopPropagation();
                            handleMouseDown(e);
                        }}
                        on:touchend={(e) => {
                            e.stopPropagation();
                            if (e.changedTouches && e.changedTouches[0]) {
                                const touch = e.changedTouches[0];
                                handleMouseUp({
                                    clientX: touch.clientX,
                                    clientY: touch.clientY,
                                }, person);
                            }
                        }}
                        on:mouseenter={handleMouseEnter}
                        on:mouseleave={handleMouseLeave}
                        style="pointer-events: all;"
                    >
                        <rect
                            x={curX(person.birthYear)}
                            width={Math.max(
                                0,
                                curX(getEffectiveDeathYear(person)) -
                                    curX(person.birthYear),
                            )}
                            height={BAR_HEIGHT}
                            rx="4"
                            ry="4"
                            fill={getPersonColor(person)}
                        />
                        <text
                            x={curX(person.birthYear) +
                                (curX(getEffectiveDeathYear(person)) -
                                    curX(person.birthYear)) /
                                    2}
                            y={BAR_HEIGHT / 2 + 5}
                            text-anchor="middle"
                            fill="white"
                            font-size="11px"
                            font-weight="500"
                            pointer-events="none"
                        >
                            {getLabelStr(person)}
                        </text>
                    </g>
                {/each}
            {/if}
        </svg>

        <!-- Load More Overlay -->
        <!-- Only show if we have more data in current viewport AND user is scrolled near bottom -->
        {#if hasMoreDataInViewport && isNearBottom}
            <div class="load-more-container">
                <button class="load-more-btn" on:click={loadMore}>
                    Vis flere ({maxLaneIndex - visibleLaneCount + 1})
                </button>
            </div>
        {/if}
    </div>

    <!-- Axis -->
    <div class="axis-container">
        <svg bind:this={axisSvg} {width} height={AXIS_HEIGHT}>
            <g bind:this={axisGElement} transform="translate(0, 0)"></g>
        </svg>
    </div>
</div>

<style>
    .timeline-app {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
        background: #faf9f6;
        position: relative;
    }
    .main-viewport {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        position: relative;
        -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
    }

    @media (max-width: 768px) {
        .main-viewport {
            /* Better touch scrolling on mobile */
            overscroll-behavior: contain;
        }
    }
    .axis-container {
        height: 40px;
        border-top: 1px solid #ccc;
        background: #faf9f6;
        flex-shrink: 0;
    }

    /* Load More Button Floating at bottom of viewport */
    .load-more-container {
        position: sticky;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        pointer-events: none; /* Let clicks pass through empty space */
        z-index: 10;
        /* Blur background or gradient to make it readable over content */
        background: linear-gradient(
            to top,
            rgba(250, 249, 246, 0.95) 20%,
            transparent
        );
        padding-bottom: 20px;
        padding-top: 40px;
        min-height: 0;
    }

    @media (max-width: 768px) {
        .load-more-container {
            padding-bottom: 16px;
            padding-top: 32px;
        }
    }
    .load-more-btn {
        pointer-events: auto;
        background: white;
        border: 1px solid #e5e7eb;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        color: #1f2937;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        line-height: 1;
        display: flex;
        align-items: center;
        height: 48px;
    }
    .load-more-btn:hover {
        background: #f9fafb;
        border-color: #d1d5db;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
    }
    .load-more-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }
    .person-block {
        cursor: pointer;
    }

    .zoomable-svg {
        cursor: grab;
        user-select: none;
    }

    .zoomable-svg:active {
        cursor: grabbing;
    }

    .zoomable-svg .person-block {
        cursor: pointer;
    }
</style>
