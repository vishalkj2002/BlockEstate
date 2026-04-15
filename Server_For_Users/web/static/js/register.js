// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSessionAddress() {
	return window._session?.userAddress ?? window.localStorage["userAddress"];
}

function getUsersContract() {
	const abi =
		window._contracts?.Users?.abi ??
		JSON.parse(window.localStorage.Users_ContractABI);
	const address =
		window._contracts?.Users?.address ??
		window.localStorage.Users_ContractAddress;
	return { contract: new window.web3.eth.Contract(abi, address), address };
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

		if (!sessionAddress) {
			// No session — send back to login
			window.location.href = "/";
			return;
		}

		if (connectedAccount !== sessionAddress) {
			alert(
				"Wrong account connected. Please connect the same wallet you used to log in.",
			);
			window.location.href = "/";
			return;
		}

		// Show truncated connected address as confirmation
		const short = `${connectedAccount.slice(0, 6)}...${connectedAccount.slice(-4)}`;
		alertUser(`Wallet connected: ${short}`, "alert-success", "block");
	} catch (error) {
		console.error("Connection check failed:", error);
		alert("Something went wrong. Please try again.");
	}
}

// ─── Register User ────────────────────────────────────────────────────────────

async function registerUser(event) {
	event.preventDefault();
	alertUser("", "alert-info", "none");

	const fname = document.getElementById("firstName").value.trim();
	const lname = document.getElementById("lastName").value.trim();
	const dob = document.getElementById("dob").value;
	const aadharNo = document.getElementById("aadharNo").value.trim();

	if (!fname || !lname || !dob || !aadharNo) {
		alertUser("Please fill in all fields.", "alert-warning", "block");
		return;
	}

	const sessionAddress = getSessionAddress();
	const { contract } = getUsersContract();

	try {
		// Re-verify connected account hasn't changed
		const accounts = await web3.eth.getAccounts();
		const connectedAccount = accounts[0];

		if (connectedAccount !== sessionAddress) {
			const short = `${sessionAddress.slice(0, 6)}...${sessionAddress.slice(-4)}`;
			alertUser(
				`Account mismatch — please connect "${short}" in MetaMask.`,
				"alert-warning",
				"block",
			);
			return;
		}

		showTransactionLoading("Registering on blockchain…");

		await contract.methods
			.registerUser(fname, lname, dob, aadharNo)
			.send({ from: sessionAddress });

		// Verify registration succeeded on-chain
		const userDetails = await contract.methods.users(sessionAddress).call();

		if (userDetails.userID === sessionAddress) {
			showTransactionLoading("Registered successfully — redirecting…");
			// No password needed — wallet address is identity
			window.location.href = "/dashboard";
		} else {
			closeTransactionLoading();
			alertUser(
				"Registration failed. Please try again.",
				"alert-danger",
				"block",
			);
		}
	} catch (error) {
		console.error("Registration failed:", error);
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
		if (start === -1) throw new Error("No JSON in error message");
		const parsed = JSON.parse(error.message.slice(start));
		const data = parsed.value.data.data;
		const txHash = Object.getOwnPropertyNames(data)[0];
		return data[txHash].reason;
	} catch {
		return error.message || "An unknown error occurred.";
	}
}
