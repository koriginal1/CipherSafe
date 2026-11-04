from __future__ import annotations

from flask import Flask, jsonify, render_template, request, send_from_directory

from crypto import encrypt_message, decrypt_message
from database import add_operation, get_operations, clear_operations

app = Flask(__name__, template_folder="templates", static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024  # Limit request size to 64 KB


@app.get("/static/<path:filename>")
def static_files(filename: str):
    return send_from_directory("public/static", filename)


def log_operation(operation_type: str, algorithm: str, message_length: int, status: str) -> None:
    """Log history failures without hiding a successful crypto result."""
    try:
        add_operation(operation_type, algorithm, message_length, status)
    except Exception:
        app.logger.exception("Could not save operation metadata to Supabase")


@app.get("/")
def home():
    return render_template("home.html")


@app.get("/<page>")
def pages(page: str):
    # Only allow known HTML pages, not arbitrary template paths.
    allowed = {"home.html", "encrypt.html", "decrypt.html", "history.html"}
    if page not in allowed:
        return jsonify({"error": "Page not found."}), 404
    return render_template(page)


@app.post("/api/encrypt")
def api_encrypt():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    algorithm = data.get("algorithm", "")
    key = data.get("key", "")

    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Enter a message to encrypt."}), 400
    if len(text) > 1000:
        return jsonify({"error": "Messages must be 1000 characters or fewer."}), 400
    if not isinstance(algorithm, str) or not isinstance(key, str):
        return jsonify({"error": "Invalid request format."}), 400

    try:
        result = encrypt_message(text, algorithm, key)
        log_operation("Encrypt", algorithm, len(text), "Success")
        response = {"result": result}
        if algorithm.strip().upper() == "3DES":
            response["warning"] = "3DES is a legacy algorithm and is not recommended for real-world security."
        return jsonify(response)
    except ValueError as exc:
        log_operation("Encrypt", algorithm or "Unknown", len(text), "Failed")
        return jsonify({"error": str(exc)}), 400
    except Exception:
        app.logger.exception("Unexpected encryption error")
        log_operation("Encrypt", algorithm or "Unknown", len(text), "Failed")
        return jsonify({"error": "Encryption failed. Check your input and try again."}), 500


@app.post("/api/decrypt")
def api_decrypt():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    algorithm = data.get("algorithm", "")
    key = data.get("key", "")

    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Enter ciphertext to decrypt."}), 400
    if len(text) > 12000:
        return jsonify({"error": "Ciphertext is too long."}), 400
    if not isinstance(algorithm, str) or not isinstance(key, str):
        return jsonify({"error": "Invalid request format."}), 400

    try:
        result = decrypt_message(text, algorithm, key)
        log_operation("Decrypt", algorithm, len(text), "Success")
        return jsonify({"result": result})
    except ValueError as exc:
        log_operation("Decrypt", algorithm or "Unknown", len(text), "Failed")
        return jsonify({"error": str(exc)}), 400
    except Exception:
        app.logger.exception("Unexpected decryption error")
        log_operation("Decrypt", algorithm or "Unknown", len(text), "Failed")
        return jsonify({"error": "Decryption failed. Check the ciphertext and key."}), 500


@app.get("/api/history")
def api_history():
    try:
        records = get_operations()
        return jsonify({"records": records})
    except Exception:
        app.logger.exception("Could not load history")
        return jsonify({"error": "Could not load operation history."}), 500


@app.delete("/api/history")
def api_clear_history():
    operation_type = request.args.get("type")
    if operation_type and operation_type not in {"Encrypt", "Decrypt"}:
        return jsonify({"error": "Operation type must be Encrypt or Decrypt."}), 400

    try:
        clear_operations(operation_type)
        return jsonify({"message": "History cleared."})
    except Exception:
        app.logger.exception("Could not clear history")
        return jsonify({"error": "Could not clear operation history."}), 500


if __name__ == "__main__":
    # Development server only. Do not use Flask's debug server for public deployment.
    app.run(debug=True)
