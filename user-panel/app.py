import os
import json
from pathlib import Path

from flask import Flask, jsonify, render_template, request, Response, redirect
from pymongo import MongoClient, errors
import gridfs

# ─── Configuration ────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
CONTRACTS_DIR = BASE_DIR / ".." / "smart-contracts" / "build" / "contracts"

# FIX: was hardcoded "5337" — read from environment or fall back to 5777
# (Ganache default). Set NETWORK_CHAIN_ID in your environment when deploying.
NETWORK_CHAIN_ID = os.environ.get("NETWORK_CHAIN_ID", "5777")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")

# ─── MongoDB ──────────────────────────────────────────────────────────────────

client = MongoClient(MONGO_URL)
LandRegistryDB = client.LandRegistry
fs = gridfs.GridFS(LandRegistryDB)
propertyDocsTable = LandRegistryDB.Property_Docs

# ─── Flask App ────────────────────────────────────────────────────────────────

app = Flask(
    __name__,
    static_url_path="",
    static_folder="web/static",
    template_folder="web/templates",
)

# ─── Helpers ──────────────────────────────────────────────────────────────────


def load_contract(name):
    """Load a compiled Truffle contract JSON and return its ABI and address."""
    path = CONTRACTS_DIR / f"{name}.json"
    with open(path) as f:
        data = json.load(f)
    try:
        address = data["networks"][NETWORK_CHAIN_ID]["address"]
    except KeyError:
        raise RuntimeError(
            f'Contract "{name}" has no deployment on network {NETWORK_CHAIN_ID}. '
            f"Run `truffle migrate --reset` and check your NETWORK_CHAIN_ID."
        )
    return {"address": address, "abi": data["abi"]}


# ─── Routes ───────────────────────────────────────────────────────────────────


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/register")
def register():
    return render_template("register.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", add_property=True)


@app.route("/availableToBuy")
def available_to_buy():
    return render_template("availableToBuy.html")


@app.route("/MySales")
def my_sales():
    return render_template("mySales.html")


@app.route("/myRequestedSales")
def my_requested_sales():
    return render_template("myRequestedSales.html")


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/contact")
def contact():
    return render_template("contact.html")


@app.route("/logout")
def logout():
    return redirect("/")


# ─── Contract Details ─────────────────────────────────────────────────────────


@app.route("/fetchContractDetails")
def fetch_contract_details():
    try:
        return jsonify(
            {
                "Users": load_contract("Users"),
                "LandRegistry": load_contract("LandRegistry"),
                "TransferOwnership": load_contract("TransferOwnerShip"),
            }
        )
    except (FileNotFoundError, RuntimeError) as e:
        return jsonify({"status": 0, "error": str(e)}), 500


# ─── Property Documents ───────────────────────────────────────────────────────


@app.route("/uploadPropertyDocs", methods=["POST"])
def upload():
    registration_docs = request.files.get("propertyDocs")
    owner = request.form.get("owner")
    property_id = request.form.get("propertyId")

    # Validate all required fields are present
    if not registration_docs or not owner or not property_id:
        return jsonify({"status": "error", "reason": "Missing required fields"}), 400

    filename = f"{owner}_{property_id}.pdf"

    try:
        file_id = fs.put(registration_docs, filename=filename)
        propertyDocsTable.insert_one(
            {
                "Owner": owner,
                "Property_Id": property_id,
                filename: file_id,
            }
        )
    except errors.PyMongoError as e:
        return jsonify({"status": "error", "reason": str(e)}), 500

    return jsonify({"status": "success", "fileId": str(file_id)})


@app.route("/propertiesDocs/pdf/<property_id>")
def get_pdf(property_id):
    try:
        results = list(propertyDocsTable.find({"Property_Id": str(property_id)}))
        if not results:
            return jsonify({"status": 0, "reason": "No property matched that ID"}), 404

        property_details = results[0]
        filename = f"{property_details['Owner']}_{property_details['Property_Id']}.pdf"

        if filename not in property_details:
            return jsonify({"status": 0, "reason": "Document reference missing"}), 404

        file = fs.get(property_details[filename])
        response = Response(file.read(), content_type="application/pdf")
        response.headers["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    except Exception as e:
        return jsonify({"status": 0, "reason": str(e)}), 500


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
