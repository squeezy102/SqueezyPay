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
#define AppVersion   GetFileVersion("..\backend\dist\backend.exe")
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
Name: "autofill";   Description: "Biller Autofill (+~150 MB){newline}Attempts to open your biller's login page and fill in your credentials automatically. Works well on some sites, not at all on others — results vary by biller. Experimental."; Types: full

[Types]
Name: "full";    Description: "Full installation (recommended)"
Name: "compact"; Description: "Core only (no Biller Autofill)"
Name: "custom";  Description: "Custom"; Flags: iscustom

[Tasks]
Name: "autostart";    Description: "Start {#AppName} automatically when Windows starts"; GroupDescription: "Options:"; Flags: unchecked
Name: "desktopicon";  Description: "Create a desktop shortcut"; GroupDescription: "Options:"

[Files]
; Core — backend executable
Source: "..\backend\dist\{#AppExeName}"; DestDir: "{app}"; Components: core; Flags: ignoreversion

; Core — frontend static build
Source: "..\frontend\dist\*"; DestDir: "{app}\frontend\dist"; Components: core; Flags: ignoreversion recursesubdirs createallsubdirs

; Core — admin dashboard
Source: "..\admin\dashboard.html"; DestDir: "{app}\admin"; Components: core; Flags: ignoreversion
Source: "..\admin\main.py";        DestDir: "{app}\admin"; Components: core; Flags: ignoreversion

; Core — Alembic migrations (needed by --migrate at upgrade time)
Source: "..\backend\alembic\*";   DestDir: "{app}\alembic";  Components: core; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\backend\alembic.ini"; DestDir: "{app}";          Components: core; Flags: ignoreversion

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
Filename: "{app}\{#AppExeName}"; Parameters: "--migrate"; WorkingDir: "{app}"; Flags: runhidden waitprogress; StatusMsg: "Setting up database..."

; Optionally open the app in the browser when done
Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Description: "Launch {#AppName} now"; Flags: nowait postinstall skipifsilent

[Code]

// -----------------------------------------------------------------------
// Custom wizard pages
// -----------------------------------------------------------------------

var
  // Security page
  SecurityPage: TWizardPage;
  SecurityLabel: TNewStaticText;

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
begin
  TempFile := ExpandConstant('{tmp}\fernet_key.txt');
  Exec(ExpandConstant('{app}\{#AppExeName}'),
       '--generate-key fernet "' + TempFile + '"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if (ResultCode = 0) and FileExists(TempFile) then
    LoadStringFromFile(TempFile, Result)
  else
    Result := '';
  DeleteFile(TempFile);
  Result := Trim(Result);
end;

function GenerateSecretKey(): String;
var
  TempFile: String;
  ResultCode: Integer;
begin
  TempFile := ExpandConstant('{tmp}\secret_key.txt');
  Exec(ExpandConstant('{app}\{#AppExeName}'),
       '--generate-key secret "' + TempFile + '"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if (ResultCode = 0) and FileExists(TempFile) then
    LoadStringFromFile(TempFile, Result)
  else
    Result := '';
  DeleteFile(TempFile);
  Result := Trim(Result);
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
// Page creation
// -----------------------------------------------------------------------

procedure InitializeWizard();
begin
  // --- Security page ---
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
    'SqueezyPay encrypts sensitive data (stored credentials and bank tokens) ' +
    'using a key unique to your installation. This key will be generated ' +
    'automatically and stored securely on your PC.' + #13#10 + #13#10 +
    'You do not need to write anything down or enter anything here. ' +
    'If you ever uninstall and reinstall SqueezyPay, a new key will be ' +
    'generated — your previous data will not be recoverable, so back up ' +
    '%APPDATA%\SqueezyPay\squeezypay.db before uninstalling.';

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
             'See docs/configuration.md for instructions.', mbError, MB_OK);
  end;

  if CurStep = ssPostInstall then
  begin
    // Write the passphrase to a temp file for the backend to hash on first start.
    // The backend reads and deletes this file on startup — it is never stored as plaintext.
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
