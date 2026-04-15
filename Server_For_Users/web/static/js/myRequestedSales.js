// ─── Constants ────────────────────────────────────────────────────────────────

const PURCHASE_REQUEST_STATES = {
	SENT: 0,
	CANCELED: 1,
	SELLER_ACCEPTED: 2,
	SELLER_REJECTED: 3,
	SELLER_REJECTED_ACCEPTANCE: 4,
	CANCELED_ACCEPTANCE: 5,
	RE_REQUESTED: 6,
	SUCCESS: 7,
};

const SALE_STATES = {
	ACTIVE: 0,
	TERMINATED: 2,
	CLOSED: 3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTransferContract() {
	const abi =
		window._contracts?.TransferOwnership?.abi ??
		JSON.parse(window.localStorage.TransferOwnership_ContractABI);
	const address =
		window._contracts?.TransferOwnership?.address ??
		window.localStorage.TransferOwnership_ContractAddress;
	return { contract: new window.web3.eth.Contract(abi, address), address };
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

		// Run both fetches in parallel on load
		await Promise.all([fetchUserDetails(), fetchMyRequestedSales()]);
	} catch (error) {
		console.error("Connection check failed:", error);
		alert("Something went wrong while connecting. Please try again.");
	}
}

// ─── User Details ─────────────────────────────────────────────────────────────

async function fetchUserDetails() {
	const abi =
		window._contracts?.Users?.abi ??
		JSON.parse(window.localStorage.Users_ContractABI);
	const address =
		window._contracts?.Users?.address ??
		window.localStorage.Users_ContractAddress;

	const contract = new window.web3.eth.Contract(abi, address);
	const sessionAddress = getSessionAddress();

	try {
		const userDetails = await contract.methods.users(sessionAddress).call();

		if (userDetails.userID === sessionAddress) {
			document.getElementById("nameOfUser").textContent = userDetails.firstName;
		} else {
			alert("Account not found. Please log in again.");
		}
	} catch (error) {
		console.error("Failed to fetch user details:", error);
	}
}

// ─── Fetch Purchase Request Status ───────────────────────────────────────────

async function getStatusOfPurchaseRequest(contract, saleId) {
	const sessionAddress = getSessionAddress();

	const requestedUsers = await contract.methods
		.getRequestedUsers(saleId)
		.call();

	const myRequest = requestedUsers.find((r) => r.user === sessionAddress);
	if (!myRequest) return null;

	return {
		buyerAddress: myRequest.user,
		priceOffered: web3.utils.fromWei(myRequest.priceOffered),
		state: Number(myRequest.state),
	};
}

// ─── Fetch & Render Requested Sales ──────────────────────────────────────────

async function fetchMyRequestedSales() {
	const { contract } = getTransferContract();
	const sessionAddress = getSessionAddress();

	try {
		const myRequestedSales = await contract.methods
			.getRequestedSales(sessionAddress)
			.call();

		console.log("My requested sales:", myRequestedSales);

		// Fetch all purchase request statuses in parallel
		const statuses = await Promise.all(
			myRequestedSales.map((sale) =>
				getStatusOfPurchaseRequest(contract, sale.saleId),
			),
		);

		renderSalesTable(myRequestedSales, statuses);
	} catch (error) {
		console.error("Failed to fetch requested sales:", error);
		alertUser(
			"Failed to load your purchase requests.",
			"alert-danger",
			"block",
		);
	}
}

function renderSalesTable(sales, statuses) {
	const tableBody = document.getElementById("salesTableBody");

	if (!sales.length) {
		tableBody.innerHTML = `<tr><td colspan="7">You have no purchase requests.</td></tr>`;
		return;
	}

	const fragment = document.createDocumentFragment();

	sales.forEach((sale, i) => {
		const status = statuses[i];
		const tr = document.createElement("tr");

		// Data cells — textContent only, never innerHTML with on-chain data
		for (const value of [
			"",
			sale.saleId,
			sale.propertyId,
			web3.utils.fromWei(sale.price),
			status?.priceOffered ?? "—",
		]) {
			const td = document.createElement("td");
			td.textContent = value;
			tr.appendChild(td);
		}

		// State label cell
		const stateTd = document.createElement("td");
		stateTd.textContent = getPurchaseRequestStateLabel(status?.state);
		tr.appendChild(stateTd);

		// Action cell
		const actionTd = document.createElement("td");
		appendActionCell(actionTd, status, sale);
		tr.appendChild(actionTd);

		fragment.appendChild(tr);
	});

	tableBody.replaceChildren(fragment);
}

// ─── State Label ──────────────────────────────────────────────────────────────

function getPurchaseRequestStateLabel(state) {
	switch (state) {
		case PURCHASE_REQUEST_STATES.SENT:
			return "Request sent";
		case PURCHASE_REQUEST_STATES.CANCELED:
			return "Request canceled";
		case PURCHASE_REQUEST_STATES.SELLER_ACCEPTED:
			return "Seller accepted";
		case PURCHASE_REQUEST_STATES.SELLER_REJECTED:
			return "Seller rejected";
		case PURCHASE_REQUEST_STATES.SELLER_REJECTED_ACCEPTANCE:
			return "Seller rejected acceptance";
		case PURCHASE_REQUEST_STATES.CANCELED_ACCEPTANCE:
			return "Acceptance canceled";
		case PURCHASE_REQUEST_STATES.RE_REQUESTED:
			return "Re-requested";
		case PURCHASE_REQUEST_STATES.SUCCESS:
			return "Purchase successful";
		default:
			return "Unknown";
	}
}

