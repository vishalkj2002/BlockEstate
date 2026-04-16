import os
import json
from pathlib import Path

from flask import Flask, jsonify, render_template, request, Response, redirect, session
from pymongo import MongoClient, errors
import gridfs
from werkzeug.security import generate_password_hash, check_password_hash

from utility.mapRevenueDeptToEmployee import mapRevenueDeptIdToEmployee

# ─── Configuration ────────────────────────────────────────────────────────────

CONFIG_PATH = Path(__file__).parent / "config.json"

with open(CONFIG_PATH) as f:
    config = json.load(f)

ADMIN_ADDRESS = config["Address_Used_To_Deploy_Contract"]
ADMIN_PASSWORD = config["Admin_Password"]
NETWORK_CHAIN_ID = str(config["NETWORK_CHAIN_ID"])
CONTRACTS_DIR = Path(__file__).parent / ".." / "smart-contracts" / "build" / "contracts"

# ─── MongoDB ──────────────────────────────────────────────────────────────────

client = MongoClient(config["Mongo_Db_Url"])
LandRegistryDB = client.LandRegistry
fs = gridfs.GridFS(LandRegistryDB)
propertyDocsTable = LandRegistryDB.Property_Docs
employeesTable = client.Revenue_Dept.Employees

# ─── Flask App ────────────────────────────────────────────────────────────────

app = Flask(__name__)
app.secret_key = config["Secret_Key"]

# ─── Helpers ──────────────────────────────────────────────────────────────────


def load_contract(name):
    """Load a compiled Truffle contract and return its ABI and network address."""
    path = CONTRACTS_DIR / f"{name}.json"
    with open(path) as f:
        data = json.load(f)
    try:
        address = data["networks"][NETWORK_CHAIN_ID]["address"]
    except KeyError:
        raise RuntimeError(
            f'Contract "{name}" not deployed on network {NETWORK_CHAIN_ID}. '
            f"Run `truffle migrate --reset` and verify NETWORK_CHAIN_ID in config.json."
        )
    return {"address": address, "abi": data["abi"]}


def require_login():
    """Return a 401 JSON response if the session has no logged-in user."""
    if "user_id" not in session:
        return jsonify({"status": 0, "msg": "Login required"}), 401
    return None


# ─── Routes ───────────────────────────────────────────────────────────────────


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/admin")
def admin_index():
    return render_template("admin.html")


@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect("/")
    return render_template("dashboard.html")


@app.route("/logout")
def logout():
    session.pop("user_id", None)
    return redirect("/")


# ─── Employee Login ───────────────────────────────────────────────────────────


@app.route("/login", methods=["POST"])
def login():
    employeeId = request.form.get("employeeId", "").strip()
    password = request.form.get("password", "")

    if not employeeId or not password:
        return jsonify({"status": 0, "msg": "Missing credentials"}), 400

    # FIX: normalize address to lowercase for consistent matching
    user = employeesTable.find_one(
        {"employeeId": {"$regex": f"^{employeeId}$", "$options": "i"}}
    )

    if user and check_password_hash(user["password"], password):
        session["user_id"] = str(user["_id"])
        return jsonify(
            {
                "status": 1,
                "msg": "Login successful",
                "revenueDepartmentId": user["revenueDeptId"],
                "empName": user["fname"],
            }
        )

    return jsonify({"status": 0, "msg": "Invalid wallet address or password"})


# ─── Admin Login ──────────────────────────────────────────────────────────────


@app.route("/adminLogin", methods=["POST"])
def admin_login():
    address = request.form.get("adminAddress", "").lower().strip()
    password = request.form.get("password", "")

    if not address or not password:
        return jsonify({"status": 0, "msg": "Missing credentials"}), 400

    admin = employeesTable.find_one(
        {"adminAddress": {"$regex": f"^{address}$", "$options": "i"}}
    )

    if admin is None:
        return jsonify({"status": 0, "msg": "No admin record found for this address"})

    if check_password_hash(admin["password"], password):
        session["user_id"] = str(admin["_id"])
        return jsonify({"status": 1, "msg": "Admin login successful"})

    return jsonify({"status": 0, "msg": "Incorrect password"})


# ─── Add Employee ─────────────────────────────────────────────────────────────


@app.route("/addEmployee", methods=["POST"])
def add_employee():
    auth_error = require_login()
    if auth_error:
        return auth_error

    employee_id = request.form.get("empAddress", "").strip()
    password = request.form.get("password", "")
    fname = request.form.get("fname", "").strip()
    lname = request.form.get("lname", "").strip()
    revenue_dept_id = request.form.get("revenueDeptId", "").strip()

    if not all([employee_id, password, fname, lname, revenue_dept_id]):
        return jsonify({"status": 0, "msg": "All fields are required"}), 400

    emp = {
        "employeeId": employee_id,
        "password": generate_password_hash(password),
        "fname": fname,
        "lname": lname,
        "revenueDeptId": revenue_dept_id,
    }

    try:
        employeesTable.insert_one(emp)

        if mapRevenueDeptIdToEmployee(revenue_dept_id, employee_id):
            return jsonify(
                {"status": 1, "msg": f"Employee '{fname}' added successfully"}
            )
        else:
            return jsonify({"status": 0, "msg": "Blockchain transaction failed"})

    except errors.DuplicateKeyError:
        return jsonify(
            {"status": 0, "msg": "An employee with this wallet address already exists"}
        )
    except Exception as e:
        return jsonify({"status": 0, "msg": str(e)}), 500


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


@app.route("/propertiesDocs/pdf/<property_id>")
def get_pdf(property_id):
    try:
        results = list(propertyDocsTable.find({"Property_Id": str(property_id)}))
        if not results:
            return jsonify({"status": 0, "reason": "No property matched that ID"}), 404

        details = results[0]
        filename = f"{details['Owner']}_{details['Property_Id']}.pdf"

        if filename not in details:
            return jsonify({"status": 0, "reason": "Document reference missing"}), 404

        file = fs.get(details[filename])
        response = Response(file.read(), content_type="application/pdf")
        response.headers["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    except Exception as e:
        return jsonify({"status": 0, "reason": str(e)}), 500


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not ADMIN_ADDRESS or not ADMIN_PASSWORD:
        print("ERROR: Admin address or password not found in config.json")
        exit(1)

    # Insert admin record on first run if it doesn't exist yet
    existing_admin = employeesTable.find_one(
        {"adminAddress": {"$regex": f"^{ADMIN_ADDRESS}$", "$options": "i"}}
    )

    if existing_admin is None:
        print("\nAdmin record not found — inserting into database...")
        result = employeesTable.insert_one(
            {
                "adminAddress": ADMIN_ADDRESS.lower(),
                "password": generate_password_hash(ADMIN_PASSWORD),
            }
        )
        if result.inserted_id:
            print(f"Admin added successfully (id: {result.inserted_id})")
        else:
            print("ERROR: Failed to insert admin record")
            exit(1)
    else:
        print("Admin record already exists — skipping insertion")

    app.run(debug=True, port=5001)
