import type { MotionPreset } from './types'

export const motionPresets: { id: MotionPreset; label: string; description: string }[] = [
  { id: 'zoom-in', label: 'Aproximar', description: 'Valoriza os detalhes do produto.' },
  { id: 'zoom-out', label: 'Revelar', description: 'Abre a cena aos poucos.' },
  { id: 'pan-left', label: 'Panorâmica à esquerda', description: 'Desliza suavemente para a esquerda.' },
  { id: 'pan-right', label: 'Panorâmica à direita', description: 'Desliza suavemente para a direita.' },
  { id: 'pan-up', label: 'Panorâmica para cima', description: 'Desliza suavemente para cima.' },
  { id: 'pan-down', label: 'Panorâmica para baixo', description: 'Desliza suavemente para baixo.' },
  { id: 'none', label: 'Sem movimento', description: 'Mantém a foto parada.' },
]

export function drawImageWithMotion(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  preset: MotionPreset,
  progress: number,
) {
  if (!sourceWidth || !sourceHeight || !width || !height) return

  const t = Math.max(0, Math.min(1, progress))
  const eased = t * t * (3 - 2 * t)
  let scale = 1
  let offsetX = 0
  let offsetY = 0

  switch (preset) {
    case 'zoom-in':
      scale = 1.04 + eased * 0.13
      break
    case 'zoom-out':
      scale = 1.17 - eased * 0.13
      break
    case 'pan-left':
      scale = 1.12
      offsetX = (0.04 - eased * 0.08) * width
      break
    case 'pan-right':
      scale = 1.12
      offsetX = (-0.04 + eased * 0.08) * width
      break
    case 'pan-up':
      scale = 1.12
      offsetY = (0.04 - eased * 0.08) * height
      break
    case 'pan-down':
      scale = 1.12
      offsetY = (-0.04 + eased * 0.08) * height
      break
    case 'none':
      break
  }

  const coverScale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * coverScale
  const drawHeight = sourceHeight * coverScale

  ctx.save()
  ctx.translate(width / 2 + offsetX, height / 2 + offsetY)
  ctx.scale(scale, scale)
  ctx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  ctx.restore()
}
