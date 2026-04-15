from web3 import Web3
import os
import json

def mapRevenueDeptIdToEmployee(revenueDeptId, employeeId):
    with open("config.json","r") as f:
        config = json.load(f)

    web3 = Web3(Web3.HTTPProvider(config["Ganache_Url"]))

    # ✅ v5 syntax
    web3.eth.default_account = web3.toChecksumAddress(
        config["Address_Used_To_Deploy_Contract"]
    )

    NETWORK_CHAIN_ID = str(config["NETWORK_CHAIN_ID"])

    landRegistryContract = json.loads(
        open(
            os.getcwd() +
            "/../Smart_contracts/build/contracts/LandRegistry.json"
        ).read()
    )

    contract = web3.eth.contract(
        abi=landRegistryContract["abi"],
        address=web3.toChecksumAddress(
            landRegistryContract["networks"][NETWORK_CHAIN_ID]["address"]
        )
    )

    # ✅ v5 syntax
    employee_address = web3.toChecksumAddress(employeeId)

    txn_hash = contract.functions.mapRevenueDeptIdToEmployee(
        int(revenueDeptId),
        employee_address
    ).transact({
        'from': web3.eth.default_account
    })

    receipt = web3.eth.waitForTransactionReceipt(txn_hash)

    return receipt["status"] == 1
