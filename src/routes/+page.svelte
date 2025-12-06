<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Timeline from "$lib/components/Timeline.svelte";
    import PersonPanel from "$lib/components/PersonPanel.svelte";
    import ScrollToTop from "$lib/components/ScrollToTop.svelte";
    import CategoryFilter from "$lib/components/CategoryFilter.svelte";
    import type { Person } from "$lib/types";
    import { allPeople } from "$lib/data/people";
    import { allOccupations } from "$lib/config/occupations";
    import { getOccupationCategory } from "$lib/config/colors";
    import type { PageData } from "./$types";

    export let data: PageData;

    let allPeopleData: Person[] = allPeople;
    let selectedPerson: Person | null = null;
    let isPanelOpen = false;
    let timelineComponent: Timeline;
    let selectedCategories: Set<string> = new Set(allOccupations);
    let filteredPeople: Person[] = allPeopleData;
    let showFilter = false;
    let zoomLevel = 50; // 0-100 percentage
    let isDraggingZoom = false;

    function handlePersonClick(person: Person) {
        selectedPerson = person;
        isPanelOpen = true;
    }

    // Keyboard shortcuts
    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape" && isPanelOpen) {
            isPanelOpen = false;
            selectedPerson = null;
        }
    }

    let animationFrameId: number | null = null;

    function updateZoomFromTimeline() {
        if (timelineComponent && !isDraggingZoom) {
            const newZoomLevel = timelineComponent.getZoomLevel();
            if (Math.abs(newZoomLevel - zoomLevel) > 0.5) {
                zoomLevel = newZoomLevel;
            }
        }
        animationFrameId = requestAnimationFrame(updateZoomFromTimeline);
    }

    onMount(() => {
        if (typeof window !== "undefined") {
            window.addEventListener("keydown", handleKeyDown);
            // Start zoom level update loop
            animationFrameId = requestAnimationFrame(updateZoomFromTimeline);
        }
    });

    onDestroy(() => {
        if (typeof window !== "undefined") {
            window.removeEventListener("keydown", handleKeyDown);
        }
        if (zoomUpdateFrame !== null) {
            cancelAnimationFrame(zoomUpdateFrame);
        }
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
        }
    });

    function handleCategoriesChange(categories: Set<string>) {
        selectedCategories = categories;
    }

    $: {
        if (selectedCategories.size === 0) {
            filteredPeople = [];
        } else {
            filteredPeople = allPeopleData.filter((person) => {
                const personCategories = person.occupations.map(occ => 
                    getOccupationCategory(occ)
                );
                return personCategories.some(cat => selectedCategories.has(cat));
            });
        }
    }


    let zoomUpdateFrame: number | null = null;
    let pendingZoomValue: number | null = null;

    function handleZoomInput(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = parseFloat(target.value);
        zoomLevel = value;
        pendingZoomValue = value;
        isDraggingZoom = true;
        
        // Throttle updates using requestAnimationFrame
        if (zoomUpdateFrame === null) {
            zoomUpdateFrame = requestAnimationFrame(() => {
                if (pendingZoomValue !== null && timelineComponent) {
                    timelineComponent.setZoomLevel(pendingZoomValue);
                }
                zoomUpdateFrame = null;
                pendingZoomValue = null;
            });
        }
    }

    function handleZoomChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = parseFloat(target.value);
        zoomLevel = value;
        isDraggingZoom = true;
        // Cancel any pending animation frame
        if (zoomUpdateFrame !== null) {
            cancelAnimationFrame(zoomUpdateFrame);
            zoomUpdateFrame = null;
        }
        pendingZoomValue = null;
        timelineComponent?.setZoomLevel(value);
    }

    function handleZoomMouseDown() {
        // Capture center year when drag starts
        timelineComponent?.captureCenterYear();
        isDraggingZoom = true;
    }

    function handleZoomMouseUp() {
        isDraggingZoom = false;
        timelineComponent?.clearCenterYear();
        // Apply any pending zoom value
        if (pendingZoomValue !== null && timelineComponent) {
            timelineComponent.setZoomLevel(pendingZoomValue);
            pendingZoomValue = null;
        }
        if (zoomUpdateFrame !== null) {
            cancelAnimationFrame(zoomUpdateFrame);
            zoomUpdateFrame = null;
        }
    }

    // Theme - LIGHT MODE ONLY
</script>

