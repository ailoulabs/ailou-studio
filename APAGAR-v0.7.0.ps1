# v0.7.0: arquivos do fluxo antigo (prancha de motivos) que saem do repositório.
# Rode na raiz do repositório, depois de descompactar o zip.
$arquivos = @(
  "src/components/studio/BriefForm.tsx",
  "src/components/studio/DirectionChooser.tsx",
  "src/components/studio/DirectionDetails.tsx",
  "src/components/studio/DirectionPanel.tsx",
  "src/components/studio/MotifCard.tsx",
  "src/components/studio/PatternGrid.tsx",
  "src/components/studio/PatternCard.tsx",
  "src/components/studio/PreviewDialog.tsx",
  "src/components/studio/CollectionHeader.tsx",
  "src/components/studio/AddPieceSheet.tsx",
  "src/components/studio/PieceList.tsx",
  "src/components/studio/CutCanvas.tsx",
  "src/hooks/use-studio.ts"
)
foreach ($a in $arquivos) { if (Test-Path $a) { git rm -q $a; Write-Host "removido: $a" } }
