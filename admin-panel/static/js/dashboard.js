// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_STATES = {
	CREATED: 0,
	SCHEDULED: 1,
	VERIFIED: 2,
	REJECTED: 3,
	ON_SALE: 4,
	BOUGHT: 5,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns the LandRegistry contract instance, reading from in-memory store.
// Falls back to localStorage for backwards compatibility.
function getLandRegistryContract() {
	let abi, address;

	if (window._contracts?.LandRegistry) {
		({ abi, address } = window._contracts.LandRegistry);
	} else {
		// Fallback: legacy localStorage path
		abi = JSON.parse(window.localStorage.LandRegistry_ContractABI);
		address = window.localStorage.LandRegistry_ContractAddress;
	}

	return new window.web3.eth.Contract(abi, address);
}

function getSessionData() {
	return {
		employeeId: window._session?.employeeId ?? window.localStorage.employeeId,
		empName: window._session?.empName ?? window.localStorage.empName,
		revenueDeptId:
			window._session?.revenueDeptId ?? window.localStorage.revenueDepartmentId,
	};
}

// ─── Connection Check ─────────────────────────────────────────────────────────

async function checkConnection() {
	if (!window.ethereum) {
		alert("Please add the MetaMask extension to your browser.");
		return;
	}

	try {
		window.web3 = new Web3(ethereum);

		const accounts = await web3.eth.getAccounts();
		const connectedAccount = accounts[0];
		const { employeeId, empName, revenueDeptId } = getSessionData();

		console.log("MetaMask account :", connectedAccount);
		console.log("Logged-in account:", employeeId);

		if (connectedAccount !== employeeId) {
			alert(
				"MetaMask account doesn't match the account used to log in. Please log in again.",
			);
			window.location.href = "/";
			return;
		}

		document.getElementById("revenueDeptId").textContent = revenueDeptId;
		document.getElementById("nameOfUser").textContent = empName;

		await fetchPropertiesUnderControl(revenueDeptId);
	} catch (error) {
		console.error("Connection check failed:", error);
		alert("Something went wrong while connecting. Please try again.");
	}
}

// ─── Fetch & Render Properties ────────────────────────────────────────────────

async function fetchPropertiesUnderControl(revenueDepartmentId) {
	const contract = getLandRegistryContract();

	try {
		const properties = await contract.methods
			.getPropertiesByRevenueDeptId(revenueDepartmentId)
			.call();

		console.log("Properties fetched:", properties);
		renderPropertiesTable(properties);
	} catch (error) {
		console.error("Failed to fetch properties:", error);
		alert("Failed to load properties. Check the console for details.");
	}
}

function renderPropertiesTable(properties) {
	const tableBody = document.getElementById("propertiesTableBody");

	if (!properties.length) {
		tableBody.innerHTML = `<tr><td colspan="6">No properties found.</td></tr>`;
		return;
	}

	// Build rows with a document fragment — never build HTML via string concat
	// with on-chain data (XSS risk if any field contains HTML/JS characters)
	const fragment = document.createDocumentFragment();

	for (const property of properties) {
		const tr = document.createElement("tr");

		const fields = [
			property.propertyId,
			property.locationId,
			property.surveyNumber,
			property.area,
		];

		for (const value of fields) {
			const td = document.createElement("td");
			td.textContent = value; // textContent — never innerHTML for on-chain data
			tr.appendChild(td);
		}

		// PDF button cell
		const pdfTd = document.createElement("td");
		const pdfBtn = document.createElement("button");
		pdfBtn.className = "pdfButton";
		pdfBtn.textContent = "PDF";
		pdfBtn.addEventListener("click", () => showPdf(property.propertyId));
		pdfTd.appendChild(pdfBtn);
		tr.appendChild(pdfTd);

		// State cell
		const stateTd = document.createElement("td");
		appendStateCell(stateTd, property);
		tr.appendChild(stateTd);

		fragment.appendChild(tr);
	}

	tableBody.replaceChildren(fragment);
}

// ─── Property State Cell ──────────────────────────────────────────────────────

function appendStateCell(td, property) {
	const state = Number(property.state);

	switch (state) {
		case PROPERTY_STATES.CREATED: {
			const acceptBtn = document.createElement("button");
			acceptBtn.className = "accept";
			acceptBtn.textContent = "Accept";
			acceptBtn.addEventListener("click", () =>
				acceptProperty(property.propertyId),
			);

			const rejectBtn = document.createElement("button");
			rejectBtn.className = "reject";
			rejectBtn.textContent = "Reject";
			rejectBtn.addEventListener("click", () =>
				rejectProperty(property.propertyId),
			);

			td.appendChild(acceptBtn);
			td.appendChild(rejectBtn);
			break;
		}

		case PROPERTY_STATES.SCHEDULED:
			td.textContent = `Scheduled on ${property.scheduledDate}`;
			break;

		case PROPERTY_STATES.VERIFIED:
		case PROPERTY_STATES.ON_SALE:
		case PROPERTY_STATES.BOUGHT:
			td.textContent = "Accepted";
			break;

		case PROPERTY_STATES.REJECTED:
			td.textContent = `Rejected: ${property.rejectedReason}`;
			break;

		default:
			console.warn("Unknown property state:", state);
			td.textContent = "Unknown";
	}
}

// ─── Accept / Reject ──────────────────────────────────────────────────────────

async function acceptProperty(propertyId) {
	const contract = getLandRegistryContract();
	const { employeeId, revenueDeptId } = getSessionData();

	try {
		const receipt = await contract.methods
			.verifyProperty(propertyId)
			.send({ from: employeeId });

		console.log("Accept receipt:", receipt);
		await fetchPropertiesUnderControl(revenueDeptId);
	} catch (error) {
		console.error("Failed to accept property:", error);
		alert("Failed to accept property. See console for details.");
	}
}

async function rejectProperty(propertyId) {
	const contract = getLandRegistryContract();
	const { employeeId, revenueDeptId } = getSessionData();

	// TODO: replace hardcoded reason with a prompt/modal so the verifier
	// can provide a specific rejection reason
	const reason = "Documents are not clear";

	try {
		const receipt = await contract.methods
			.rejectProperty(propertyId, reason)
			.send({ from: employeeId });

		console.log("Reject receipt:", receipt);
		await fetchPropertiesUnderControl(revenueDeptId);
	} catch (error) {
		console.error("Failed to reject property:", error);
		alert("Failed to reject property. See console for details.");
	}
}

// ─── PDF Popup ────────────────────────────────────────────────────────────────

// FIX: look up DOM elements at call time — scripts load from <head>
// before the DOM exists, so top-level caching returns null and crashes.

function showPdf(propertyId) {
	document.getElementById("pdf-frame").src =
		`/propertiesDocs/pdf/${propertyId}`;
	document.querySelector(".pdf-popup").style.display = "flex";
}

function closePopup() {
	document.querySelector(".pdf-popup").style.display = "none";
	document.getElementById("pdf-frame").src = "";
}
