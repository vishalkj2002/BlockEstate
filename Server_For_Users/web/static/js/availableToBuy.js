// ─── Helpers ──────────────────────────────────────────────────────────────────

// FIX: read from window._contracts (set by contractsDetails.js) first.
// The old localStorage keys (Users_ContractABI etc.) are never written by
// the improved contractsDetails.js, so falling back to them always fails.
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

		await fetchUserDetails();
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

		if (userDetails["userID"] === address) {
			document.getElementById("nameOfUser").textContent =
				userDetails["firstName"];
		} else {
			alert("Account not found. Please log in again.");
		}
	} catch (error) {
		console.error("Failed to fetch user details:", error);
		alert("Failed to load user details. Check the console for details.");
	}
}

// ─── Properties Available to Buy ─────────────────────────────────────────────

// Track current locationId so we can refresh the table after a purchase request
let currentLocationId = null;

async function fetchPropertiesAvailableToBuy(event) {
	event.preventDefault();

	const address = getSessionAddress();
	const transferContract = getContract("TransferOwnership_ContractABI");
	const usersContract = getContract("Users_ContractABI");

	currentLocationId = document.getElementById("inputLocationId").value;
	document.getElementById("salesTable").style.display = "block";

	// Update the display span in the table header
	const locationDisplay = document.getElementById("locationId");
	if (locationDisplay) locationDisplay.textContent = currentLocationId;

	try {
		// Fetch all three lists in parallel for speed
		const [salesOnLocation, mySales, myRequestedSales] = await Promise.all([
			transferContract.methods.getSalesByLocation(currentLocationId).call(),
			transferContract.methods.getMySales(address).call(),
			transferContract.methods.getRequestedSales(address).call(),
		]);

		// Build lookup sets for O(1) checks
		const myCreatedSaleIds = new Set(mySales.map((s) => s.saleId));
		const myRequestedSaleIds = new Set(myRequestedSales.map((s) => s.saleId));

		// Only process active sales (state == 0)
		const activeSales = salesOnLocation.filter(
			(s) => s.state === "0" || s.state === 0,
		);

		const tableBody = document.getElementById("salesTableBody");

		if (!activeSales.length) {
			tableBody.innerHTML = `<tr><td colspan="6">No properties available for sale in this location.</td></tr>`;
			return;
		}

		// Fetch all owner details in parallel
		const ownerDetails = await Promise.all(
			activeSales.map((sale) => usersContract.methods.users(sale.owner).call()),
		);

		const fragment = document.createDocumentFragment();

		activeSales.forEach((sale, i) => {
			const price = web3.utils.fromWei(sale.price);
			const owner = ownerDetails[i];
			const tr = document.createElement("tr");

			for (const value of [
				"",
				sale.saleId,
				owner.firstName,
				sale.propertyId,
				price,
			]) {
				const td = document.createElement("td");
				td.textContent = value;
				tr.appendChild(td);
			}

			const actionTd = document.createElement("td");

			if (myRequestedSaleIds.has(sale.saleId)) {
				actionTd.textContent = "Added to cart";
			} else if (myCreatedSaleIds.has(sale.saleId)) {
				actionTd.textContent = "Your property";
			} else {
				const buyBtn = document.createElement("button");
				buyBtn.className = "buyButton";
				buyBtn.textContent = "Buy";
				buyBtn.addEventListener("click", () =>
					sendPurchaseRequest(sale.saleId, price),
				);
				actionTd.appendChild(buyBtn);
			}

			tr.appendChild(actionTd);
			fragment.appendChild(tr);
		});

		tableBody.replaceChildren(fragment);
	} catch (error) {
		console.error("Failed to fetch properties:", error);
		alertUser(
			"Failed to load properties. Check the console for details.",
			"alert-danger",
			"block",
		);
	}
}

// ─── Purchase Request ─────────────────────────────────────────────────────────

async function sendPurchaseRequest(saleId, price) {
	alertUser("", "alert-info", "none");

	const contract = getContract("TransferOwnership_ContractABI");
	const address = getSessionAddress();

	const confirmedPrice = await showPrompt();
	if (confirmedPrice === null || confirmedPrice === "") {
		alertUser("Please enter a price.", "alert-info", "block");
		return;
	}

	try {
		showTransactionLoading("Sending Purchase Request...");

		await contract.methods
			.sendPurchaseRequest(saleId, confirmedPrice)
			.send({ from: address })
			.on("receipt", () => {
				closeTransactionLoading();
				alertUser(
					"Purchase request sent successfully.",
					"alert-success",
					"block",
				);
				document.getElementById("inputLocationId").value = currentLocationId;
				document.getElementById("inputLocationIdForm").requestSubmit();
			})
			.on("error", (error) => {
				console.error("Transaction error:", error);
				closeTransactionLoading();
				alertUser(showError(error), "alert-danger", "block");
			});
	} catch (error) {
		console.error("Purchase request failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

// ─── Custom Prompt ────────────────────────────────────────────────────────────

function showPrompt() {
	const backcover = document.getElementById("prompt-container-backcover");
	const input = document.getElementById("prompt-input");
	const okButton = document.getElementById("prompt-ok");
	const cancelButton = document.getElementById("prompt-cancel");

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
