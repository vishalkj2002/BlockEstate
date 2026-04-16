// ─── Constants ────────────────────────────────────────────────────────────────

const SALE_STATES = {
	ACTIVE: 0,
	ACCEPTED: 1,
	CLOSED: 2,
	SUCCESS: 3,
	DEADLINE_OVER: 4,
	CANCELED_ACCEPTANCE_BY_SELLER: 5,
	BUYER_REJECTED_ACCEPTANCE: 6,
};

const PURCHASE_REQUEST_STATES = {
	SENT: 0,
	BUYER_CANCELED: 1,
	ACCEPTED: 2,
	REJECTED: 3,
	SELLER_CANCELED_ACCEPTANCE: 4,
	BUYER_REJECTED_ACCEPTANCE: 5,
	RE_REQUESTED: 6,
};

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

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

function getUsersContract() {
	const abi =
		window._contracts?.Users?.abi ??
		JSON.parse(window.localStorage.Users_ContractABI);
	const address =
		window._contracts?.Users?.address ??
		window.localStorage.Users_ContractAddress;
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

		await Promise.all([fetchUserDetails(), fetchMyPropertiesAvailableToSell()]);
	} catch (error) {
		console.error("Connection check failed:", error);
		alert("Something went wrong while connecting. Please try again.");
	}
}

// ─── User Details ─────────────────────────────────────────────────────────────

