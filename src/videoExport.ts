import type { FrameFormat, OverlayText, VideoClip } from './types'

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
  ctx.drawImage(source, (sourceWidth - sw) / 2, (sourceHeight - sh) / 2, sw, sh, 0, 0, width, height)
}

function drawText(ctx: CanvasRenderingContext2D, width: number, height: number, text: OverlayText) {
  if (!text.title && !text.subtitle) return
  const shade = ctx.createLinearGradient(0, height * .62, 0, height)
  shade.addColorStop(0, 'rgba(18, 16, 14, 0)')
  shade.addColorStop(1, 'rgba(18, 16, 14, .72)')
  ctx.fillStyle = shade
  ctx.fillRect(0, height * .58, width, height * .42)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fffaf3'
  ctx.font = `700 ${Math.max(25, Math.round(width * .052))}px 'DM Sans', system-ui, sans-serif`
  const words = text.title.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width * .82 && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  lines.slice(0, 3).forEach((part, index) => ctx.fillText(part, width / 2, height * .80 + index * width * .06, width * .86))
  if (text.subtitle) {
    ctx.fillStyle = '#f5dfbf'
    ctx.font = `500 ${Math.max(17, Math.round(width * .029))}px 'DM Sans', system-ui, sans-serif`
    ctx.fillText(text.subtitle, width / 2, height * .91, width * .86)
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível abrir uma das imagens do projeto.'))
    image.src = url
  })
}

function loadVideo(clip: VideoClip) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.playsInline = true
    video.muted = true
    video.onloadedmetadata = () => resolve(video)
    video.onerror = () => reject(new Error(`Não foi possível abrir o vídeo “${clip.name}”.`))
    video.src = clip.url
    video.load()
  })
}

function waitFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

export async function renderAndExport(
  clips: VideoClip[],
  audioUrl: string | null,
  text: OverlayText,
  format: FrameFormat,
  onProgress: (value: number) => void,
) {
  if (!clips.length) throw new Error('Adicione pelo menos uma foto ou vídeo à sequência.')
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Este navegador não oferece gravação de vídeo. Experimente o Chrome ou o Edge atualizado.')
  }

  // Áudio: preparado ANTES de qualquer "await" para manter o gesto do toque (exigido no iOS/Safari).
  let audio: HTMLAudioElement | null = null
  let audioCtx: AudioContext | null = null
  const audioTracks: MediaStreamTrack[] = []
  if (audioUrl) {
    audio = document.createElement('audio')
    audio.src = audioUrl
    audio.loop = true
    audio.preload = 'auto'
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioCtor) {
      // Web Audio funciona em Chrome, Edge, Firefox e Safari (desktop e iOS), ao contrário de audio.captureStream().
      audioCtx = new AudioCtor()
      const source = audioCtx.createMediaElementSource(audio)
      const gain = audioCtx.createGain()
      gain.gain.value = 0.72
      const destination = audioCtx.createMediaStreamDestination()
      source.connect(gain)
      gain.connect(destination)
      audioTracks.push(...destination.stream.getAudioTracks())
      void audioCtx.resume().catch(() => undefined)
    } else {
      const capture = audio as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }
      const audioStream = capture.captureStream?.() ?? capture.mozCaptureStream?.()
      if (audioStream) audioTracks.push(...audioStream.getAudioTracks())
    }
    if (!audioTracks.length) {
      throw new Error('Este navegador não consegue incluir áudio no vídeo exportado. Experimente o Chrome, o Edge ou o Safari atualizados.')
    }
    // "Destrava" a reprodução enquanto ainda estamos dentro do gesto do usuário.
    void audio.play().catch(() => undefined)
  }

  const cleanupAudio = () => {
    audio?.pause()
    if (audioCtx && audioCtx.state !== 'closed') void audioCtx.close().catch(() => undefined)
  }

  let prepared: { clip: VideoClip; source: HTMLImageElement | HTMLVideoElement }[]
  try {
    prepared = await Promise.all(clips.map(async (clip) => ({
      clip,
      source: clip.kind === 'image' ? await loadImage(clip.url) : await loadVideo(clip),
    })))
  } catch (error) {
    cleanupAudio()
    throw error
  }
  const [width, height] = dimensions[format]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    cleanupAudio()
    throw new Error('Não foi possível preparar a imagem do vídeo.')
  }
  const videoStream = canvas.captureStream(30)
  const tracks = [...videoStream.getVideoTracks(), ...audioTracks]

  const stream = new MediaStream(tracks)
  const candidates = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
  if (!mimeType) throw new Error('Este navegador não oferece um formato de vídeo compatível para exportação.')

  const chunks: BlobPart[] = []
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 7_000_000 })
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => reject(new Error('O navegador interrompeu a gravação do vídeo.'))
  })
  recorder.start(250)

  const total = prepared.reduce((sum, item) => sum + Math.max(.25, item.clip.outPoint - item.clip.inPoint), 0)
  let elapsedAll = 0
  try {
    if (audio) {
      audio.currentTime = 0
      await audio.play().catch(() => undefined)
    }
    for (const { clip, source } of prepared) {
      const duration = Math.max(.25, clip.outPoint - clip.inPoint)
      if (clip.kind === 'video') {
        const video = source as HTMLVideoElement
        video.currentTime = Math.min(clip.inPoint, Math.max(0, video.duration - .05))
        await video.play().catch(() => undefined)
      }
      const started = performance.now()
      while (performance.now() - started < duration * 1000) {
        const elapsed = Math.min(duration, (performance.now() - started) / 1000)
        ctx.fillStyle = '#e6d5c0'
        ctx.fillRect(0, 0, width, height)
        if (clip.kind === 'image') {
          const image = source as HTMLImageElement
          drawCover(ctx, image, image.naturalWidth, image.naturalHeight, width, height)
        } else {
          const video = source as HTMLVideoElement
          if (video.readyState >= 2 && video.videoWidth) drawCover(ctx, video, video.videoWidth, video.videoHeight, width, height)
        }
        drawText(ctx, width, height, text)
        onProgress(Math.min(99, Math.round(((elapsedAll + elapsed) / total) * 100)))
        await waitFrame()
      }
      if (clip.kind === 'video') (source as HTMLVideoElement).pause()
      elapsedAll += duration
    }
    await new Promise((resolve) => setTimeout(resolve, 220))
    recorder.stop()
    await stopped
  } catch (error) {
    if (recorder.state !== 'inactive') recorder.stop()
    await stopped.catch(() => undefined)
    throw error
  } finally {
    cleanupAudio()
    stream.getTracks().forEach((track) => track.stop())
    videoStream.getTracks().forEach((track) => track.stop())
  }

  onProgress(100)
  return { blob: new Blob(chunks, { type: mimeType }), mimeType }
}
