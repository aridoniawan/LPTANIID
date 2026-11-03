Add-Type -AssemblyName System.Drawing

$src = 'C:\Users\ari\.qoder\tmp\D--Project-LPTANI-WEB\images\d5494fe8-17d4-420b-8c0f-0e6ffae9abf4\8a3f27b5-1bee-45b1-97bc-a959d048f438.png'
$outDir = 'D:\Project\LPTANI_WEB\mockups\'
$bmp = [System.Drawing.Bitmap]::FromFile($src)
$W = 1170

function Compose([string]$name, [double]$chartScale, [double]$cardScale) {
  $headerH = 212
  $gap1 = 24
  $chartSrcY = 255; $chartSrcH = 400
  $chartH = [int]($chartSrcH * $chartScale)
  $gap2 = 28
  $tfY = 748; $tfH = 68
  $gap3 = 22
  $cardSrcY = 850; $cardSrcH = 305
  $cardH = [int]($cardSrcH * $cardScale)
  $cardW = [int]($W * $cardScale)
  $padBottom = 20

  $H = $headerH + $gap1 + $chartH + $gap2 + $tfH + $gap3 + $cardH + $padBottom
  $canvas = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::FromArgb(6, 4, 17))

  # header (unchanged, original size)
  $r = New-Object System.Drawing.Rectangle(0, 0, $W, $headerH)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, $W, $headerH)), $r, [System.Drawing.GraphicsUnit]::Pixel)

  # chart (scaled up, left-anchored)
  $y0 = $headerH + $gap1
  $r = New-Object System.Drawing.Rectangle(0, $chartSrcY, $W, $chartSrcH)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, $y0, $W, $chartH)), $r, [System.Drawing.GraphicsUnit]::Pixel)

  # price tag at right end of dashed line (scaled with chart)
  $tagX = 950; $tagY = 514; $tagW = 199; $tagH = 50
  $tw = [int]($tagW * $chartScale); $th = [int]($tagH * $chartScale)
  $tx = $W - $tw - 8
  $ty = [int]($y0 + (($tagY - $chartSrcY) * $chartScale))
  $r = New-Object System.Drawing.Rectangle($tagX, $tagY, $tagW, $tagH)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle($tx, $ty, $tw, $th)), $r, [System.Drawing.GraphicsUnit]::Pixel)

  # timeframe row (unchanged)
  $y1 = $y0 + $chartH + $gap2
  $r = New-Object System.Drawing.Rectangle(0, $tfY, $W, $tfH)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, $y1, $W, $tfH)), $r, [System.Drawing.GraphicsUnit]::Pixel)

  # bottom card (scaled down, centered)
  $y2 = $y1 + $tfH + $gap3
  $cx = [int](($W - $cardW) / 2)
  $r = New-Object System.Drawing.Rectangle(0, $cardSrcY, $W, $cardSrcH)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle($cx, $y2, $cardW, $cardH)), $r, [System.Drawing.GraphicsUnit]::Pixel)

  $canvas.Save($outDir + $name, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $canvas.Dispose()
  Write-Host ("SAVED " + $name + ' ' + $W + 'x' + $H)
}

Compose 'vrax-mockup-a.png' 1.30 0.68
Compose 'vrax-mockup-b.png' 1.45 0.60
$bmp.Dispose()
