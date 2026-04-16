// ─── Wallet Connection & Auto-routing ────────────────────────────────────────

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
		showTransactionLoading("Connecting to wallet…");

		// Always show account picker so user can choose which wallet to use
		await window.ethereum.request({
			method: "wallet_requestPermissions",
			params: [{ eth_accounts: {} }],
		});

		const accounts = await web3.eth.getAccounts();
		if (!accounts || accounts.length === 0) {
			throw new Error("No accounts returned from MetaMask.");
		}

		const address = accounts[0];
		showTransactionLoading("Checking registration…");

		// Check if this wallet is already registered on-chain
		const abi =
			window._contracts?.Users?.abi ??
			JSON.parse(window.localStorage.Users_ContractABI);
		const contAddr =
			window._contracts?.Users?.address ??
			window.localStorage.Users_ContractAddress;
		const contract = new window.web3.eth.Contract(abi, contAddr);
		const user = await contract.methods.users(address).call();

		closeTransactionLoading();

		// Store address for use across pages
		window.localStorage.setItem("userAddress", address);

		if (user.userID === address) {
			// Already registered — go straight to dashboard
			window.location.href = "/dashboard";
		} else {
			// Not registered — go to registration page
			window.location.href = "/register";
		}
	} catch (error) {
		console.error("Connection failed:", error);
		closeTransactionLoading();
		alertUser(showError(error), "alert-danger", "block");
	}
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
