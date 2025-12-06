<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Timeline from "$lib/components/Timeline.svelte";
    import PersonPanel from "$lib/components/PersonPanel.svelte";
    import ScrollToTop from "$lib/components/ScrollToTop.svelte";
    import type { Person } from "$lib/types";
    import { allPeople } from "$lib/data/people";
    import type { PageData } from "./$types";

    export let data: PageData;

    let allPeopleData: Person[] = allPeople;
    let selectedPerson: Person | null = null;
    let isPanelOpen = false;
    let timelineComponent: Timeline;

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

    onMount(() => {
        if (typeof window !== "undefined") {
            window.addEventListener("keydown", handleKeyDown);
        }
    });

    onDestroy(() => {
        if (typeof window !== "undefined") {
            window.removeEventListener("keydown", handleKeyDown);
        }
    });

    // Theme - LIGHT MODE ONLY
</script>

<div class="app-container">
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <div>
                <h1 class="title">Norwegian Historical Figures</h1>
                <p class="subtitle">
                    Interactive timeline • {allPeopleData.length} people from {Math.min(
                        ...allPeopleData.map((p) => p.birthYear),
                    )} to present
                </p>
            </div>
        </div>
    </header>

    <!-- Main Timeline -->
    <main class="main-content">
        <Timeline
            bind:this={timelineComponent}
            people={allPeopleData}
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
                        title="Scroll to start (700)"
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
            <div
                class="footer-links"
                style="display: flex; gap: 12px; align-items: center;"
            >
                <a
                    href="https://github.com/egil10/norgeskart"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="footer-link"
                    title="View on GitHub"
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
                        <path
                            d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
                        />
                        <path d="M9 18c-4.51 2-5-2-7-2" />
                    </svg>
                </a>
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
