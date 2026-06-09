; SqueezyPay Windows Installer
; Built with Inno Setup 6.x — https://jrsoftware.org/isinfo.php
;
; Prerequisites (must exist before running iscc):
;   ..\backend\dist\backend.exe     (PyInstaller output)
;   ..\frontend\dist\*              (Vite build output)
;   ..\admin\dashboard.html
;   ..\admin\main.py
;   ..\backend\alembic\*
;   ..\backend\alembic.ini
;
; Playwright/Chromium component (optional):
;   ..\backend\playwright_browsers\*
;   Populate by running: playwright install chromium --with-deps
;   then copying the browsers directory into backend/playwright_browsers/

#define AppName      "SqueezyPay"
; AppVersion is injected by CI via /DAppVersion=<tag> (e.g. /DAppVersion=0.1.0-alpha.3).
; When building locally without that flag, fall back to reading the EXE version resource.
#ifndef AppVersion
  #define AppVersion GetVersionNumbersString("..\backend\dist\backend.exe")
#endif
#define AppPublisher "SqueezyPay"
#define AppURL       "https://github.com/squeezy102/SqueezyPay"
#define AppExeName   "backend.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}/releases
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
; Store user data in %APPDATA% — survives reinstalls and upgrades
; The app itself handles creating this directory at first run.
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=SqueezyPay-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; Show component selection page
WizardSmallImageFile=wizard_small.bmp
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}
CloseApplications=yes
; Minimum Windows 10
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Components]
; Core is always installed — no checkbox shown
Name: "core";       Description: "SqueezyPay";    Types: full compact custom; Flags: fixed
; Playwright/Chromium is optional — checked by default
Name: "autofill";   Description: "Biller Autofill (+~150 MB) — Attempts to open your biller's login page and fill in your credentials automatically. Works well on some sites, not at all on others. Experimental."; Types: full

[Types]
Name: "full";    Description: "Full installation (recommended)"
Name: "compact"; Description: "Core only (no Biller Autofill)"
Name: "custom";  Description: "Custom"; Flags: iscustom

[Tasks]
Name: "autostart";    Description: "Start {#AppName} automatically when Windows starts"; GroupDescription: "Options:"; Flags: unchecked
Name: "desktopicon";  Description: "Create a desktop shortcut"; GroupDescription: "Options:"

[Files]
; Core — backend (onedir bundle: exe + all dependency files)
Source: "..\backend\dist\backend\*"; DestDir: "{app}"; Components: core; Flags: ignoreversion recursesubdirs createallsubdirs

; Optional — Playwright Chromium browsers
Source: "..\backend\playwright_browsers\*"; DestDir: "{app}\playwright_browsers"; Components: autofill; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu
Name: "{group}\{#AppName}";           Filename: "{app}\{#AppExeName}"; Comment: "Open SqueezyPay in your browser"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
; Desktop shortcut (optional)
Name: "{autodesktop}\{#AppName}";     Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
; Write Plaid credentials if provided on the custom pages (populated by Pascal script below)
; HKCU\Environment — Windows User environment variables, readable without admin rights
Root: HKCU; Subkey: "Environment"; ValueType: string; ValueName: "SQUEEZYPAY_ENCRYPTION_KEY"; ValueData: "{code:GetEncryptionKey}"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Environment"; ValueType: string; ValueName: "SQUEEZYPAY_SECRET_KEY";     ValueData: "{code:GetSecretKey}";     Flags: uninsdeletevalue
Root: HKCU; Subkey: "Environment"; ValueType: string; ValueName: "SQUEEZYPAY_PLAID_CLIENTID"; ValueData: "{code:GetPlaidClientId}"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Environment"; ValueType: string; ValueName: "SQUEEZYPAY_PLAID_SECRET";   ValueData: "{code:GetPlaidSecret}";   Flags: uninsdeletevalue
Root: HKCU; Subkey: "Environment"; ValueType: string; ValueName: "SQUEEZYPAY_PLAID_ENV";      ValueData: "production";              Flags: uninsdeletevalue

[Run]
; Run database migrations after install (headless, hidden window)
Filename: "{app}\{#AppExeName}"; Parameters: "--migrate"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; StatusMsg: "Setting up database..."

; Optionally open the app in the browser when done
Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Description: "Launch {#AppName} now"; Flags: nowait postinstall skipifsilent

[Code]

