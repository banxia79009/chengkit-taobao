param([switch]$SkipDownload)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$node=(Get-Command node.exe -ErrorAction Stop).Source
$major=[int]((& $node --version).Trim().TrimStart('v').Split('.')[0]);if($major -lt 22){throw 'Node.js 22 or newer is required.'}
if(-not $SkipDownload){
  $npm=(Get-Command npm.cmd -ErrorAction Stop).Source
  $prefix=Join-Path $root 'runtime\managed\2.0.2'
  & $npm install --prefix $prefix '@jackwener/opencli@2.0.2' --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
  if($LASTEXITCODE -ne 0){throw 'OpenCLI download failed; existing data preserved.'}
}
& $node (Join-Path $root 'scripts\configure.cjs')
if($LASTEXITCODE -ne 0){throw 'Configuration failed.'}
& $node (Join-Path $root 'tools\opencli-launch.cjs') doctor
Write-Host 'Next: enable the official Chrome extension, then run node scripts/bind-browser.cjs .'
