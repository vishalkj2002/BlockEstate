// ─── Estimate Gas for transferOwnerShip ──────────────────────────────────────
// Usage: call estimateTransferGas(saleId, priceInEther) from the browser console
// or wire it up to a UI button.

async function estimateTransferGas(saleId, priceInEther) {
	const address =
		window._session?.userAddress ?? window.localStorage["userAddress"];

	// Read contract from in-memory store, fall back to localStorage
	const abi =
		window._contracts?.TransferOwnership?.abi ??
		JSON.parse(window.localStorage.TransferOwnership_ContractABI);
	const contractAddress =
		window._contracts?.TransferOwnership?.address ??
		window.localStorage.TransferOwnership_ContractAddress;

	const contract = new window.web3.eth.Contract(abi, contractAddress);

	const txData = contract.methods.transferOwnerShip(saleId).encodeABI();
	const priceInWei = web3.utils.toWei(String(priceInEther));

	try {
		const gas = await web3.eth.estimateGas({
			from: address,
			to: contractAddress,
			data: txData,
			value: priceInWei,
		});

		// Add a 20% buffer — estimateGas returns the minimum; real execution
		// often uses slightly more due to state changes between estimate and send
		const gasWithBuffer = Math.ceil(Number(gas) * 1.2);

		console.log(`Estimated gas : ${gas}`);
		console.log(`With 20% buffer: ${gasWithBuffer}`);

		return gasWithBuffer;
	} catch (error) {
		console.error("Gas estimation failed:", error.message ?? error);
		throw error;
	}
}
