// ─── Wallet Connection ────────────────────────────────────────────────────────

async function connectToBlockchain() {
	if (!window.ethereum) {
		alertUser(
			"Please add the MetaMask extension to your browser.",
			"alert-danger",
			"block",
		);
		return;
	}

	try {
		window.web3 = new Web3(window.ethereum);
		alertUser("", "alert-info", "none");
		showTransactionLoading("Connecting to Wallet...");

		// FIX: always force the account picker on the admin page
		// so the user can explicitly select the admin wallet
		await window.ethereum.request({
			method: "wallet_requestPermissions",
			params: [{ eth_accounts: {} }],
		});

		const accounts = await web3.eth.getAccounts();

		if (!accounts || accounts.length === 0) {
			throw new Error("No accounts returned from MetaMask.");
		}

		window._adminAddress = accounts[0];
		window.employeeId = accounts[0];

		document.getElementById("connectToBlockchainDiv").style.display = "none";
		document.getElementById("passwordDiv").style.display = "block";

		closeTransactionLoading();
		alertUser("Enter Your Password", "alert-success", "block");
	} catch (error) {
		console.error(error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

// ─── Login ────────────────────────────────────────────────────────────────────

function login() {
	const adminAddress = window._adminAddress;
	const password = document.getElementById("password").value;

	if (!adminAddress) {
		alertUser(
			"Wallet not connected. Please connect first.",
			"alert-danger",
			"block",
		);
		return;
	}
	if (!password) {
		alertUser("Please enter your password.", "alert-danger", "block");
		return;
	}

	const formData = new FormData();
	formData.append("adminAddress", adminAddress);
	formData.append("password", password);

	fetch("/adminLogin", { method: "POST", body: formData })
		.then((response) => response.json())
		.then((data) => {
			const { status, msg } = data;
			if (status == 1) {
				alertUser("", "alert-info", "none");
				document.getElementById("passwordDiv").style.display = "none";
				document.getElementById("dashboardDiv").style.display = "block";
			} else {
				alertUser(msg, "alert-danger", "block");
			}
		})
		.catch((error) => {
			console.error(error);
			alertUser(
				"Login request failed. Please try again.",
				"alert-danger",
				"block",
			);
		});
}

// ─── Add Employee ─────────────────────────────────────────────────────────────

function addEmployee(event) {
	event.preventDefault();
	showTransactionLoading("Adding Employee...");

	const form = document.getElementById("addEmployeeForm");
	const empAddress = form.querySelector('[name="empAddress"]').value;
	const password = form.querySelector('[name="password"]').value;
	const fname = form.querySelector('[name="fname"]').value;
	const lname = form.querySelector('[name="lname"]').value;
	const revenueDeptId = form.querySelector('[name="revenueDeptId"]').value;

	const formData = new FormData();
	formData.append("empAddress", empAddress);
	formData.append("password", password);
	formData.append("fname", fname);
	formData.append("lname", lname);
	formData.append("revenueDeptId", revenueDeptId);

	fetch("/addEmployee", { method: "POST", body: formData })
		.then((response) => response.json())
		.then((data) => {
			const { status, msg } = data;
			closeTransactionLoading();
			if (status == 1) {
				alertUser(msg, "alert-success", "block");
				document.getElementById("addEmployeeForm").reset();
			} else {
				alertUser(msg, "alert-danger", "block");
			}
		})
		.catch((error) => {
			console.error(error);
			closeTransactionLoading();
			alertUser("Request failed. Please try again.", "alert-danger", "block");
		});
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

// FIX: never cache DOM elements at the top level when scripts are in <head>
// — the DOM doesn't exist yet at parse time. Always look them up at call time,
// or defer caching inside DOMContentLoaded.

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
		const errorObj = JSON.parse(error.message.slice(start));
		const data = errorObj.value.data.data;
		const txHash = Object.getOwnPropertyNames(data)[0];
		return data[txHash].reason;
	} catch {
		return error.message || "An unknown error occurred.";
	}
}
