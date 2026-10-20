// Client-side helper for the pages opened from an emailed link
// (/reset-password, /verify-email). The token arrives in the query string;
// once the page has it (as a prop), it's taken out of the address bar so it
// doesn't sit in browser history, get copied along with the URL, or show on
// a shared screen. Server and edge logs still saw the request — the
// tokens' short expiry and single use cover that.
export function removeTokenFromAddressBar() {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("token")) return
    url.searchParams.delete("token")
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash)
}
