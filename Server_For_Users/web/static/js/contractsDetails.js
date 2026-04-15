// ─── Contract Names ───────────────────────────────────────────────────────────

const CONTRACT_NAMES = ["Users", "LandRegistry", "TransferOwnership"];

// ─── Fetch Contract Details ───────────────────────────────────────────────────

async function fetchContractDetails() {
	try {
		const response = await fetch("/fetchContractDetails");

		if (!response.ok) {
			throw new Error(`Request failed with status ${response.status}`);
		}

		const data = await response.json();

		window._contracts = {};

		for (const name of CONTRACT_NAMES) {
			if (!data[name]) {
				throw new Error(`Contract "${name}" missing from server response`);
			}
			window._contracts[name] = {
				address: data[name].address,
				abi: data[name].abi, // keep as object — no need to stringify
			};
		}

		console.log("Contract details loaded:", Object.keys(window._contracts));
		return window._contracts;
	} catch (error) {
		console.error("Failed to fetch contract details:", error.message);
		throw error;
	}
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function logout() {
	// MetaMask does not support programmatic disconnection —
	// provider.disconnect() is not a valid method and will always throw.
	// The correct approach is to clear session state and redirect to login.
	// The user can disconnect the site manually in MetaMask if needed.

	window._contracts = null;
	window._session = null;

	// Let the server clear its session cookie
	window.location.href = "/logout";
}

// ─── Auto-fetch on page load ──────────────────────────────────────────────────

fetchContractDetails();