<div class="app-container">
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <div class="header-main">
                <div>
                    <h1 class="title">Norwegian Historical Figures</h1>
                    <p class="subtitle">
                        Interactive timeline • {filteredPeople.length} of {allPeopleData.length} people from {Math.min(
                            ...allPeopleData.map((p) => p.birthYear),
                        )} to present
                    </p>
                </div>
                <button
                    class="filter-toggle-btn"
                    on:click={() => showFilter = !showFilter}
                    class:active={showFilter}
                    title="Filtre"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                </button>
            </div>
            {#if showFilter}
                <div class="filter-container">
                    <CategoryFilter
                        selectedCategories={selectedCategories}
                        onCategoriesChange={handleCategoriesChange}
                    />
                </div>
            {/if}
        </div>
    </header>

    <!-- Main Timeline -->
    <main class="main-content">
        <Timeline
            bind:this={timelineComponent}
            people={filteredPeople}
            onPersonClick={handlePersonClick}
        />

        <!-- Person Panel -->
        <PersonPanel
            person={selectedPerson}
            bind:isOpen={isPanelOpen}
            allPeople={allPeopleData}
        />

        <!-- Scroll to Top Button -->
        <ScrollToTop />
    </main>

    <!-- Footer -->
    <footer class="footer">
        <div class="footer-content">
            <div class="footer-left">
                <div class="footer-controls">
                    <button
                        class="control-btn"
                        title="Reset view"
                        on:click={() => timelineComponent?.resetView()}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                            <path d="M3 21v-5h5" />
                        </svg>
                    </button>
                    <button
                        class="control-btn"
                        title="Scroll to start (600)"
                        on:click={() => timelineComponent?.scrollToLeft()}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="m11 17-5-5 5-5" />
                            <path d="m18 17-5-5 5-5" />
                        </svg>
                    </button>
                    <button
                        class="control-btn"
                        title="Scroll to end (2100)"
                        on:click={() => timelineComponent?.scrollToRight()}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="m6 17 5-5-5-5" />
                            <path d="m13 17 5-5-5-5" />
                        </svg>
                    </button>
                    <button
                        class="control-btn"
                        title="Zoom out"
                        on:click={() => timelineComponent?.zoomOut()}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                            <path d="M8 11h6" />
                        </svg>
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={zoomLevel}
                        on:input={handleZoomInput}
                        on:change={handleZoomChange}
                        on:mousedown={handleZoomMouseDown}
                        on:mouseup={handleZoomMouseUp}
                        on:touchstart={handleZoomMouseDown}
                        on:touchend={handleZoomMouseUp}
                        class="zoom-slider-inline"
                        title="Zoom level"
                    />
                    <button
                        class="control-btn"
                        title="Zoom in"
                        on:click={() => timelineComponent?.zoomIn()}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                            <path d="M11 8v6" />
                            <path d="M8 11h6" />
                        </svg>
                    </button>
                </div>
                <div class="footer-text">
                    <p>Norwegian Historical Figures • Data from Wikidata</p>
                </div>
            </div>
            <div class="footer-links">
                <div class="footer-controls">
                    <a
                        href="https://github.com/egil10/norgeskart"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="control-btn"
                        title="View on GitHub"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path
                                d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
                            />
                            <path d="M9 18c-4.51 2-5-2-7-2" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    </footer>
</div>

<style>
    :global(html),
    :global(body) {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    :global(#app) {
        height: 100%;
        width: 100%;
        overflow: hidden;
    }

    .app-container {
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: #faf9f6;
        overflow: hidden;
    }

    .header {
        background: white;
        color: black;
        padding: 16px 24px;
        border-bottom: 1px solid #e5e7eb;
        flex-shrink: 0;
        z-index: 10;
    }

    .header-content {
        max-width: 1400px;
        margin: 0 auto;
    }

    .header-main {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }

    .filter-toggle-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        color: #6b7280;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .filter-toggle-btn:hover {
        background: white;
        color: #1f2937;
        border-color: #d1d5db;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .filter-toggle-btn.active {
        background: #1f2937;
        color: white;
        border-color: #1f2937;
    }

    .filter-toggle-btn.active:hover {
        background: #374151;
        border-color: #374151;
    }

    .filter-container {
        margin-top: 16px;
        animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .title {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: black;
    }

    .subtitle {
        font-size: 13px;
        margin: 0;
        color: #6b7280;
        font-weight: 400;
    }

    .main-content {
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
    }

    .footer {
        background: white;
        border-top: 1px solid #e5e7eb;
        padding: 10px 24px;
        flex-shrink: 0;
        z-index: 10;
    }

    .footer-content {
        max-width: 1400px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .footer-left {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .footer-controls {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        background: #f9fafb;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
    }

    .control-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: #6b7280;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 0;
        text-decoration: none;
    }

    .control-btn:hover {
        background: white;
        color: #1f2937;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .control-btn:active {
        transform: scale(0.95);
    }

    .footer-text p {
        margin: 0;
        font-size: 12px;
        color: #6b7280;
        font-weight: 400;
    }

    .zoom-slider-inline {
        width: 120px;
        height: 4px;
        background: #e5e7eb;
        border-radius: 2px;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
        cursor: pointer;
        margin: 0 4px;
        flex-shrink: 0;
    }

    .zoom-slider-inline::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        background: #6b7280;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .zoom-slider-inline::-webkit-slider-thumb:hover {
        background: #1f2937;
        transform: scale(1.1);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .zoom-slider-inline::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: #6b7280;
        border-radius: 50%;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .zoom-slider-inline::-moz-range-thumb:hover {
        background: #1f2937;
        transform: scale(1.1);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .zoom-slider-inline::-moz-range-track {
        background: #e5e7eb;
        height: 4px;
        border-radius: 2px;
    }

    .footer-links {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .footer-link {
        color: #6b7280;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        border-radius: 4px;
    }

    .footer-link:hover {
        color: black;
        background: #f3f4f6;
    }
</style>
