/**
 * reads/sets the Fabric theme based on user preference stored in localStorage.
 * prevents the flash of default theme on initial load if included before
 * first react render.
 */
(function () {
	try {
		const stored = localStorage.getItem("fabricThemeSelect");
		const themes = ["light", "dark", "blue", "coffee", "terminal"];

		if (stored && themes.includes(stored) && stored !== "light") {
			document.documentElement.classList.add(stored);
		}
	} catch (e) {}
})();
