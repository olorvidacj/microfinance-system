$body = [Ordered]@{email='admin@HOSCOMCO.coop'; password='Admin@123'} | ConvertTo-Json
try {
    $result = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method Post -Body $body -ContentType 'application/json' -ErrorAction Stop
    Write-Output ($result | ConvertTo-Json -Compress)
} catch {
    Write-Output "Error: $($_.Exception.Message)"
    Write-Output ($_.Exception.Response | Get-Content -Raw)
}