// ─── Action Cell ─────────────────────────────────────────────────────────────

function appendActionCell(td, status, sale) {
	const saleState = Number(sale.state);
	const requestState = status?.state;
	const saleId = sale.saleId;
	const priceOffered = status?.priceOffered;

	if (saleState === SALE_STATES.TERMINATED) {
		td.className = "saleTerminated";
		td.textContent = "Sale terminated";
		return;
	}

	if (saleState === SALE_STATES.CLOSED) {
		td.className = "saleClosed";
		td.textContent = "Sale closed";
		return;
	}

	// Sale is active — show action based on request state
	if (
		requestState === PURCHASE_REQUEST_STATES.SENT ||
		requestState === PURCHASE_REQUEST_STATES.RE_REQUESTED
	) {
		const btn = document.createElement("button");
		btn.className = "cancelPurchaseRequestSentToSellerButton";
		btn.textContent = "Cancel request";
		btn.addEventListener("click", () =>
			cancelPurchaseRequestSentToSeller(saleId),
		);
		td.appendChild(btn);
		return;
	}

	if (requestState === PURCHASE_REQUEST_STATES.SELLER_ACCEPTED) {
		const payBtn = document.createElement("button");
		payBtn.className = "makePaymentButton";
		payBtn.textContent = "Make payment";
		payBtn.addEventListener("click", () => makePayment(saleId, priceOffered));

		const cancelBtn = document.createElement("button");
		cancelBtn.className = "rejectingAcceptanceRequestByBuyerButton";
		cancelBtn.textContent = "Cancel payment";
		cancelBtn.addEventListener("click", () =>
			rejectingAcceptanceRequestByBuyer(saleId),
		);

		td.appendChild(payBtn);
		td.appendChild(cancelBtn);
		return;
	}

	// Rejected / canceled states — offer re-request if sale is still active
	const rejectedStates = [
		PURCHASE_REQUEST_STATES.CANCELED,
		PURCHASE_REQUEST_STATES.SELLER_REJECTED,
		PURCHASE_REQUEST_STATES.SELLER_REJECTED_ACCEPTANCE,
		PURCHASE_REQUEST_STATES.CANCELED_ACCEPTANCE,
	];

	if (rejectedStates.includes(requestState)) {
		if (saleState === SALE_STATES.ACTIVE) {
			const btn = document.createElement("button");
			btn.className = "rerequestPurchaseRequestButton";
			btn.textContent = "Re-request";
			btn.addEventListener("click", () => rerequestPurchaseRequest(saleId));
			td.appendChild(btn);
		} else {
			td.className = "saleIsNotActive";
			td.textContent = "Sale no longer active";
		}
		return;
	}

	td.textContent = "—";
}

// ─── Transactions ─────────────────────────────────────────────────────────────

async function makePayment(saleId, priceOffered) {
	alertUser("", "alert-info", "none");

	const { contract } = getTransferContract();
	const address = getSessionAddress();
	const priceInWei = web3.utils.toWei(String(priceOffered));

	console.log("saleId:", saleId, "priceOffered:", priceInWei);

	try {
		showTransactionLoading("Payment in progress...");

		await contract.methods
			.transferOwnerShip(saleId)
			.send({ from: address, value: priceInWei });

		closeTransactionLoading();
		alertUser("Property transferred successfully.", "alert-success", "block");
		fetchMyRequestedSales();
	} catch (error) {
		console.error("Payment failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

async function cancelPurchaseRequestSentToSeller(saleId) {
	alertUser("", "alert-info", "none");

	const { contract } = getTransferContract();
	const address = getSessionAddress();

	try {
		showTransactionLoading("Canceling purchase request...");

		await contract.methods
			.cancelPurchaseRequestSentToSeller(saleId)
			.send({ from: address });

		closeTransactionLoading();
		alertUser(
			"Purchase request canceled successfully.",
			"alert-success",
			"block",
		);
		fetchMyRequestedSales();
	} catch (error) {
		console.error("Cancel request failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

async function rerequestPurchaseRequest(saleId) {
	alertUser("", "alert-info", "none");

	const { contract } = getTransferContract();
	const address = getSessionAddress();

	const price = await showPrompt();
	if (price === null || price === "") {
		alertUser("Please enter a price.", "alert-warning", "block");
		return;
	}

	try {
		showTransactionLoading("Re-requesting purchase...");

		await contract.methods
			.rerequestPurchaseRequest(saleId, price)
			.send({ from: address });

		closeTransactionLoading();
		alertUser("Re-request sent successfully.", "alert-success", "block");
		fetchMyRequestedSales();
	} catch (error) {
		console.error("Re-request failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

async function rejectingAcceptanceRequestByBuyer(saleId) {
	alertUser("", "alert-info", "none");

	const { contract } = getTransferContract();
	const address = getSessionAddress();

	try {
		showTransactionLoading("Canceling acceptance...");

		await contract.methods
			.rejectingAcceptanceRequestByBuyer(saleId)
			.send({ from: address });

		closeTransactionLoading();
		alertUser(
			"Acceptance request canceled successfully.",
			"alert-success",
			"block",
		);
		fetchMyRequestedSales();
	} catch (error) {
		console.error("Reject acceptance failed:", error);
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

	// FIX: clone buttons to strip previously attached listeners —
	// original stacked a new listener on every call causing duplicate transactions
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
