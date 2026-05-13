Add-Type -AssemblyName System.IO.Compression.FileSystem

$ErrorActionPreference = "Stop"

function Repair-Text {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  return $Value.Replace([char]0x00A0, " ").Trim()
}

function Get-ColIndex {
  param([string]$Reference)
  $letters = ([regex]::Match($Reference, "^[A-Z]+")).Value
  $index = 0
  foreach ($char in $letters.ToCharArray()) {
    $index = ($index * 26) + ([int][char]$char - [int][char]"A" + 1)
  }
  return $index - 1
}

function Read-XlsxRows {
  param([string]$Path)

  $zip = [IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $sharedStrings = @()
    $sharedEntry = $zip.GetEntry("xl/sharedStrings.xml")
    if ($sharedEntry) {
      $reader = [IO.StreamReader]::new($sharedEntry.Open(), [Text.Encoding]::UTF8)
      [xml]$sharedXml = $reader.ReadToEnd()
      $reader.Close()
      foreach ($item in $sharedXml.DocumentElement.ChildNodes) {
        $sharedStrings += (Repair-Text $item.InnerText)
      }
    }

    $sheetEntry = $zip.GetEntry("xl/worksheets/sheet1.xml")
    $reader = [IO.StreamReader]::new($sheetEntry.Open(), [Text.Encoding]::UTF8)
    [xml]$sheetXml = $reader.ReadToEnd()
    $reader.Close()

    $rows = @()
    foreach ($row in $sheetXml.DocumentElement.sheetData.row) {
      $valuesByIndex = @{}
      foreach ($cell in $row.c) {
        $index = Get-ColIndex $cell.r
        $value = ""
        if ($cell.v -ne $null) {
          $value = [string]$cell.v
          if ($cell.t -eq "s" -and $value -ne "") {
            $value = $sharedStrings[[int]$value]
          } else {
            $value = Repair-Text $value
          }
        } elseif ($cell.is -ne $null) {
          $value = Repair-Text $cell.is.InnerText
        }
        $valuesByIndex[$index] = $value
      }

      if ($valuesByIndex.Count -gt 0) {
        $max = ($valuesByIndex.Keys | Measure-Object -Maximum).Maximum
        $rowValues = for ($i = 0; $i -le $max; $i++) {
          if ($valuesByIndex.ContainsKey($i)) { $valuesByIndex[$i] } else { "" }
        }
        $rows += ,$rowValues
      }
    }

    return $rows
  } finally {
    $zip.Dispose()
  }
}

function Rows-ToObjects {
  param([object[]]$Rows)
  if ($Rows.Count -lt 2) { return @() }
  $headers = $Rows[0]
  $objects = @()
  foreach ($row in ($Rows | Select-Object -Skip 1)) {
    $hasValue = ($row | Where-Object { $_ -ne "" }).Count -gt 0
    if (-not $hasValue) { continue }
    $item = [ordered]@{}
    for ($i = 0; $i -lt $headers.Count; $i++) {
      $key = if ($headers[$i]) { $headers[$i] } else { "COLUNA_$($i + 1)" }
      $item[$key] = if ($i -lt $row.Count) { $row[$i] } else { "" }
    }
    $objects += [pscustomobject]$item
  }
  return $objects
}

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "source-data\DIRLOGISTICA-314837652"
$outDir = Join-Path $root "assets"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$data = [ordered]@{}
foreach ($file in @("ABERTURA_OS", "LOGISTICA", "UNIDADES", "ROTAS", "VEICULOS", "MOTORISTAS")) {
  $rows = Read-XlsxRows (Join-Path $source "$file.xlsx")
  $data[$file] = Rows-ToObjects $rows
}

$json = $data | ConvertTo-Json -Depth 12
$target = Join-Path $outDir "seed-data.js"
"window.DIRLOGISTICA_SEED = $json;" | Set-Content -LiteralPath $target -Encoding UTF8

$summary = [ordered]@{}
foreach ($key in $data.Keys) { $summary[$key] = $data[$key].Count }
$summary | ConvertTo-Json