// -----------------------------------------------------------------------
// WinAPI clipboard helpers (Inno Setup Pascal has no Clipboard object)
// -----------------------------------------------------------------------

function OpenClipboard(hWnd: HWND): BOOL;
  external 'OpenClipboard@user32.dll stdcall';
function EmptyClipboard(): BOOL;
  external 'EmptyClipboard@user32.dll stdcall';
function CloseClipboard(): BOOL;
  external 'CloseClipboard@user32.dll stdcall';
function GlobalAlloc(uFlags: UINT; dwBytes: DWORD): THandle;
  external 'GlobalAlloc@kernel32.dll stdcall';
function GlobalLock(hMem: THandle): DWORD;
  external 'GlobalLock@kernel32.dll stdcall';
function GlobalUnlock(hMem: THandle): BOOL;
  external 'GlobalUnlock@kernel32.dll stdcall';
function SetClipboardData(uFormat: UINT; hMem: THandle): THandle;
  external 'SetClipboardData@user32.dll stdcall';
procedure RtlMoveMemory(Dest: DWORD; const Source: AnsiString; Len: DWORD);
  external 'RtlMoveMemory@kernel32.dll stdcall';

const
  CF_TEXT    = 1;
  GMEM_FIXED = $0000;

procedure SetTextToClipboard(const S: String);
var
  hMem: THandle;
  pMem: DWORD;
  Buf: AnsiString;
begin
  Buf := AnsiString(S) + #0;
  hMem := GlobalAlloc(GMEM_FIXED, Length(Buf));
  if hMem = 0 then Exit;
  pMem := GlobalLock(hMem);
  if pMem = 0 then Exit;
  RtlMoveMemory(pMem, Buf, Length(Buf));
  GlobalUnlock(hMem);
  if OpenClipboard(0) then
  begin
    EmptyClipboard();
    SetClipboardData(CF_TEXT, hMem);
    CloseClipboard();
  end;
end;


// -----------------------------------------------------------------------
// Custom wizard pages
// -----------------------------------------------------------------------

var
  // Security page (pre-install: explains what is about to happen)
  SecurityPage: TWizardPage;
  SecurityLabel: TNewStaticText;

  // Key reveal page (post-install: shows the generated key, gates Next on checkbox)
  KeyRevealPage: TWizardPage;
  KeyRevealIntro: TNewStaticText;
  KeyRevealEdit: TNewEdit;
  KeyRevealCopyBtn: TNewButton;
  KeyRevealWarning: TNewStaticText;
  KeyRevealCheck: TNewCheckBox;
  KeyRevealError: TNewStaticText;

  // Plaid page
  PlaidPage: TWizardPage;
  PlaidIntroLabel: TNewStaticText;
  PlaidLinkLabel: TNewLinkLabel;
  PlaidClientIdLabel: TNewStaticText;
  PlaidClientIdEdit: TNewEdit;
  PlaidSecretLabel: TNewStaticText;
  PlaidSecretEdit: TNewEdit;
  PlaidSkipLabel: TNewStaticText;

  // Passphrase page
  PassphrasePage: TWizardPage;
  PassphraseLabel: TNewStaticText;
  PassphraseEdit: TNewEdit;
  PassphraseConfirmLabel: TNewStaticText;
  PassphraseConfirmEdit: TNewEdit;
  PassphraseError: TNewStaticText;

  // Generated values (held in memory, written to registry via [Registry] section)
  GeneratedEncryptionKey: String;
  GeneratedSecretKey: String;


// -----------------------------------------------------------------------
// Key generation — Python one-liners executed via shell
// -----------------------------------------------------------------------

function GenerateFernetKey(): String;
var
  TempFile: String;
  ResultCode: Integer;
  FileContent: AnsiString;
