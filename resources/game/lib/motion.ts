/** True when the player (setting) or OS asks for reduced motion. */
export function prefersReducedMotion(): boolean {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('osl-reduce-motion')) {
        return true;
    }
    return typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
}
