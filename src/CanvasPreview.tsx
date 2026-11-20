import { useEffect, useRef, useState } from 'react'
import type { FrameFormat, VideoClip } from './types'
import { drawImageWithMotion } from './motion'

interface Props {
  clip: VideoClip | null
  localTime: number
  playing: boolean
  format: FrameFormat
  title: string
  subtitle: string
}

const dimensions: Record<FrameFormat, [number, number]> = {
  portrait: [720, 1280],
  square: [720, 720],
  landscape: [1280, 720],
}

function drawCover(ctx: CanvasRenderingContext2D, source: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number, height: number) {
  if (!sourceWidth || !sourceHeight) return
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const sw = width / scale
  const sh = height / scale
  const sx = (sourceWidth - sw) / 2
  const sy = (sourceHeight - sh) / 2
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

export function CanvasPreview({ clip, localTime, playing, format, title, subtitle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [frameReady, setFrameReady] = useState(0)
  const [width, height] = dimensions[format]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = width
    canvas.height = height
  }, [width, height])

  useEffect(() => {
    imageRef.current = null
    const video = videoRef.current
    if (!clip || clip.kind !== 'video' || !video) {
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
      setFrameReady((value) => value + 1)
      return
    }
    video.src = clip.url
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(clip.outPoint, clip.inPoint + localTime)
      setFrameReady((value) => value + 1)
      if (playing) void video.play().catch(() => undefined)
    }
    video.load()
    return () => {
      video.pause()
      video.onloadedmetadata = null
    }
  }, [clip?.id, clip?.url])

  useEffect(() => {
    if (!clip || clip.kind !== 'image') {
      imageRef.current = null
      setFrameReady((value) => value + 1)
      return
    }
    const image = new Image()
    image.onload = () => {
      imageRef.current = image
      setFrameReady((value) => value + 1)
    }
    image.src = clip.url
    return () => { image.onload = null }
  }, [clip?.id, clip?.url])

  useEffect(() => {
    const video = videoRef.current
    if (!clip || clip.kind !== 'video' || !video) return
    const target = Math.min(clip.outPoint, clip.inPoint + localTime)
    if (playing) {
      if (video.readyState >= 2 && Math.abs(video.currentTime - target) > 0.45) video.currentTime = target
      void video.play().catch(() => undefined)
    } else {
      video.pause()
      if (video.readyState >= 1 && Math.abs(video.currentTime - target) > 0.08) video.currentTime = target
    }
  }, [clip?.id, clip?.inPoint, clip?.outPoint, localTime, playing])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let frame = 0
    const render = () => {
      const w = canvas.width
      const h = canvas.height
      const gradient = ctx.createLinearGradient(0, 0, w, h)
      gradient.addColorStop(0, '#efe1ce')
      gradient.addColorStop(1, '#d3b89a')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)

      if (clip?.kind === 'image' && imageRef.current) {
        const duration = Math.max(0.25, clip.outPoint - clip.inPoint)
        drawImageWithMotion(ctx, imageRef.current, imageRef.current.naturalWidth, imageRef.current.naturalHeight, w, h, clip.motion, localTime / duration)
      } else if (clip?.kind === 'video') {
        const video = videoRef.current
        if (video && video.readyState >= 2 && video.videoWidth) drawCover(ctx, video, video.videoWidth, video.videoHeight, w, h)
      } else if (!clip) {
        ctx.fillStyle = 'rgba(255,255,255,.34)'
        ctx.beginPath()
        ctx.arc(w * .5, h * .42, Math.min(w, h) * .22, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#88613d'
        ctx.textAlign = 'center'
        ctx.font = `600 ${Math.max(20, w * .044)}px 'DM Sans', system-ui, sans-serif`
        ctx.fillText('Sua vitrine começa aqui', w / 2, h * .43)
        ctx.fillStyle = 'rgba(75,57,40,.7)'
        ctx.font = `400 ${Math.max(14, w * .024)}px 'DM Sans', system-ui, sans-serif`
        ctx.fillText('Adicione uma foto ou vídeo', w / 2, h * .48)
      }

      if (title || subtitle) {
        const overlay = ctx.createLinearGradient(0, h * .62, 0, h)
        overlay.addColorStop(0, 'rgba(19, 17, 15, 0)')
        overlay.addColorStop(1, 'rgba(18, 16, 14, .72)')
        ctx.fillStyle = overlay
        ctx.fillRect(0, h * .58, w, h * .42)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const titleSize = Math.max(25, Math.round(w * .052))
        const subtitleSize = Math.max(17, Math.round(w * .029))
        ctx.font = `700 ${titleSize}px 'DM Sans', system-ui, sans-serif`
        const titleLines = wrap(ctx, title, w * .82)
        if (titleLines.length) {
          ctx.fillStyle = '#fffaf3'
          titleLines.forEach((line, index) => ctx.fillText(line, w / 2, h * .80 + index * titleSize * 1.12, w * .86))
        }
        if (subtitle) {
          ctx.font = `500 ${subtitleSize}px 'DM Sans', system-ui, sans-serif`
          ctx.fillStyle = '#f5dfbf'
          ctx.fillText(subtitle, w / 2, h * .91, w * .86)
        }
      }
      if (playing) frame = requestAnimationFrame(render)
    }
    render()
    return () => cancelAnimationFrame(frame)
  }, [clip?.id, clip?.motion, clip?.inPoint, clip?.outPoint, format, frameReady, height, localTime, playing, title, subtitle, width])

  return (
    <div className={`canvas-frame canvas-${format}`}>
      <canvas ref={canvasRef} aria-label="Prévia do vídeo" />
      <video ref={videoRef} className="source-video" playsInline muted preload="auto" />
    </div>
  )
}
