"""
Run this ONCE to generate your SqueezyPay encryption key.

    cd backend
    .\venv\Scripts\Activate.ps1
    python ..\scripts\generate_key.py

Copy the key it prints, then set it as a permanent Windows environment variable:

    1. Open Start -> search "Edit the system environment variables"
    2. Click "Environment Variables..."
    3. Under "User variables", click "New"
    4. Variable name:  SQUEEZYPAY_ENCRYPTION_KEY
    5. Variable value: <paste the key here>
    6. Click OK on all dialogs

IMPORTANT: Back up this key somewhere safe (password manager, printed paper).
If you lose it, all stored credentials and payment methods are unrecoverable.
You will need to restart any open terminals and the backend server after setting
the variable for it to take effect.
"""

from cryptography.fernet import Fernet

key = Fernet.generate_key().decode()
print()
print("Your encryption key:")
print()
print(f"  {key}")
print()
print("Set this as the SQUEEZYPAY_ENCRYPTION_KEY environment variable.")
print("See the instructions at the top of this file.")
print()