async function fetchUserDetails() {
	const contract = getUsersContract();
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

// ─── Fetch & Render My Sales ──────────────────────────────────────────────────

async function fetchMyPropertiesAvailableToSell() {
	const { contract } = getTransferContract();
	const usersContract = getUsersContract();
	const sessionAddress = getSessionAddress();

	try {
		const mySales = await contract.methods.getMySales(sessionAddress).call();
		console.log("My sales:", mySales);

		// Resolve acceptedFor names in parallel — only for non-null addresses
		const acceptedForNames = await Promise.all(
			mySales.map((sale) =>
				sale.acceptedFor === NULL_ADDRESS
					? Promise.resolve(null)
					: usersContract.methods
							.users(sale.acceptedFor)
							.call()
							.then((u) => u.firstName),
			),
		);

		renderSalesTable(mySales, acceptedForNames);
	} catch (error) {
		console.error("Failed to fetch sales:", error);
		alertUser("Failed to load your sales.", "alert-danger", "block");
	}
}

function renderSalesTable(sales, acceptedForNames) {
	const tableBody = document.getElementById("salesTableBody");

	if (!sales.length) {
		tableBody.innerHTML = `<tr><td colspan="8">You have no active sales.</td></tr>`;
		return;
	}

	const fragment = document.createDocumentFragment();

	sales.forEach((sale, i) => {
		const saleState = Number(sale.state);
		const tr = document.createElement("tr");

		// Data cells
		for (const value of [
			"",
			sale.saleId,
			sale.propertyId,
			web3.utils.fromWei(sale.price),
		]) {
			const td = document.createElement("td");
			td.textContent = value;
			tr.appendChild(td);
		}

		// Accepted-for cell
		const acceptedTd = document.createElement("td");
		if (acceptedForNames[i] === null) {
			acceptedTd.className = "acceptedForNoONe";
			acceptedTd.textContent = "No one";
		} else {
			acceptedTd.textContent = acceptedForNames[i];
		}
		tr.appendChild(acceptedTd);

		// State cell
		const stateTd = document.createElement("td");
		appendSaleStateCell(stateTd, saleState);
		tr.appendChild(stateTd);

		// Action cells
		appendSaleActionCells(tr, sale, saleState);

		fragment.appendChild(tr);
	});

	tableBody.replaceChildren(fragment);
}

// ─── Sale State Cell ──────────────────────────────────────────────────────────

function appendSaleStateCell(td, saleState) {
	const stateMap = {
		[SALE_STATES.ACTIVE]: { cls: "saleStateActive", label: "Active" },
		[SALE_STATES.ACCEPTED]: { cls: "saleStateAccepted", label: "Accepted" },
		[SALE_STATES.CLOSED]: { cls: "saleStateClosed", label: "Closed" },
		[SALE_STATES.SUCCESS]: { cls: "saleStateSuccess", label: "Success" },
		[SALE_STATES.DEADLINE_OVER]: {
			cls: "saleStateDeadlineOverForPayment",
			label: "Deadline over for payment",
		},
		[SALE_STATES.CANCELED_ACCEPTANCE_BY_SELLER]: {
			cls: "saleStateCanceledAcceptanceRequestGiven",
			label: "Acceptance request canceled",
		},
		[SALE_STATES.BUYER_REJECTED_ACCEPTANCE]: {
			cls: "saleStateBuyerRejectedAcceptanceRequest",
			label: "Buyer rejected acceptance",
		},
	};

	const entry = stateMap[saleState];
	if (entry) {
		td.className = entry.cls;
		td.textContent = entry.label;
	} else {
		td.textContent = "Unknown";
	}
}

// ─── Sale Action Cells ────────────────────────────────────────────────────────

function appendSaleActionCells(tr, sale, saleState) {
	const saleId = sale.saleId;

	// Closed / success — no actions
	if (saleState === SALE_STATES.CLOSED || saleState === SALE_STATES.SUCCESS) {
		tr.appendChild(emptyTd());
		tr.appendChild(emptyTd());
		return;
	}

	if (saleState === SALE_STATES.ACTIVE) {
		// Buyers button
		const buyersTd = document.createElement("td");
		const buyersBtn = document.createElement("button");
		buyersBtn.className = "buyersButton";
		buyersBtn.textContent = "Buyers";
		buyersBtn.addEventListener("click", () =>
			fetchRequestedUsersToBuy(saleId, sale.propertyId),
		);
		buyersTd.appendChild(buyersBtn);
		tr.appendChild(buyersTd);

		// Cancel button
		const cancelTd = document.createElement("td");
		const cancelBtn = document.createElement("button");
		cancelBtn.className = "cancelSaleButton";
		cancelBtn.textContent = "Cancel";
		cancelBtn.addEventListener("click", () => cancelSale(saleId));
		cancelTd.appendChild(cancelBtn);
		tr.appendChild(cancelTd);
		return;
	}

	if (saleState === SALE_STATES.ACCEPTED) {
		const td = document.createElement("td");
		const btn = document.createElement("button");
		btn.className = "cancelAcceptanceRequestButton";
		btn.textContent = "Cancel acceptance";
		btn.addEventListener("click", () =>
			rejectingAcceptanceRequestBySeller(saleId),
		);
		td.appendChild(btn);
		tr.appendChild(td);
		tr.appendChild(emptyTd());
		return;
	}

	// Reactivatable states
	const reactivatableStates = [
		SALE_STATES.DEADLINE_OVER,
		SALE_STATES.CANCELED_ACCEPTANCE_BY_SELLER,
		SALE_STATES.BUYER_REJECTED_ACCEPTANCE,
	];

	if (reactivatableStates.includes(saleState)) {
		const reactivateTd = document.createElement("td");
		const reactivateBtn = document.createElement("button");
		reactivateBtn.className = "reactivateSale";
		reactivateBtn.textContent = "Reactivate";
		reactivateBtn.addEventListener("click", () => reactivateSale(saleId));
		reactivateTd.appendChild(reactivateBtn);
		tr.appendChild(reactivateTd);

		const cancelTd = document.createElement("td");
		const cancelBtn = document.createElement("button");
		cancelBtn.className = "cancelSaleButton";
		cancelBtn.textContent = "Cancel";
		cancelBtn.addEventListener("click", () => cancelSale(saleId));
		cancelTd.appendChild(cancelBtn);
		tr.appendChild(cancelTd);
		return;
	}

	tr.appendChild(emptyTd());
	tr.appendChild(emptyTd());
}

function emptyTd() {
	const td = document.createElement("td");
	td.textContent = "—";
	return td;
}

// ─── Fetch & Render Requested Buyers ─────────────────────────────────────────

async function fetchRequestedUsersToBuy(saleId, propertyId) {
	alertUser("", "alert-info", "none");
	toggleSalesAndRequestedUsersTables();

	const { contract } = getTransferContract();
	const usersContract = getUsersContract();

	try {
		const requestedUsers = await contract.methods
			.getRequestedUsers(saleId)
			.call();
		console.log("Requested users:", requestedUsers);

		document.getElementById("propertyId").textContent = propertyId;

		// Fetch all buyer names in parallel
		const buyerDetails = await Promise.all(
			requestedUsers.map((r) => usersContract.methods.users(r.user).call()),
		);

		renderRequestedUsersTable(saleId, requestedUsers, buyerDetails);
	} catch (error) {
		console.error("Failed to fetch requested users:", error);
		alertUser("Failed to load buyer requests.", "alert-danger", "block");
	}
}

function renderRequestedUsersTable(saleId, requestedUsers, buyerDetails) {
	const tableBody = document.getElementById("requestedUsersOfaSaleTableBody");

	if (!requestedUsers.length) {
		tableBody.innerHTML = `<tr><td colspan="4">No purchase requests for this sale.</td></tr>`;
		return;
	}

	const fragment = document.createDocumentFragment();

	requestedUsers.forEach((request, i) => {
		const state = Number(request.state);
		const price = web3.utils.fromWei(request.priceOffered);
		const buyer = request.user;
		const name = buyerDetails[i].firstName;
		const tr = document.createElement("tr");

		for (const value of ["", name, price]) {
			const td = document.createElement("td");
			td.textContent = value;
			tr.appendChild(td);
		}

		const actionTd = document.createElement("td");
		appendBuyerActionCell(actionTd, state, saleId, buyer, price);
		tr.appendChild(actionTd);

		fragment.appendChild(tr);
	});

	tableBody.replaceChildren(fragment);
}

// ─── Buyer Action Cell ────────────────────────────────────────────────────────

function appendBuyerActionCell(td, state, saleId, buyer, price) {
	const canActStates = [
		PURCHASE_REQUEST_STATES.SENT,
		PURCHASE_REQUEST_STATES.SELLER_CANCELED_ACCEPTANCE,
		PURCHASE_REQUEST_STATES.RE_REQUESTED,
	];

	if (canActStates.includes(state)) {
		const label = state === PURCHASE_REQUEST_STATES.SENT ? "" : "Again — ";

		const acceptBtn = document.createElement("button");
		acceptBtn.className = "acceptButton";
		acceptBtn.textContent = `${label}Accept`;
		acceptBtn.addEventListener("click", () =>
			acceptPurchaseRequest(saleId, buyer, price),
		);

		const rejectBtn = document.createElement("button");
		rejectBtn.className = "rejectButton";
		rejectBtn.textContent = `${label}Reject`;
		rejectBtn.addEventListener("click", () =>
			rejectPurchaseRequest(saleId, buyer),
		);

		td.appendChild(acceptBtn);
		td.appendChild(rejectBtn);
		return;
	}

	const labelMap = {
		[PURCHASE_REQUEST_STATES.BUYER_CANCELED]: {
			cls: "buyerCanceledPurchaseRequest",
			label: "Buyer canceled request",
		},
		[PURCHASE_REQUEST_STATES.ACCEPTED]: {
			cls: "acceptedPurchaseRequest",
			label: "Accepted",
		},
		[PURCHASE_REQUEST_STATES.REJECTED]: {
			cls: "canceledPurchaseRequest",
			label: "Rejected",
		},
		[PURCHASE_REQUEST_STATES.BUYER_REJECTED_ACCEPTANCE]: {
			cls: "buyerRejectedAcceptanceRequest",
			label: "Buyer rejected acceptance",
		},
	};

	const entry = labelMap[state];
	if (entry) {
		td.className = entry.cls;
		td.textContent = entry.label;
	} else {
		td.textContent = "Unknown";
	}
}

// ─── Transactions ─────────────────────────────────────────────────────────────

async function acceptPurchaseRequest(saleId, buyer, priceOffered) {
	alertUser("", "alert-info", "none");

	const { contract } = getTransferContract();
	const address = getSessionAddress();

	try {
		showTransactionLoading("Accepting buyer request...");

		const tx = await contract.methods
			.acceptBuyerRequest(saleId, buyer, priceOffered)
			.send({ from: address });

		console.log("Sale accepted:", tx.events.SaleAccepted.returnValues);

		closeTransactionLoading();
		toggleSalesAndRequestedUsersTables();
		alertUser("Buyer request accepted successfully.", "alert-success", "block");
		fetchMyPropertiesAvailableToSell();
	} catch (error) {
		console.error("Accept request failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

async function rejectPurchaseRequest(saleId, buyer) {
	alertUser("", "alert-info", "none");

	const { contract } = getTransferContract();
	const address = getSessionAddress();

	try {
		showTransactionLoading("Rejecting buyer request...");

		await contract.methods
			.rejectPurchaseRequestOfBuyer(saleId, buyer)
			.send({ from: address });

		closeTransactionLoading();
		alertUser("Buyer request rejected.", "alert-success", "block");

		const propertyId = document.getElementById("propertyId").textContent;
		fetchRequestedUsersToBuy(saleId, propertyId);
	} catch (error) {
		console.error("Reject request failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

async function cancelSale(saleId) {
	alertUser("", "alert-info", "none");

	const { contract } = getTransferContract();
	const address = getSessionAddress();

	try {
		showTransactionLoading("Canceling sale...");

		await contract.methods.cancelSaleBySeller(saleId).send({ from: address });

		closeTransactionLoading();
		alertUser("Sale canceled successfully.", "alert-success", "block");
		fetchMyPropertiesAvailableToSell();
	} catch (error) {
		console.error("Cancel sale failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

async function rejectingAcceptanceRequestBySeller(saleId) {
	alertUser("", "alert-info", "none");

	const { contract } = getTransferContract();
	const address = getSessionAddress();

	try {
		showTransactionLoading("Canceling acceptance request...");

		await contract.methods
			.rejectingAcceptanceRequestBySeller(saleId)
			.send({ from: address });

		closeTransactionLoading();
		alertUser("Acceptance request canceled.", "alert-success", "block");
		fetchMyPropertiesAvailableToSell();
	} catch (error) {
		console.error("Cancel acceptance failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

async function reactivateSale(saleId) {
	alertUser("", "alert-info", "none");

	const { contract } = getTransferContract();
	const address = getSessionAddress();

	try {
		showTransactionLoading("Reactivating sale...");

		await contract.methods.reactivateSale(saleId).send({ from: address });

		closeTransactionLoading();
		alertUser("Sale reactivated successfully.", "alert-success", "block");
		fetchMyPropertiesAvailableToSell();
	} catch (error) {
		console.error("Reactivate sale failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

// ─── Toggle Tables ────────────────────────────────────────────────────────────

function toggleSalesAndRequestedUsersTables() {
	alertUser("", "alert-info", "none");

	const salesTable = document.getElementById("salesTable");
	const requestedUsersTable = document.getElementById("requestedUsersOfaSale");
	const isShowingSales = salesTable.style.display !== "none";

	salesTable.style.display = isShowingSales ? "none" : "block";
	requestedUsersTable.style.display = isShowingSales ? "block" : "none";
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
