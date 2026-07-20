/**
 * Script ini digunakan SEKALI untuk mengubah folder sesi WhatsApp
 * menjadi teks base64 yang bisa disimpan sebagai GitHub Secret.
 * 
 * Versi ini hanya mengambil file PENTING saja (tanpa cache browser),
 * sehingga ukuran file jauh lebih kecil (~1-3MB vs ~34MB sebelumnya).
 * 
 * Cara pakai: node encode-session.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sessionPath = path.join(__dirname, '.wwebjs_auth', 'session');

if (!fs.existsSync(sessionPath)) {
    console.error('❌ Folder sesi tidak ditemukan!');
    console.error('   Pastikan kamu sudah menjalankan "node index.js" dan scan QR terlebih dahulu.');
    process.exit(1);
}

// Folder-folder yang TIDAK perlu di-backup (cache browser, tidak berpengaruh ke sesi WA)
const EXCLUDE_DIRS = [
    'Cache',           // HTTP Cache (~10MB)
    'Code Cache',      // Script cache (~14MB)  
    'Service Worker',  // Service worker cache (~17MB)
    'GPUCache',        // GPU shader cache
    'DawnWebGPUCache', // WebGPU cache
    'DawnGraphiteCache',
    'CrashpadMetrics', 
    'blob_storage',
    'BrowserMetrics-spare.pma',
    'Crashpad',
];

const zipPath = path.join(__dirname, 'wa_session.zip');

// Hapus zip lama kalau ada
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

console.log('🔍 Menganalisis ukuran sesi...');

// Hitung ukuran total folder sesi
const getTotalSize = (dirPath) => {
    if (!fs.existsSync(dirPath)) return 0;
    let total = 0;
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) total += getTotalSize(fullPath);
        else total += fs.statSync(fullPath).size;
    }
    return total;
};

const totalSizeMB = (getTotalSize(sessionPath) / 1024 / 1024).toFixed(1);
console.log(`📦 Ukuran total folder sesi: ${totalSizeMB} MB`);
console.log(`🗜️  Mengkompres (tanpa cache browser)...`);

try {
    // Buat script PowerShell untuk zip dengan exclusion
    const excludePattern = EXCLUDE_DIRS.map(d => `'${d}'`).join(', ');
    
    const psScript = `
$source = '${sessionPath.replace(/\\/g, '\\\\')}';
$dest = '${zipPath.replace(/\\/g, '\\\\')}';
$excludes = @(${excludePattern});

Add-Type -Assembly 'System.IO.Compression.FileSystem';
$zip = [System.IO.Compression.ZipFile]::Open($dest, 'Create');

$files = Get-ChildItem -Path $source -Recurse -File | Where-Object {
    $relativePath = $_.FullName.Substring($source.Length + 1);
    $parts = $relativePath.Split('\\\\');
    $skip = $false;
    foreach ($part in $parts) {
        if ($excludes -contains $part) { $skip = $true; break; }
    }
    -not $skip
};

$count = 0;
foreach ($file in $files) {
    $entryName = $file.FullName.Substring($source.Length + 1).Replace('\\\\', '/');
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName, 'Optimal') | Out-Null;
    $count++;
}
$zip.Dispose();
Write-Host "Total files: $count";
`;

    const psScriptPath = path.join(__dirname, '_temp_zip.ps1');
    fs.writeFileSync(psScriptPath, psScript);
    
    const result = execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'pipe' }).toString();
    fs.unlinkSync(psScriptPath); // Hapus script temp
    
    const zipSizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    console.log(`✅ Zip berhasil dibuat! Ukuran: ${zipSizeMB} MB (dari ${totalSizeMB} MB)`);
    
    // Encode zip ke base64
    console.log('🔄 Mengubah ke base64...');
    const zipBuffer = fs.readFileSync(zipPath);
    const base64String = zipBuffer.toString('base64');
    
    // Simpan ke file teks
    const outputPath = path.join(__dirname, 'session_base64.txt');
    fs.writeFileSync(outputPath, base64String);
    
    // Hapus file zip sementara
    fs.unlinkSync(zipPath);
    
    const outputSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║           ✅ ENCODE SESI BERHASIL!               ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📄 File output: session_base64.txt (${outputSizeMB} MB)`);
    console.log('');
    console.log('📋 Langkah selanjutnya:');
    console.log('1. Buka file "session_base64.txt" yang baru dibuat');
    console.log('2. Salin SEMUA isinya (teks panjang)');
    console.log('3. Buka GitHub repo → Settings → Secrets → Actions');
    console.log('4. Klik "New repository secret"');
    console.log('5. Name: WA_SESSION_BASE64');
    console.log('6. Secret: paste semua teks dari session_base64.txt');
    console.log('7. Klik "Add secret"');
    console.log('');
    console.log('Setelah itu, GitHub Actions bisa menjalankan bot tanpa scan QR!');

} catch (err) {
    // Bersihkan file temp kalau ada error
    const psScriptPath = path.join(__dirname, '_temp_zip.ps1');
    if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    console.error('❌ Gagal:', err.message);
}
