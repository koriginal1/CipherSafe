# CipherSafe Flask + Supabase backend starter

## Included
- Flask API endpoints: `POST /api/encrypt`, `POST /api/decrypt`, `GET /api/history`, `DELETE /api/history`
- AES-GCM with PBKDF2-derived passphrase key
- RSA hybrid encryption (RSA-OAEP-SHA256 wraps an AES key; AES-GCM encrypts the message)
- 3DES-CBC for educational/legacy compatibility, protected with HMAC
- Supabase (PostgreSQL) operation history; saves metadata only, never message contents or keys

## 1. Set up Supabase
1. Create a project in the Supabase dashboard.
2. Open **SQL Editor**, create a new query, paste the contents of `supabase_schema.sql`, and run it.
3. Open your project's **Connect / API settings** and copy the Project URL and server-side service-role key. Supabase dashboard wording may vary by project/key version.
4. Keep the service-role key on the Python server only. Never put it in HTML, CSS, JavaScript, or a `VITE_`/public variable.

## 2. Configure locally in VS Code (Windows)
1. Install Python 3.10+.
2. Copy `.env.example` to a new file named `.env`.
3. Fill in the values:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your server-side service-role/secret key
4. In the project terminal, create and activate a virtual environment:
   `py -m venv .venv`
   PowerShell: `.venv\Scripts\Activate.ps1`
5. Install packages:
   `python -m pip install -r requirements.txt`
6. Move your four HTML files into `templates/`.
7. Move your existing `css/`, `js/`, and `assets/` folders into `static/`.
8. Update asset paths in HTML, for example:
   - `href="css/style.css"` -> `href="{{ url_for('static', filename='css/style.css') }}"`
   - `src="js/encrypt.js"` -> `src="{{ url_for('static', filename='js/encrypt.js') }}"`
   - `src="assets/LOGO.png"` -> `src="{{ url_for('static', filename='assets/LOGO.png') }}"`
   Do this for every CSS/JS/image path.
9. Load each script only once. Encrypt page: `encrypt.js` + shared `script.js`; decrypt page: `decrypt.js` + shared `script.js`; history page: `history.js` + shared `script.js`.
10. Start locally with `python app.py` and open `http://127.0.0.1:5000/`. Do not open the HTML directly using `file://`.

## 3. Configure Vercel
Add these environment variables in **Vercel Project > Settings > Environment Variables** for Development, Preview, and Production as needed:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Redeploy after changing environment variables. Do not commit `.env`. The `.gitignore` file in this starter excludes it. Vercel's Flask/static-file deployment setup may need additional configuration when you integrate the complete frontend; verify the live deployment after connecting your Git repository.

## 4. RSA key pair
Run `python generate_rsa_keys.py`. It creates `rsa_public.pem` and `rsa_private.pem`. Paste the public key into Encrypt and the matching private key into Decrypt. Keep the private key secret and never commit it to GitHub.

## 5. History and privacy
- Supabase stores timestamp, operation type, algorithm, message length, and success/failure status.
- Plaintext, ciphertext, and keys are not written to the database.
- The history page can load, search, paginate, show details, and clear stored operation metadata.
- This starter has no user accounts, so history is shared across visitors and the clear-history endpoint clears the shared table. Add authentication/authorization before using it for a public multi-user deployment.
- The backend logs a history-write error to the server log if Supabase is not configured or unavailable; the encryption result itself is not falsely reported as a crypto failure. The History API will return an error if it cannot read from Supabase.
- The starter is for an educational project, not a production-hardened security product. 3DES is deprecated; prefer AES for real applications.
