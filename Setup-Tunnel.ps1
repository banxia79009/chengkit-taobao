param([Parameter(Mandatory=$true)][string]$TunnelId)
$ErrorActionPreference='Stop'
if($TunnelId -notmatch '^tunnel_[A-Za-z0-9_-]+$'){throw 'Invalid tunnel id.'}
$client=(Get-Command tunnel-client.exe -ErrorAction Stop).Source
$node=(Get-Command node.exe -ErrorAction Stop).Source
$private=Join-Path $PSScriptRoot 'private'
New-Item -ItemType Directory -Path $private -Force|Out-Null
$keyFile=Join-Path $private 'control-plane-key.dpapi'
if(Test-Path -LiteralPath $keyFile){$secure=Get-Content -Raw -LiteralPath $keyFile|ConvertTo-SecureString}else{$secure=Read-Host 'Enter your own Tunnel runtime API key locally (hidden)' -AsSecureString;$secure|ConvertFrom-SecureString|Set-Content -LiteralPath $keyFile -Encoding UTF8}
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$old=$env:CONTROL_PLANE_API_KEY
try{
 $env:CONTROL_PLANE_API_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
 $profile=Join-Path $private 'tunnel-profile'
 $command='"'+$node+'" "'+(Join-Path $PSScriptRoot 'server.cjs')+'"'
 & $client init --sample sample_mcp_stdio_local --profile taobao --profile-dir $profile --tunnel-id $TunnelId --mcp-command $command
 if($LASTEXITCODE-ne0){throw 'Tunnel initialization failed.'}
 & $client doctor --profile taobao --profile-dir $profile --explain
 if($LASTEXITCODE-ne0){throw 'Tunnel diagnostics did not pass.'}
 Write-Host 'Starting your private Taobao MCP tunnel. Keep this window running.'
 & $client run --profile taobao --profile-dir $profile
}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$env:CONTROL_PLANE_API_KEY=$old}
