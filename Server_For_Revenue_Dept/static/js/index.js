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
		showTransactionLoading("Connecting to wallet…");

		// Always force the account picker so the user can select which wallet to use
		await window.ethereum.request({
			method: "wallet_requestPermissions",
			params: [{ eth_accounts: {} }],
		});

		const accounts = await web3.eth.getAccounts();

		if (!accounts || accounts.length === 0) {
			throw new Error("No accounts returned from MetaMask.");
		}

		window._employeeId = accounts[0];

		closeTransactionLoading();
		alertUser("Enter your password.", "alert-success", "block");

		document.getElementById("connectToBlockchainDiv").style.display = "none";
		document.getElementById("passwordDiv").style.display = "block";

		// Activate step 2 pill in the stepper UI
		const step2 = document.getElementById("step2");
		if (step2) {
			step2.classList.replace("step-pill--inactive", "step-pill--active");
		}
	} catch (error) {
		console.error("Wallet connection failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
}

// ─── Login ────────────────────────────────────────────────────────────────────

function login() {
	const employeeId = window._employeeId;
	const password = document.getElementById("password").value;

	if (!employeeId) {
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
	formData.append("employeeId", employeeId);
	formData.append("password", password);

	fetch("/login", { method: "POST", body: formData })
		.then((res) => res.json())
		.then((data) => {
			const { status, msg, revenueDepartmentId, empName } = data;
			if (status == 1) {
				window._session = { employeeId, revenueDepartmentId, empName };
				window.localStorage.setItem("revenueDepartmentId", revenueDepartmentId);
				window.localStorage.setItem("empName", empName);
				window.location.href = "/dashboard";
			} else {
				alertUser(msg, "alert-danger", "block");
			}
		})
		.catch((error) => {
			console.error("Login request failed:", error);
			alertUser("Login failed. Please try again.", "alert-danger", "block");
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
		if (start === -1) throw new Error("No JSON found in error message");
		const parsed = JSON.parse(error.message.slice(start));
		const data = parsed.value.data.data;
		const txHash = Object.getOwnPropertyNames(data)[0];
		return data[txHash].reason;
	} catch {
		return error.message || "An unknown error occurred.";
	}
}
