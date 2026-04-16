// Contract names to load — add new contracts here without touching the logic below
const CONTRACT_NAMES = ["Users", "LandRegistry", "TransferOwnership"];

async function fetchContractDetails() {
	try {
		const response = await fetch("/fetchContractDetails");

		if (!response.ok) {
			throw new Error(`Request failed with status ${response.status}`);
		}

		const data = await response.json();

		// Store each contract's details in memory instead of localStorage
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
		throw error; // let the caller decide how to handle it
	}
}

// Helper — get a contract's details anywhere in the app:
//   const { address, abi } = getContract("Users");
function getContract(name) {
	const contract = window._contracts?.[name];
	if (!contract) {
		throw new Error(
			`Contract "${name}" not loaded. Call fetchContractDetails() first.`,
		);
	}
	return contract;
}
