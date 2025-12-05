<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Timeline from "$lib/components/Timeline.svelte";
    import PersonPanel from "$lib/components/PersonPanel.svelte";
    import type { Person } from "$lib/types";
    import { allPeople } from "$lib/data/people";
    import type { PageData } from "./$types";

    export let data: PageData;

    let allPeopleData: Person[] = allPeople;
    let selectedPerson: Person | null = null;
    let isPanelOpen = false;

    // Filter to explorers only
    $: explorerPeople = allPeopleData.filter((p) => {
        const occs = p.occupations.map((o) => o.toLowerCase()).join(" ");
        const name = p.name.toLowerCase();
        const summary = (p.summary || "").toLowerCase();

        const isExplorer =
            occs.includes("explorer") ||
            occs.includes("utforsker") ||
            occs.includes("polar") ||
            name.includes("amundsen") ||
            name.includes("nansen") ||
            name.includes("heyerdahl") ||
            summary.includes("explorer") ||
            summary.includes("polar") ||
            summary.includes("expedition");

        return isExplorer;
    });

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
</script>

<div class="app-container">
    <!-- Header -->
    <header class="header">
        <div class="header-content">
            <div>
                <h1 class="title">Norwegian Explorers Timeline</h1>
                <p class="subtitle">
                    Interactive timeline • {explorerPeople.length} explorers from
                    {Math.min(...explorerPeople.map((p) => p.birthYear))} to present
                </p>
            </div>
        </div>
    </header>

    <!-- Main Timeline -->
    <main class="main-content">
        <Timeline people={explorerPeople} onPersonClick={handlePersonClick} />

        <!-- Person Panel -->
        <PersonPanel
            person={selectedPerson}
            bind:isOpen={isPanelOpen}
            allPeople={explorerPeople}
        />
    </main>

    <!-- Footer -->
    <footer class="footer">
        <div class="footer-content">
            <div class="footer-text">
                <p>Norwegian Explorers • Data from Wikidata</p>
            </div>
            <div class="footer-links">
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
        font-family:
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
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
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px 32px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        flex-shrink: 0;
        z-index: 10;
    }

    .header-content {
        max-width: 1400px;
        margin: 0 auto;
    }

    .title {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 4px 0;
        letter-spacing: -0.02em;
    }

    .subtitle {
        font-size: 14px;
        margin: 0;
        opacity: 0.95;
        font-weight: 500;
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
        padding: 12px 32px;
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

    .footer-text p {
        margin: 0;
        font-size: 13px;
        color: #6b7280;
        font-weight: 500;
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
        padding: 8px;
        border-radius: 6px;
    }

    .footer-link:hover {
        color: #2563eb;
        background: #eff6ff;
    }
</style>
