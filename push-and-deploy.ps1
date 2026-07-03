# push-and-deploy.ps1
# Usage: .\push-and-deploy.ps1 -Message "Commit message" [-SiteId <siteId>] [-Dir <deployDir>]
param(
    [string]$Message = "Auto push and deploy",
    [string]$SiteId = "afb7b870-81fb-4564-ab72-e804f0d82600",
    [string]$Dir = "."
)

function Ensure-NetlifyCLI {
    $gh = Get-Command netlify -ErrorAction SilentlyContinue
    if (-not $gh) {
        Write-Host "Netlify CLI no instalado. Instalando con npm global..." -ForegroundColor Yellow
        npm install -g netlify-cli
        if ($LASTEXITCODE -ne 0) { throw "Falló la instalación de netlify-cli" }
    }
}

try {
    Set-Location "$PSScriptRoot"
    Write-Host "Ejecutando: git add -A" -ForegroundColor Cyan
    git add -A

    $status = git status --porcelain
    if (-not $status) {
        Write-Host "No hay cambios para commitear." -ForegroundColor Yellow
    } else {
        Write-Host "Committing con mensaje: $Message" -ForegroundColor Cyan
        git commit -m $Message
    }

    Write-Host "Pusheando a remoto..." -ForegroundColor Cyan
    git push

    Ensure-NetlifyCLI

    if (-not $env:NETLIFY_AUTH_TOKEN) {
        $token = Read-Host -AsSecureString "Introduce NETLIFY_AUTH_TOKEN (se usará solo en esta ejecución)"
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        Remove-Variable bstr -ErrorAction SilentlyContinue
        $env:NETLIFY_AUTH_TOKEN = $plain
        Write-Host "Token cargado en variable de entorno temporal." -ForegroundColor Yellow
    } else {
        Write-Host "Usando NETLIFY_AUTH_TOKEN desde el entorno." -ForegroundColor Yellow
    }

    # Ensure linked
    if (-not (Test-Path ".netlify\state.json")) {
        Write-Host "No hay .netlify/state.json, vinculando siteId $SiteId" -ForegroundColor Cyan
        netlify link --id $SiteId
    } else {
        Write-Host "Encontrado .netlify/state.json, usando configuración local." -ForegroundColor Cyan
    }

    Write-Host "Desplegando a producción..." -ForegroundColor Green
    netlify deploy --prod --dir=$Dir --site=$SiteId
    if ($LASTEXITCODE -ne 0) { throw "netlify deploy falló" }

    Write-Host "Deploy completado." -ForegroundColor Green
} catch {
    Write-Error "Error: $_"
    exit 1
}
