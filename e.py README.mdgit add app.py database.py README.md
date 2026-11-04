warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'app.py', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'database.py', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/README.md b/README.md[m
[1mindex 1affddf..2c0e455 100644[m
[1m--- a/README.md[m
[1m+++ b/README.md[m
[36m@@ -44,5 +44,5 @@[m [mRun `python generate_rsa_keys.py`. It creates `rsa_public.pem` and `rsa_private.[m
 - Plaintext, ciphertext, and keys are not written to the database.[m
 - The history page can load, search, paginate, show details, and clear stored operation metadata.[m
 - This starter has no user accounts, so history is shared across visitors and the clear-history endpoint clears the shared table. Add authentication/authorization before using it for a public multi-user deployment.[m
[31m-- The backend logs a history-write error to the server log if Supabase is not configured or unavailable; the encryption result itself is not falsely reported as a crypto failure. The History API will return an error if it cannot read from Supabase.[m
[32m+[m[32m- If a history write fails, the backend logs the error and the encrypt/decrypt response warns that metadata was not saved; the crypto result itself is still returned. If Supabase credentials are missing, the History API gives setup instructions. Other history API failures are logged and returned as errors.[m
 - The starter is for an educational project, not a production-hardened security product. 3DES is deprecated; prefer AES for real applications.[m
[1mdiff --git a/app.py b/app.py[m
[1mindex 17be80e..f8ad311 100644[m
[1m--- a/app.py[m
[1m+++ b/app.py[m
[36m@@ -3,7 +3,12 @@[m [mfrom __future__ import annotations[m
 from flask import Flask, jsonify, render_template, request, send_from_directory[m
 [m
 from crypto import encrypt_message, decrypt_message[m
[31m-from database import add_operation, get_operations, clear_operations[m
[32m+[m[32mfrom database import ([m
[32m+[m[32m    SupabaseConfigurationError,[m
[32m+[m[32m    add_operation,[m
[32m+[m[32m    get_operations,[m
[32m+[m[32m    clear_operations,[m
[32m+[m[32m)[m
 [m
 app = Flask(__name__, template_folder="templates", static_folder=None)[m
 app.config["MAX_CONTENT_LENGTH"] = 64 * 1024  # Limit request size to 64 KB[m
[36m@@ -14,12 +19,18 @@[m [mdef static_files(filename: str):[m
     return send_from_directory("public/static", filename)[m
 [m
 [m
[31m-def log_operation(operation_type: str, algorithm: str, message_length: int, status: str) -> None:[m
[32m+[m[32mdef log_operation(operation_type: str, algorithm: str, message_length: int, status: str) -> bool:[m
     """Log history failures without hiding a successful crypto result."""[m
     try:[m
         add_operation(operation_type, algorithm, message_length, status)[m
[32m+[m[32m        return True[m
     except Exception:[m
         app.logger.exception("Could not save operation metadata to Supabase")[m
[32m+[m[32m        return False[m
[32m+[m
[32m+[m
[32m+[m[32mdef history_warning() -> str:[m
[32m+[m[32m    return "Operation succeeded, but its history could not be saved. Check the Supabase configuration in Vercel."[m
 [m
 [m
 @app.get("/")[m
[36m@@ -52,10 +63,17 @@[m [mdef api_encrypt():[m
 [m
     try:[m
         result = encrypt_message(text, algorithm, key)[m
[31m-        log_operation("Encrypt", algorithm, len(text), "Success")[m
[32m+[m[32m        history_saved = log_operation("Encrypt", algorithm, len(text), "Success")[m
         response = {"result": result}[m
[32m+[m[32m        if not history_saved:[m
[32m+[m[32m            response["warning"] = history_warning()[m
         if algorithm.strip().upper() == "3DES":[m
[31m-            response["warning"] = "3DES is a legacy algorithm and is not recommended for real-world security."[m
[32m+[m[32m            legacy_warning = "3DES is a legacy algorithm and is not recommended for real-world security."[m
[32m+[m[32m            response["warning"] = ([m
[32m+[m[32m                f"{response['warning']} {legacy_warning}"[m
[32m+[m[32m                if "warning" in response[m
[32m+[m[32m                else legacy_warning[m
[32m+[m[32m            )[m
         return jsonify(response)[m
     except ValueError as exc:[m
         log_operation("Encrypt", algorithm or "Unknown", len(text), "Failed")[m
[36m@@ -82,8 +100,11 @@[m [mdef api_decrypt():[m
 [m
     try:[m
         result = decrypt_message(text, algorithm, key)[m
[31m-        log_operation("Decrypt", algorithm, len(text), "Success")[m
[31m-        return jsonify({"result": result})[m
[32m+[m[32m        history_saved = log_operation("Decrypt", algorithm, len(text), "Success")[m
[32m+[m[32m        response = {"result": result}[m
[32m+[m[32m        if not history_saved:[m
[32m+[m[32m            response["warning"] = history_warning()[m
[32m+[m[32m        return jsonify(response)[m
     except ValueError as exc:[m
         log_operation("Decrypt", algorithm or "Unknown", len(text), "Failed")[m
         return jsonify({"error": str(exc)}), 400[m
[36m@@ -98,6 +119,9 @@[m [mdef api_history():[m
     try:[m
         records = get_operations()[m
         return jsonify({"records": records})[m
[32m+[m[32m    except SupabaseConfigurationError as exc:[m
[32m+[m[32m        app.logger.error("Could not load history: %s", exc)[m
[32m+[m[32m        return jsonify({"error": str(exc)}), 503[m
     except Exception:[m
         app.logger.exception("Could not load history")[m
         return jsonify({"error": "Could not load operation history."}), 500[m
[36m@@ -112,6 +136,9 @@[m [mdef api_clear_history():[m
     try:[m
         clear_operations(operation_type)[m
         return jsonify({"message": "History cleared."})[m
[32m+[m[32m    except SupabaseConfigurationError as exc:[m
[32m+[m[32m        app.logger.error("Could not clear history: %s", exc)[m
[32m+[m[32m        return jsonify({"error": str(exc)}), 503[m
     except Exception:[m
         app.logger.exception("Could not clear history")[m
         return jsonify({"error": "Could not clear operation history."}), 500[m
[1mdiff --git a/database.py b/database.py[m
[1mindex e018af6..ef2dd86 100644[m
[1m--- a/database.py[m
[1m+++ b/database.py[m
[36m@@ -13,14 +13,19 @@[m [mload_dotenv()[m
 TABLE_NAME = "operations"[m
 [m
 [m
[32m+[m[32mclass SupabaseConfigurationError(RuntimeError):[m
[32m+[m[32m    """Raised when the Supabase server credentials are not configured."""[m
[32m+[m
[32m+[m
 @lru_cache(maxsize=1)[m
 def _client() -> Client:[m
     url = os.getenv("SUPABASE_URL", "").strip()[m
     key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()[m
     if not url or not key:[m
[31m-        raise RuntimeError([m
[32m+[m[32m        raise SupabaseConfigurationError([m
             "Supabase is not configured. Set SUPABASE_URL and "[m
[31m-            "SUPABASE_SERVICE_ROLE_KEY in your local .env file or deployment environment."[m
[32m+[m[32m            "SUPABASE_SERVICE_ROLE_KEY in Vercel Project Settings > Environment Variables, "[m
[32m+[m[32m            "then redeploy."[m
         )[m
     return create_client(url, key)[m
 [m