begin
  Result := '';
  TempFile := ExpandConstant('{tmp}\fernet_key.txt');
  Exec(ExpandConstant('{app}\{#AppExeName}'),
       '--generate-key fernet "' + TempFile + '"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if (ResultCode = 0) and FileExists(TempFile) then
  begin
    LoadStringFromFile(TempFile, FileContent);
    Result := Trim(String(FileContent));
  end;
  DeleteFile(TempFile);
end;

function GenerateSecretKey(): String;
var
  TempFile: String;
  ResultCode: Integer;
  FileContent: AnsiString;
begin
  Result := '';
  TempFile := ExpandConstant('{tmp}\secret_key.txt');
  Exec(ExpandConstant('{app}\{#AppExeName}'),
       '--generate-key secret "' + TempFile + '"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if (ResultCode = 0) and FileExists(TempFile) then
  begin
    LoadStringFromFile(TempFile, FileContent);
    Result := Trim(String(FileContent));
  end;
  DeleteFile(TempFile);
end;


// -----------------------------------------------------------------------
// Accessor functions used by [Registry] ValueData entries
// -----------------------------------------------------------------------

function GetEncryptionKey(Param: String): String;
begin Result := GeneratedEncryptionKey; end;

function GetSecretKey(Param: String): String;
begin Result := GeneratedSecretKey; end;

function GetPlaidClientId(Param: String): String;
begin Result := PlaidClientIdEdit.Text; end;

function GetPlaidSecret(Param: String): String;
begin Result := PlaidSecretEdit.Text; end;


// -----------------------------------------------------------------------
// Clipboard helper for the Copy button on the key reveal page
// -----------------------------------------------------------------------

procedure CopyKeyToClipboard(Sender: TObject);
begin
  SetTextToClipboard(KeyRevealEdit.Text);
  KeyRevealCopyBtn.Caption := 'Copied!';
end;


// -----------------------------------------------------------------------
// Page creation
// -----------------------------------------------------------------------

procedure InitializeWizard();
begin
  // --- Security page (pre-install explanation) ---
  SecurityPage := CreateCustomPage(wpSelectComponents,
    'Security Setup',
    'SqueezyPay will generate a unique encryption key for your installation.');

  SecurityLabel := TNewStaticText.Create(SecurityPage);
  SecurityLabel.Parent := SecurityPage.Surface;
  SecurityLabel.Left   := 0;
  SecurityLabel.Top    := 0;
  SecurityLabel.Width  := SecurityPage.SurfaceWidth;
  SecurityLabel.AutoSize := True;
  SecurityLabel.WordWrap := True;
  SecurityLabel.Caption :=
    'SqueezyPay encrypts all stored credentials and bank tokens using a key ' +
    'unique to your installation. The key will be generated automatically ' +
    'during setup and stored on this PC.' + #13#10 + #13#10 +
    'After the key is generated, the installer will show it to you. ' +
    'You must save it before continuing — a password manager, a printed note ' +
    'kept somewhere safe, or an encrypted USB drive are all good options.' + #13#10 + #13#10 +
    'If this key is ever lost, all encrypted data stored by SqueezyPay ' +
    'becomes permanently unrecoverable. There is no reset or recovery option.';

  // --- Key reveal page (post-install: shown after key is generated) ---
  // Inserted after wpInstalling so it appears once the key exists.
  // The key text is populated in CurStepChanged(ssPostInstall).
  KeyRevealPage := CreateCustomPage(wpInstalling,
    'Save Your Encryption Key',
    'Your encryption key has been generated. You must save it before continuing.');

  KeyRevealIntro := TNewStaticText.Create(KeyRevealPage);
  KeyRevealIntro.Parent   := KeyRevealPage.Surface;
  KeyRevealIntro.Left     := 0;
  KeyRevealIntro.Top      := 0;
  KeyRevealIntro.Width    := KeyRevealPage.SurfaceWidth;
  KeyRevealIntro.AutoSize := True;
  KeyRevealIntro.WordWrap := True;
  KeyRevealIntro.Caption  :=
    'This is your encryption key. It is already stored on this PC, but if you ' +
    'ever need to reinstall Windows, move to a new machine, or restore from a backup, ' +
    'you will need this key to access your data.';

  KeyRevealEdit := TNewEdit.Create(KeyRevealPage);
  KeyRevealEdit.Parent    := KeyRevealPage.Surface;
  KeyRevealEdit.Left      := 0;
  KeyRevealEdit.Top       := KeyRevealIntro.Top + KeyRevealIntro.Height + 10;
  KeyRevealEdit.Width     := KeyRevealPage.SurfaceWidth - 90;
  KeyRevealEdit.ReadOnly  := True;
  KeyRevealEdit.Text      := '(generating...)';
  KeyRevealEdit.Font.Name := 'Courier New';
  KeyRevealEdit.Font.Size := 8;

  KeyRevealCopyBtn := TNewButton.Create(KeyRevealPage);
  KeyRevealCopyBtn.Parent  := KeyRevealPage.Surface;
  KeyRevealCopyBtn.Caption := 'Copy';
  KeyRevealCopyBtn.Left    := KeyRevealEdit.Left + KeyRevealEdit.Width + 8;
  KeyRevealCopyBtn.Top     := KeyRevealEdit.Top;
  KeyRevealCopyBtn.Width   := 75;
  KeyRevealCopyBtn.Height  := KeyRevealEdit.Height;
  KeyRevealCopyBtn.OnClick := @CopyKeyToClipboard;

  KeyRevealWarning := TNewStaticText.Create(KeyRevealPage);
  KeyRevealWarning.Parent   := KeyRevealPage.Surface;
  KeyRevealWarning.Left     := 0;
  KeyRevealWarning.Top      := KeyRevealEdit.Top + KeyRevealEdit.Height + 12;
  KeyRevealWarning.Width    := KeyRevealPage.SurfaceWidth;
  KeyRevealWarning.AutoSize := True;
  KeyRevealWarning.WordWrap := True;
  KeyRevealWarning.Font.Style := [fsBold];
  KeyRevealWarning.Caption  :=
    'Save this key now. Once you click Next, it will not be shown again. ' +
    'If this key is lost, your stored credentials and bank tokens cannot be recovered.';

  KeyRevealCheck := TNewCheckBox.Create(KeyRevealPage);
  KeyRevealCheck.Parent   := KeyRevealPage.Surface;
  KeyRevealCheck.Left     := 0;
  KeyRevealCheck.Top      := KeyRevealWarning.Top + KeyRevealWarning.Height + 12;
  KeyRevealCheck.Width    := KeyRevealPage.SurfaceWidth;
  KeyRevealCheck.Caption  := 'I have saved my encryption key in a safe place';

  KeyRevealError := TNewStaticText.Create(KeyRevealPage);
  KeyRevealError.Parent     := KeyRevealPage.Surface;
  KeyRevealError.Left       := 0;
  KeyRevealError.Top        := KeyRevealCheck.Top + KeyRevealCheck.Height + 6;
  KeyRevealError.Width      := KeyRevealPage.SurfaceWidth;
  KeyRevealError.AutoSize   := True;
  KeyRevealError.Font.Color := clRed;
  KeyRevealError.Caption    := '';

  // --- Plaid page ---
  PlaidPage := CreateCustomPage(SecurityPage.ID,
    'Bank Integration (Optional)',
    'Connect SqueezyPay to your bank via Plaid.');

  PlaidIntroLabel := TNewStaticText.Create(PlaidPage);
  PlaidIntroLabel.Parent  := PlaidPage.Surface;
  PlaidIntroLabel.Left    := 0;
  PlaidIntroLabel.Top     := 0;
  PlaidIntroLabel.Width   := PlaidPage.SurfaceWidth;
  PlaidIntroLabel.AutoSize := True;
  PlaidIntroLabel.WordWrap := True;
  PlaidIntroLabel.Caption :=
    'SqueezyPay connects to your financial institution using Plaid, a bank ' +
    'connectivity service. To use this feature you need a free Plaid developer ' +
    'account — it takes about five minutes to set up.' + #13#10 + #13#10 +
    'If you already have a Plaid account, enter your credentials below. ' +
    'You can also skip this step and configure it later from the app.';

  PlaidLinkLabel := TNewLinkLabel.Create(PlaidPage);
  PlaidLinkLabel.Parent  := PlaidPage.Surface;
  PlaidLinkLabel.Left    := 0;
  PlaidLinkLabel.Top     := PlaidIntroLabel.Top + PlaidIntroLabel.Height + 8;
  PlaidLinkLabel.Width   := PlaidPage.SurfaceWidth;
  PlaidLinkLabel.AutoSize := True;
  PlaidLinkLabel.Caption := '<a href="https://dashboard.plaid.com/">Get a free Plaid developer account →</a>';

  PlaidClientIdLabel := TNewStaticText.Create(PlaidPage);
  PlaidClientIdLabel.Parent  := PlaidPage.Surface;
  PlaidClientIdLabel.Left    := 0;
  PlaidClientIdLabel.Top     := PlaidLinkLabel.Top + PlaidLinkLabel.Height + 16;
  PlaidClientIdLabel.AutoSize := True;
  PlaidClientIdLabel.Caption := 'Client ID:';

  PlaidClientIdEdit := TNewEdit.Create(PlaidPage);
  PlaidClientIdEdit.Parent := PlaidPage.Surface;
  PlaidClientIdEdit.Left   := 0;
  PlaidClientIdEdit.Top    := PlaidClientIdLabel.Top + PlaidClientIdLabel.Height + 4;
  PlaidClientIdEdit.Width  := PlaidPage.SurfaceWidth;

  PlaidSecretLabel := TNewStaticText.Create(PlaidPage);
  PlaidSecretLabel.Parent  := PlaidPage.Surface;
  PlaidSecretLabel.Left    := 0;
  PlaidSecretLabel.Top     := PlaidClientIdEdit.Top + PlaidClientIdEdit.Height + 12;
  PlaidSecretLabel.AutoSize := True;
  PlaidSecretLabel.Caption := 'Secret:';

  PlaidSecretEdit := TNewEdit.Create(PlaidPage);
  PlaidSecretEdit.Parent       := PlaidPage.Surface;
  PlaidSecretEdit.Left         := 0;
  PlaidSecretEdit.Top          := PlaidSecretLabel.Top + PlaidSecretLabel.Height + 4;
  PlaidSecretEdit.Width        := PlaidPage.SurfaceWidth;
  PlaidSecretEdit.PasswordChar := '*';

  PlaidSkipLabel := TNewStaticText.Create(PlaidPage);
  PlaidSkipLabel.Parent   := PlaidPage.Surface;
  PlaidSkipLabel.Left     := 0;
  PlaidSkipLabel.Top      := PlaidSecretEdit.Top + PlaidSecretEdit.Height + 12;
  PlaidSkipLabel.Width    := PlaidPage.SurfaceWidth;
  PlaidSkipLabel.AutoSize := True;
  PlaidSkipLabel.WordWrap := True;
  PlaidSkipLabel.Caption  :=
    'Leave both fields blank to skip — you can add your Plaid credentials ' +
    'later from Settings in the app.';

  // --- Passphrase page ---
  PassphrasePage := CreateCustomPage(PlaidPage.ID,
    'Set Your Passphrase',
    'Choose a passphrase to log in to SqueezyPay from any device on your network.');

  PassphraseLabel := TNewStaticText.Create(PassphrasePage);
  PassphraseLabel.Parent  := PassphrasePage.Surface;
  PassphraseLabel.Left    := 0;
  PassphraseLabel.Top     := 0;
  PassphraseLabel.Width   := PassphrasePage.SurfaceWidth;
  PassphraseLabel.AutoSize := True;
  PassphraseLabel.WordWrap := True;
  PassphraseLabel.Caption :=
    'Everyone in your household will use this passphrase to log in. ' +
    'You can change it later from the Settings tab.';

  PassphraseEdit := TNewEdit.Create(PassphrasePage);
  PassphraseEdit.Parent       := PassphrasePage.Surface;
  PassphraseEdit.Left         := 0;
  PassphraseEdit.Top          := PassphraseLabel.Top + PassphraseLabel.Height + 12;
  PassphraseEdit.Width        := PassphrasePage.SurfaceWidth;
  PassphraseEdit.PasswordChar := '*';

  PassphraseConfirmLabel := TNewStaticText.Create(PassphrasePage);
  PassphraseConfirmLabel.Parent  := PassphrasePage.Surface;
  PassphraseConfirmLabel.Left    := 0;
  PassphraseConfirmLabel.Top     := PassphraseEdit.Top + PassphraseEdit.Height + 12;
  PassphraseConfirmLabel.AutoSize := True;
  PassphraseConfirmLabel.Caption := 'Confirm passphrase:';

  PassphraseConfirmEdit := TNewEdit.Create(PassphrasePage);
  PassphraseConfirmEdit.Parent       := PassphrasePage.Surface;
  PassphraseConfirmEdit.Left         := 0;
  PassphraseConfirmEdit.Top          := PassphraseConfirmLabel.Top + PassphraseConfirmLabel.Height + 4;
  PassphraseConfirmEdit.Width        := PassphrasePage.SurfaceWidth;
  PassphraseConfirmEdit.PasswordChar := '*';

  PassphraseError := TNewStaticText.Create(PassphrasePage);
  PassphraseError.Parent  := PassphrasePage.Surface;
  PassphraseError.Left    := 0;
  PassphraseError.Top     := PassphraseConfirmEdit.Top + PassphraseConfirmEdit.Height + 8;
  PassphraseError.Width   := PassphrasePage.SurfaceWidth;
  PassphraseError.AutoSize := True;
  PassphraseError.WordWrap := True;
  PassphraseError.Font.Color := clRed;
  PassphraseError.Caption := '';
end;


// -----------------------------------------------------------------------
// Validation — prevent advancing with mismatched passphrases
// -----------------------------------------------------------------------

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  // In silent mode the wizard auto-advances through all pages.
  // Validation is UI-only — the passphrase bootstrap file is written by
  // the CI step (or a future unattended-install script) before the
  // installer runs, so there is nothing to validate here.
  if WizardSilent() then Exit;

  if CurPageID = KeyRevealPage.ID then
  begin
    KeyRevealError.Caption := '';
    if not KeyRevealCheck.Checked then
    begin
      KeyRevealError.Caption := 'You must confirm that you have saved your encryption key before continuing.';
      Result := False;
    end;
  end;

  if CurPageID = PassphrasePage.ID then
  begin
    PassphraseError.Caption := '';
    if PassphraseEdit.Text = '' then
    begin
      PassphraseError.Caption := 'Please enter a passphrase.';
      Result := False;
    end
    else if PassphraseEdit.Text <> PassphraseConfirmEdit.Text then
    begin
      PassphraseError.Caption := 'Passphrases do not match. Please try again.';
      PassphraseConfirmEdit.Text := '';
      Result := False;
    end;
  end;
end;


// -----------------------------------------------------------------------
// Key generation — runs after files are extracted (wpInstalling)
// and before [Registry] entries are written
// -----------------------------------------------------------------------

procedure CurStepChanged(CurStep: TSetupStep);
var
  TaskXml: String;
  TaskFile: String;
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    // Generate keys now that backend.exe is on disk
    WizardForm.StatusLabel.Caption := 'Generating encryption key...';
    GeneratedEncryptionKey := GenerateFernetKey();
    GeneratedSecretKey     := GenerateSecretKey();

    if GeneratedEncryptionKey = '' then
      MsgBox('Warning: encryption key generation failed. You will need to set ' +
             'SQUEEZYPAY_ENCRYPTION_KEY manually before starting the app. ' +
             'See the Configuration page in the wiki for instructions: ' +
             'https://github.com/squeezy102/SqueezyPay/wiki/Configuration', mbError, MB_OK);
  end;

  if CurStep = ssPostInstall then
  begin
    // Populate the key reveal page now that the key is known.
    // The wizard will present this page next (it sits after wpInstalling).
    if GeneratedEncryptionKey <> '' then
      KeyRevealEdit.Text := GeneratedEncryptionKey
    else
      KeyRevealEdit.Text := '(key generation failed — see Configuration wiki page)';

    // Write the passphrase to a temp file for the backend to hash on first start.
    // The backend reads and deletes this file on startup — it is never stored as plaintext.
    // In silent mode the file is pre-written by the calling script; skip to avoid overwriting it.
    if not WizardSilent() then
      SaveStringToFile(
        ExpandConstant('{userappdata}\SqueezyPay\initial_passphrase.tmp'),
        PassphraseEdit.Text,
        False
      );

    // Optional: register Task Scheduler entry for auto-start
    if IsTaskSelected('autostart') then
    begin
      TaskXml :=
        '<?xml version="1.0" encoding="UTF-16"?>' +
        '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">' +
        '<Triggers><LogonTrigger><Enabled>true</Enabled></LogonTrigger></Triggers>' +
        '<Actions><Exec>' +
        '<Command>"' + ExpandConstant('{app}\{#AppExeName}') + '"</Command>' +
        '<Arguments>--tray</Arguments>' +
        '<WorkingDirectory>' + ExpandConstant('{app}') + '</WorkingDirectory>' +
        '</Exec></Actions>' +
        '<Settings><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>' +
        '<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries></Settings>' +
        '</Task>';

      TaskFile := ExpandConstant('{tmp}\squeezypay_task.xml');
      SaveStringToFile(TaskFile, TaskXml, False);
      Exec('schtasks.exe',
           '/Create /TN "SqueezyPay" /XML "' + TaskFile + '" /F',
           '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      DeleteFile(TaskFile);
    end;
  end;
end;


// -----------------------------------------------------------------------
// Uninstall cleanup — remove Task Scheduler entry and env vars
// -----------------------------------------------------------------------

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    Exec('schtasks.exe', '/Delete /TN "SqueezyPay" /F',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
