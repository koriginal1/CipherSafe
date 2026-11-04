from pathlib import Path
from crypto import generate_rsa_keypair

public_key, private_key = generate_rsa_keypair()
Path("rsa_public.pem").write_text(public_key, encoding="utf-8")
Path("rsa_private.pem").write_text(private_key, encoding="utf-8")
print("Created rsa_public.pem and rsa_private.pem.")
print("Share the public key if needed. NEVER share rsa_private.pem.")
