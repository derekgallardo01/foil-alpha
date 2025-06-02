# MySQL backup script

# Database credentials
$DB_HOST = "127.0.0.1"
$DB_USER = "derek"
$DB_PASSWORD = "BEw!98Tcdcau122PFh"
$DB_NAME = "visitorDB"

# Get current timestamp
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

# Create backup directory if it doesn't exist
if (-not (Test-Path "backups")) {
    New-Item -ItemType Directory -Path "backups"
}

# Create backup file name
$BACKUP_FILE = "backups\mysql-backup-$TIMESTAMP.sql"

# Find mysqldump.exe
$MYSQL_DUMP = Get-Command mysqldump -ErrorAction SilentlyContinue
if (-not $MYSQL_DUMP) {
    Write-Error "mysqldump.exe not found. Please ensure MySQL is installed and added to PATH."
    exit 1
}

# Run mysqldump
Write-Host "Starting MySQL backup..."
& $MYSQL_DUMP.Path -h $DB_HOST -u $DB_USER -p"$DB_PASSWORD" $DB_NAME -r $BACKUP_FILE

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully. Saved to: $BACKUP_FILE"
    $SIZE = (Get-Item $BACKUP_FILE).Length
    Write-Host "Backup size: $SIZE bytes"
} else {
    Write-Error "MySQL backup failed with exit code $LASTEXITCODE"
    exit 1
}
