/**
 * Calls handler() if the pressed key is "enter" or "space."
 */
// eslint-disable-next-line import/prefer-default-export
export function filterKeypress(e: React.KeyboardEvent<HTMLElement>, handler: () => void): void {
    if (e.keyCode === 32 /* space */ || e.keyCode === 13 /* enter */) {
        handler();
    }
}
