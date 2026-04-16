// ─── Helpers ──────────────────────────────────────────────────────────────────

function getContract(abiKey) {
	const contractName = abiKey.replace("_ContractABI", "");

	if (window._contracts?.[contractName]) {
		const { abi, address } = window._contracts[contractName];
		return new window.web3.eth.Contract(abi, address);
	}

	// Fallback: legacy localStorage path
	const abi = JSON.parse(window.localStorage[abiKey]);
	const address =
		window.localStorage[abiKey.replace("_ContractABI", "_ContractAddress")];
	return new window.web3.eth.Contract(abi, address);
}

function getSessionAddress() {
	return window._session?.userAddress ?? window.localStorage["userAddress"];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_STATES = {
	CREATED: 0,
	SCHEDULED: 1,
	VERIFIED: 2,
	REJECTED: 3,
	ON_SALE: 4,
	BOUGHT: 5,
};

// ─── Connection Check ─────────────────────────────────────────────────────────

async function checkConnection() {
	if (!window.ethereum) {
		alert("Please add the MetaMask extension to your browser.");
		return;
	}

	try {
		await window._contractsReady;

		window.web3 = new Web3(ethereum);

		const accounts = await web3.eth.getAccounts();
		const connectedAccount = accounts[0];
		const sessionAddress = getSessionAddress();

		console.log("MetaMask account :", connectedAccount);
		console.log("Logged-in account:", sessionAddress);

		if (connectedAccount !== sessionAddress) {
			alert(
				"MetaMask account doesn't match the account used to log in. Please log in again.",
			);
			window.location.href = "/";
			return;
		}

		await Promise.all([fetchUserDetails(), fetchPropertiesOfOwner()]);
	} catch (error) {
		console.error("Connection check failed:", error);
		alert("Something went wrong while connecting. Please try again.");
	}
}

// ─── User Details ─────────────────────────────────────────────────────────────

async function fetchUserDetails() {
	const contract = getContract("Users_ContractABI");
	const address = getSessionAddress();

	try {
		const userDetails = await contract.methods.users(address).call();

		if (userDetails.userID === address) {
			document.getElementById("nameOfUser").textContent = userDetails.firstName;
		} else {
			alert("Account not found. Please log in again.");
		}
	} catch (error) {
		console.error("Failed to fetch user details:", error);
	}
}

// ─── View Toggles ─────────────────────────────────────────────────────────────

function toggleShowProperties() {
	document.getElementById("addProperty").style.display = "none";
	document.getElementById("propertiesTable").style.display = "block";
	document.getElementById("notifyUser").style.display = "none";

	const btn = document.getElementById("addPropertyButtonDiv");
	btn.textContent = "Add Property";
	btn.onclick = toggleAddProperty;

	fetchPropertiesOfOwner();
}

function toggleAddProperty() {
	document.getElementById("propertiesTable").style.display = "none";
	document.getElementById("addProperty").style.display = "block";
	document.getElementById("notifyUser").style.display = "none";

	const btn = document.getElementById("addPropertyButtonDiv");
	btn.textContent = "Dashboard";
	btn.onclick = toggleShowProperties;
}

// ─── Add Property ─────────────────────────────────────────────────────────────

async function addProperty(event) {
	event.preventDefault();
	alertUser("", "alert-info", "none");

	const location = document.getElementById("location").value;
	const revenueDeptId = document.getElementById("revenueDeptId").value;
	const surveyNo = document.getElementById("suveyNumber").value;
	const area = document.getElementById("area").value;
	const address = getSessionAddress();
	const contract = getContract("LandRegistry_ContractABI");

	try {
		showTransactionLoading("Adding Your Land...");

		const tx = await contract.methods
			.addLand(location, revenueDeptId, surveyNo, area)
			.send({ from: address });
		const landAddedEvent = tx.events.LandAdded.returnValues;
		const { owner, propertyId } = landAddedEvent;

		console.log(`${owner} added with ID: ${propertyId}`);
		showTransactionLoading("Uploading Documents...");

		const propertyDocs = document.getElementById("registrationDoc").files[0];
		const formData = new FormData();
		formData.append("propertyDocs", propertyDocs);
		formData.append("owner", owner);
		formData.append("propertyId", propertyId);

		const response = await fetch("/uploadPropertyDocs", {
			method: "POST",
			body: formData,
		});
		const data = await response.json();

		closeTransactionLoading();

		if (data.status === "success") {
			alertUser("Land added successfully.", "alert-success", "block");
		} else {
			alertUser("Failed to upload documents.", "alert-danger", "block");
		}
	} catch (error) {
		console.error("Failed to add property:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

// ─── Fetch & Render Properties ────────────────────────────────────────────────

async function fetchPropertiesOfOwner() {
	const contract = getContract("LandRegistry_ContractABI");
	const address = getSessionAddress();

	try {
		const properties = await contract.methods
			.getPropertiesOfOwner(address)
			.call();
		console.log("Properties:", properties);
		renderPropertiesTable(properties);
	} catch (error) {
		console.error("Failed to fetch properties:", error);
	}
}

function renderPropertiesTable(properties) {
	const tableBody = document.getElementById("propertiesTableBody");

	if (!properties.length) {
		tableBody.innerHTML = `<tr><td colspan="9">You have no properties.</td></tr>`;
		return;
	}

	const fragment = document.createDocumentFragment();

	properties.forEach((property, i) => {
		const tr = document.createElement("tr");

		for (const value of [
			i + 1,
			property.propertyId,
			property.locationId,
			property.revenueDepartmentId,
			property.surveyNumber,
			property.area,
		]) {
			const td = document.createElement("td");
			td.textContent = value;
			tr.appendChild(td);
		}

		// PDF button
		const pdfTd = document.createElement("td");
		const pdfBtn = document.createElement("button");
		pdfBtn.className = "pdfButton";
		pdfBtn.textContent = "PDF";
		pdfBtn.addEventListener("click", () => showPdf(property.propertyId));
		pdfTd.appendChild(pdfBtn);
		tr.appendChild(pdfTd);

		// State cell
		const stateTd = document.createElement("td");
		stateTd.textContent = getStateLabel(property);
		tr.appendChild(stateTd);

		// Sell cell
		const sellTd = document.createElement("td");
		appendSellCell(sellTd, property);
		tr.appendChild(sellTd);

		fragment.appendChild(tr);
	});

	tableBody.replaceChildren(fragment);
}

// ─── Property State ───────────────────────────────────────────────────────────

function getStateLabel(property) {
	const state = Number(property.state);
	switch (state) {
		case PROPERTY_STATES.CREATED:
			return "Under Verification";
		case PROPERTY_STATES.SCHEDULED:
			return `Scheduled on ${property.scheduledDate}`;
		case PROPERTY_STATES.VERIFIED:
			return "Verified";
		case PROPERTY_STATES.REJECTED:
			return "Rejected";
		case PROPERTY_STATES.ON_SALE:
			return "On Sale";
		case PROPERTY_STATES.BOUGHT:
			return "Bought";
		default:
			console.warn("Unknown property state:", state);
			return "Unknown";
	}
}

function appendSellCell(td, property) {
	const state = Number(property.state);

	if (state === PROPERTY_STATES.VERIFIED || state === PROPERTY_STATES.BOUGHT) {
		const btn = document.createElement("button");
		btn.className = "buyButton";
		btn.textContent = "Sell";
		btn.addEventListener("click", () =>
			makePropertyAvailableToSell(property.propertyId),
		);
		td.appendChild(btn);
	} else if (state === PROPERTY_STATES.ON_SALE) {
		td.textContent = "Already on sale";
	} else {
		td.textContent = "Not allowed yet";
	}
}

// ─── Make Property Available to Sell ─────────────────────────────────────────

async function makePropertyAvailableToSell(propertyId) {
	alertUser("", "alert-info", "none");

	const contract = getContract("TransferOwnership_ContractABI");
	const address = getSessionAddress();

	const price = await showPrompt();
	if (price === null || price === "") {
		alertUser("Please enter a price.", "alert-info", "block");
		return;
	}

	try {
		showTransactionLoading("Making available to sell...");

		const tx = await contract.methods
			.addPropertyOnSale(propertyId, price)
			.send({ from: address });
		const saleAddedEvent = tx.events.PropertyOnSale.returnValues;

		console.log(
			`${saleAddedEvent.owner} listed property ${saleAddedEvent.propertyId} as sale ${saleAddedEvent.saleId}`,
		);

		closeTransactionLoading();
		alertUser("Successfully added to sales list.", "alert-success", "block");
		fetchPropertiesOfOwner();
	} catch (error) {
		console.error("Failed to list property for sale:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

// ─── PDF Popup ────────────────────────────────────────────────────────────────

function showPdf(propertyId) {
	document.getElementById("pdf-frame").src =
		`/propertiesDocs/pdf/${propertyId}`;
	document.querySelector(".pdf-popup").style.display = "flex";
}

function closePopup() {
	document.querySelector(".pdf-popup").style.display = "none";
	document.getElementById("pdf-frame").src = "";
}

// ─── Custom Prompt ────────────────────────────────────────────────────────────

function showPrompt() {
	const backcover = document.getElementById("prompt-container-backcover");
	const input = document.getElementById("prompt-input");
	const okButton = document.getElementById("prompt-ok");
	const cancelButton = document.getElementById("prompt-cancel");

	// Clone to strip previously attached listeners — prevents duplicate transactions
	const freshOk = okButton.cloneNode(true);
	const freshCancel = cancelButton.cloneNode(true);
	okButton.replaceWith(freshOk);
	cancelButton.replaceWith(freshCancel);

	backcover.classList.add("is-visible");
	input.value = "";
	input.focus();

	return new Promise((resolve) => {
		freshOk.addEventListener("click", () => {
			backcover.classList.remove("is-visible");
			resolve(input.value);
		});
		freshCancel.addEventListener("click", () => {
			backcover.classList.remove("is-visible");
			resolve(null);
		});
	});
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function showTransactionLoading(msg = "Loading…") {
	document.getElementById("loadingText").textContent = msg;
	document.getElementById("loadingDiv").classList.add("is-visible");
}

function closeTransactionLoading() {
	document.getElementById("loadingDiv").classList.remove("is-visible");
}

function alertUser(msg, msgType, display) {
	const notifyUser = document.getElementById("notifyUser");
	notifyUser.className = `alert ${msgType}`;
	notifyUser.textContent = msg;
	notifyUser.style.display = display;
}

// ─── Error Parsing ────────────────────────────────────────────────────────────

function showError(error) {
	if (error.code === 4001) return "Transaction rejected by user.";
	try {
		const start = error.message.indexOf("{");
		if (start === -1) throw new Error("No JSON in error message");
		const parsed = JSON.parse(error.message.slice(start));
		const data = parsed.value.data.data;
		const txHash = Object.getOwnPropertyNames(data)[0];
		return data[txHash].reason;
	} catch {
		return error.message || "An unknown error occurred.";
	}
}
