# Windows MSI Installer — DTSYS Agent

The DTSYS Agent ships as a signed MSI package for Windows environments where
Group Policy, SCCM, Intune, or other software distribution tools require MSI format.

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Windows | 10 / Server 2016 or newer |
| Architecture | x86-64 (amd64) |

---

## Silent Installation (recommended)

```powershell
msiexec /i dtsys-agent-1.3.0-windows-amd64.msi /qn ^
  DTSYS_SERVER=https://your-dtsys-server ^
  DTSYS_TOKEN=YOUR_ENROLLMENT_TOKEN
```

Optional property for pre-assigned org:

```powershell
msiexec /i dtsys-agent-1.3.0-windows-amd64.msi /qn ^
  DTSYS_SERVER=https://your-dtsys-server ^
  DTSYS_TOKEN=YOUR_ENROLLMENT_TOKEN ^
  DTSYS_ORG_ID=00000000-0000-0000-0000-000000000001
```

| Property | Description |
|----------|-------------|
| `DTSYS_SERVER` | Full URL to the DTSYS server (no trailing slash) |
| `DTSYS_TOKEN` | One-time enrollment token from the server |
| `DTSYS_ORG_ID` | (Optional) UUID of the target organization |

---

## What the installer does

1. Copies `dtsys-agent.exe` and `winsw.exe` to `%ProgramFiles%\DTSYS\Agent\`
2. Writes `agent.toml` with the provided server URL and enrollment token
3. Installs the Windows service `DTSYSAgent` via WinSW
4. Starts the service immediately

---

## Upgrade

Run the same `msiexec` command with a newer MSI. The `UpgradeCode` GUID is
stable across versions, so Windows will perform a major upgrade automatically —
stopping the old service, replacing files, and restarting.

---

## Uninstall

```powershell
msiexec /x dtsys-agent-1.3.0-windows-amd64.msi /qn
```

Or via `Settings → Apps → Installed Apps → DTSYS Agent → Uninstall`.

The uninstall action stops and removes the `DTSYSAgent` service and deletes all
files from the installation directory.

---

## Building the MSI locally

Requirements:
- [WiX Toolset v4](https://wixtoolset.org/): `dotnet tool install --global wix`
- Go 1.25.9+
- WinSW 2.x placed at `client/packaging/windows/winsw.exe` (downloaded automatically if missing)

```powershell
cd client/packaging/windows
.\build-msi.ps1 -Version 1.3.0
```

Output: `dist/dtsys-agent-1.3.0-windows-amd64.msi`

---

## Group Policy / Intune deployment

Deploy the MSI as a **Line-of-business app** or via a **Win32 app** package.
Set the install command:

```
msiexec /i dtsys-agent-1.3.0-windows-amd64.msi /qn DTSYS_SERVER=https://your-server DTSYS_TOKEN=TOKEN
```

Detection rule: registry key `HKLM\SOFTWARE\DTSYS\Agent` (created by MSI)
or file presence at `%ProgramFiles%\DTSYS\Agent\dtsys-agent.exe`.
