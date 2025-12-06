<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    let showButton = false;
    let viewport: HTMLElement | null = null;

    function handleScroll() {
        if (!viewport) return;
        // Show button when scrolled down more than 300px
        showButton = viewport.scrollTop > 300;
    }

    function scrollToTop() {
        if (!viewport) return;
        viewport.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    function findViewport() {
        // Try to find the scrollable viewport element
        viewport = document.querySelector(".main-viewport") as HTMLElement;
        if (viewport) {
            viewport.addEventListener("scroll", handleScroll);
            // Check initial scroll position
            handleScroll();
            return true;
        }
        return false;
    }

    onMount(() => {
        // Try to find viewport immediately
        if (!findViewport()) {
            // If not found, wait a bit and try again (in case Timeline hasn't rendered yet)
            const timeout = setTimeout(() => {
                findViewport();
            }, 100);

            // Also try on next frame
            requestAnimationFrame(() => {
                if (!viewport) {
                    findViewport();
                }
            });

            return () => clearTimeout(timeout);
        }
    });

    onDestroy(() => {
        if (viewport) {
            viewport.removeEventListener("scroll", handleScroll);
        }
    });
</script>

<button
    class="scroll-to-top"
    class:visible={showButton}
    aria-label="Scroll to top"
    title="Scroll to top"
    on:click={scrollToTop}
>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide lucide-arrow-up"
    >
        <path d="m5 12 7-7 7 7"></path>
        <path d="M12 19V5"></path>
    </svg>
</button>

<style>
    .scroll-to-top {
        position: absolute;
        bottom: 24px;
        right: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: white;
        border: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        z-index: 1000;
        color: #333;
    }

    .scroll-to-top.visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
    }

    .scroll-to-top:hover {
        background: #f3f4f6;
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .scroll-to-top:active {
        transform: translateY(0);
    }
</style>
