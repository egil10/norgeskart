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

    const MIN_YEAR = 700;
    const MAX_YEAR = 2100;
    const TOTAL_YEARS = MAX_YEAR - MIN_YEAR;

    // Config
    const ROW_HEIGHT = 45;
    const BAR_HEIGHT = 30;
    const AXIS_HEIGHT = 40;
    const INITIAL_VISIBLE_LANES = 15;
    const LOAD_MORE_INCREMENT = 10;
    const currentYear = 2025;

    // Zoom Constraints (Years Visible)
    const MIN_VISIBLE_YEARS = 150; // Zoomed In
    const MAX_VISIBLE_YEARS = 600; // Zoomed Out

    const margin = { top: 20, right: 80, bottom: 20, left: 150 };

    export let people: Person[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    export let onPersonClick: (p: Person) => void = () => {};

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

    // Data State
    type VisiblePerson = Person & { laneIndex: number };

    // Stable "Layout" State: Calculated once per Zoom Level change
    let layoutPeople: VisiblePerson[] = [];

    // Render State: Filtered from layoutPeople for Viewport + Lane Limit
    let renderPeople: VisiblePerson[] = [];
    let visibleLaneCount = INITIAL_VISIBLE_LANES;
    let maxLaneIndex = 0;

    function getPersonColor(id: string): string {
        const colors = palette.light;
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
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
        if (!people || people.length === 0) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === viewport) {
                    width = entry.contentRect.width;
                    height = entry.contentRect.height;
                }
            }
            // Debounce slightly or just run
            if (width > 0 && !zoom) {
                initializeZoom();
            } else if (zoom) {
                // Update zoom extents if width changes
                updateZoomExtents();
                updateRenderState(); // Just re-render, don't re-layout unless zoom k changed
            }
        });

        if (viewport) {
            resizeObserver.observe(viewport);
        }

        return () => resizeObserver.disconnect();
    });

    function updateZoomExtents() {
        if (!zoom || width === 0) return;

        const minK = TOTAL_YEARS / MAX_VISIBLE_YEARS;
        const maxK = TOTAL_YEARS / MIN_VISIBLE_YEARS;

        zoom.scaleExtent([minK, maxK]);
        zoom.translateExtent([
            [margin.left - 1000, -Infinity],
            [width - margin.right + 1000, Infinity],
        ]);
    }

    function initializeZoom() {
        if (!mainSvg || width === 0) return;

        // Base scale spans the ENTIRE possible time range
        baseXScale = scaleLinear()
            .domain([MIN_YEAR, MAX_YEAR])
            .range([margin.left, width - margin.right]);

        xScale = baseXScale; // Initial

        zoom = d3Zoom<SVGSVGElement, unknown>()
            .filter((event) => {
                if (event.type === "mousedown" || event.type === "touchstart")
                    return true;
                if (event.type === "wheel")
                    return event.ctrlKey || event.metaKey;
                return false;
            })
            .on("zoom", (event) => {
                const oldK = zoomTransform.k;
                zoomTransform = event.transform;

                // If Zoom Level (k) changed significantly, RE-LAYOUT lanes.
                // If only Translation (x, y) changed, just Pan (re-render).
                if (Math.abs(oldK - zoomTransform.k) > 0.001) {
                    recalculateLayout();
                } else {
                    updateRenderState();
                }
            });

        updateZoomExtents();

        // Transform to initial "Zoomed Out" state (show 600 years) or reasonable default
        const initialK = TOTAL_YEARS / MAX_VISIBLE_YEARS;

        // Center view roughly on modern times if possible, or 1900
        const centerYear = 1900;
        const centerX = baseXScale(centerYear);
        const centerView = width / 2;
        const tX = centerView - centerX * initialK;

        select(mainSvg)
            .call(zoom as any)
            .call(
                zoom.transform as any,
                zoomIdentity.translate(tX, 0).scale(initialK),
            );
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
        if (!baseXScale || !zoomTransform) return;

        // 1. Identify all candidates for this Scale
        const currentScale = zoomTransform.rescaleX(baseXScale);
        const threshold = getProminenceThreshold(zoomTransform.k);

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

        updateRenderState();
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
        visibleLaneCount += LOAD_MORE_INCREMENT;
        updateRenderState();
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

    function handleWheel(e: WheelEvent) {
        if (e.ctrlKey || e.metaKey) return; // Leave Zoom to D3 loop

        // Horizontal scroll intent -> Virtual Pan
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.preventDefault();
            const current = zoomTransform;
            const newTx = current.x - e.deltaX;

            select(mainSvg).call(
                zoom.transform as any,
                zoomIdentity.translate(newTx, current.y).scale(current.k),
            );
        }
        // Vertical scroll -> Native overflow behavior
    }

    // Calculated Grid Lines
    $: gridLines = baseXScale
        ? range(Math.ceil(MIN_YEAR / 100) * 100, MAX_YEAR + 1, 100)
        : [];
</script>

<div class="timeline-app">
    <div class="main-viewport" bind:this={viewport} on:wheel={handleWheel}>
        <!-- SVG Height: Cap strictly at visible lanes -->
        <svg
            bind:this={mainSvg}
            {width}
            height={margin.top +
                Math.min(visibleLaneCount, maxLaneIndex + 1) * ROW_HEIGHT +
                60}
        >
            {#if xScale}
                {@const curX = xScale}
                <!-- Grid -->
                {#each gridLines as year}
                    <line
                        x1={curX(year)}
                        x2={curX(year)}
                        y1="0"
                        y2="100%"
                        stroke="#e5e7eb"
                        stroke-width="1"
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
                        on:click|stopPropagation={() => onPersonClick(person)}
                        on:mouseenter={handleMouseEnter}
                        on:mouseleave={handleMouseLeave}
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
                            fill={getPersonColor(person.id)}
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
        <!-- Only show if we actually have hidden lanes -->
        {#if visibleLaneCount <= maxLaneIndex}
            <div class="load-more-container">
                <button class="load-more-btn" on:click={loadMore}>
                    Vis flere personer ({maxLaneIndex - visibleLaneCount + 1} til
                    skjult)
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
        background: #faf9f6;
        position: relative;
    }
    .main-viewport {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        position: relative;
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
    }
    .load-more-btn {
        pointer-events: auto;
        background: white;
        border: 1px solid #ccc;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        color: #333;
        transition: all 0.2s;
    }
    .load-more-btn:hover {
        background: #f3f3f3;
        transform: translateY(-1px);
        box-shadow: 0 6px 8px rgba(0, 0, 0, 0.1);
    }
    .person-block {
        cursor: pointer;
    }
</style>
