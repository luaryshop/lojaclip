import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines, Check, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Clock3,
  Film, ImagePlus, Layers3, Music2, Pause, Play, Plus, Scissors,
  Sparkles, Trash2, Type, Upload, Volume2, WandSparkles, X,
} from 'lucide-react'
import { CanvasPreview } from './CanvasPreview'
import { MotionPanel } from './MotionPanel'
import { clipAtTime, clipLength, totalLength } from './types'
import type { FrameFormat, MediaAsset, MediaKind, MotionPreset, VideoClip } from './types'
import { renderAndExport } from './videoExport'

type Panel = 'media' | 'text' | 'audio' | 'motion'

const formatOptions: { key: FrameFormat; title: string; subtitle: string }[] = [
  { key: 'portrait', title: 'Retrato', subtitle: '9:16' },
  { key: 'square', title: 'Quadrado', subtitle: '1:1' },
  { key: 'landscape', title: 'Paisagem', subtitle: '16:9' },
]

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0')
  const remainder = Math.floor(safe % 60).toString().padStart(2, '0')
  const tenths = Math.floor((safe % 1) * 10)
  return `${minutes}:${remainder}.${tenths}`
}

function probeDuration(url: string, kind: MediaKind) {
  if (kind === 'image') return Promise.resolve(3)
  return new Promise<number>((resolve) => {
    const media = kind === 'video' ? document.createElement('video') : document.createElement('audio')
    media.preload = 'metadata'
    let settled = false
    let timeout = 0
    const done = (duration: number) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      media.removeAttribute('src')
      media.load()
      resolve(Number.isFinite(duration) && duration > 0 ? duration : (kind === 'video' ? 5 : 30))
    }
    media.onloadedmetadata = () => done(media.duration)
    media.onerror = () => done(kind === 'video' ? 5 : 30)
    media.src = url
    media.load()
    timeout = window.setTimeout(() => done(kind === 'video' ? 5 : 30), 9000)
  })
}

function makeClip(asset: MediaAsset): VideoClip {
  const stillDuration = asset.kind === 'image' ? 5 : asset.duration
  return {
    id: crypto.randomUUID(),
    assetId: asset.id,
    name: asset.name,
    url: asset.url,
    kind: asset.kind as 'image' | 'video',
    motion: asset.kind === 'image' ? 'zoom-in' : 'none',
    sourceDuration: stillDuration,
    inPoint: 0,
    outPoint: stillDuration,
  }
}

export default function App() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [clips, setClips] = useState<VideoClip[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('media')
  const [format, setFormat] = useState<FrameFormat>('portrait')
  const [titleText, setTitleText] = useState('')
  const [subtitleText, setSubtitleText] = useState('')
  const [audioAssetId, setAudioAssetId] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [draggingFile, setDraggingFile] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [notice, setNotice] = useState('')
  const [projectName, setProjectName] = useState('Vídeo sem título')
  const fileRef = useRef<HTMLInputElement>(null)
  const totalDuration = useMemo(() => totalLength(clips), [clips])
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null
  const audioAsset = assets.find((asset) => asset.id === audioAssetId) ?? null
  const active = clipAtTime(clips, playhead)
  const activeClip = active?.clip ?? null
  const localTime = active?.localTime ?? 0
  const selectedClipDuration = selectedClip ? clipLength(selectedClip) : 0
  const selectedIndex = clips.findIndex((clip) => clip.id === selectedClipId)
  const [previewMuted, setPreviewMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    if (audioAsset) {
      audio.src = audioAsset.url
      audio.load()
    } else {
      audio.removeAttribute('src')
      audio.load()
    }
    return () => audio.pause()
  }, [audioAsset?.url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioAsset) return
    audio.muted = previewMuted
    if (playing) {
      if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = playhead % audio.duration
      void audio.play().catch(() => setNotice('O navegador bloqueou a reprodução da faixa de áudio.'))
    } else {
      audio.pause()
    }
  }, [playing, audioAsset?.id, previewMuted])

  useEffect(() => {
    if (!playing) return
    const started = performance.now() - playhead * 1000
    let raf = 0
    const tick = () => {
      const current = (performance.now() - started) / 1000
      if (current >= totalDuration) {
        setPlayhead(totalDuration)
        setPlaying(false)
        return
      }
      setPlayhead(current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, totalDuration])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 6500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const importFiles = async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/'))
    if (!accepted.length) {
      setNotice('Escolha fotos, vídeos ou áudios compatíveis.')
      return
    }
    const imported = await Promise.all(accepted.map(async (file): Promise<MediaAsset> => {
      const kind: MediaKind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio'
      const url = URL.createObjectURL(file)
      const duration = await probeDuration(url, kind)
      return { id: crypto.randomUUID(), file, name: file.name, url, kind, duration }
    }))
    setAssets((current) => [...current, ...imported])
    const visuals = imported.filter((asset) => asset.kind !== 'audio')
    if (visuals.length) {
      const newClips = visuals.map(makeClip)
      setClips((current) => [...current, ...newClips])
      setSelectedClipId(newClips[newClips.length - 1]?.id ?? null)
      setPlayhead(totalDuration + totalLength(newClips.slice(0, -1)))
    }
    const firstAudio = imported.find((asset) => asset.kind === 'audio')
    if (firstAudio) setAudioAssetId(firstAudio.id)
    setPanel(firstAudio && visuals.length === 0 ? 'audio' : 'media')
    setNotice(`${imported.length} ${imported.length === 1 ? 'arquivo adicionado' : 'arquivos adicionados'} ao projeto.`)
  }

  const addAsset = (asset: MediaAsset) => {
    if (asset.kind === 'audio') {
      setAudioAssetId(asset.id)
      setPanel('audio')
      setNotice(`“${asset.name}” foi adicionada à trilha de áudio.`)
      return
    }
    const clip = makeClip(asset)
    const selectedIndex = clips.findIndex((item) => item.id === selectedClipId)
    const insertionIndex = selectedIndex < 0 ? clips.length : selectedIndex + 1
    const startAt = clips.slice(0, insertionIndex).reduce((sum, item) => sum + clipLength(item), 0)
    setClips((current) => {
      const next = [...current]
      next.splice(Math.min(insertionIndex, next.length), 0, clip)
      return next
    })
    setSelectedClipId(clip.id)
    setPlayhead(startAt)
    setPanel('media')
    setNotice(`“${asset.name}” foi adicionada à sequência.`)
  }

  const updateClip = (id: string, patch: Partial<VideoClip>) => {
    setClips((current) => current.map((clip) => clip.id === id ? { ...clip, ...patch } : clip))
  }

  const updatePhotoDuration = (id: string, duration: number) => {
    const safeDuration = Math.max(2, Math.min(10, Math.round(duration * 2) / 2))
    setClips((current) => current.map((clip) => clip.id === id && clip.kind === 'image'
      ? { ...clip, sourceDuration: safeDuration, inPoint: 0, outPoint: safeDuration }
      : clip))
  }

  const applyMotionToPhotos = (motion: MotionPreset) => {
    const photoCount = clips.filter((clip) => clip.kind === 'image').length
    if (!photoCount) {
      setNotice('Adicione uma foto à sequência para aplicar movimento.')
      return
    }
    setClips((current) => current.map((clip) => clip.kind === 'image' ? { ...clip, motion } : clip))
    setNotice(`Movimento aplicado a ${photoCount} ${photoCount === 1 ? 'foto' : 'fotos'}.`)
  }

  const selectClip = (clip: VideoClip) => {
    setSelectedClipId(clip.id)
    const index = clips.findIndex((item) => item.id === clip.id)
    const start = clips.slice(0, index).reduce((sum, item) => sum + clipLength(item), 0)
    setPlayhead(start)
  }

  const removeClip = (id: string) => {
    const index = clips.findIndex((clip) => clip.id === id)
    const next = clips.filter((clip) => clip.id !== id)
    setClips(next)
    setSelectedClipId(next[Math.min(Math.max(0, index), next.length - 1)]?.id ?? null)
    setPlayhead(Math.min(playhead, totalLength(next)))
  }

  const reorderClips = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setClips((current) => {
      const from = current.findIndex((clip) => clip.id === fromId)
      const to = current.findIndex((clip) => clip.id === toId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const moveClip = (id: string, direction: -1 | 1) => {
    setClips((current) => {
      const from = current.findIndex((clip) => clip.id === id)
      const to = from + direction
      if (from < 0 || to < 0 || to >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const onTimelineDrop = (event: React.DragEvent<HTMLDivElement>, targetClipId?: string) => {
    event.preventDefault()
    const clipId = event.dataTransfer.getData('application/x-vitrine-clip')
    const assetId = event.dataTransfer.getData('application/x-vitrine-asset')
    if (clipId && targetClipId) reorderClips(clipId, targetClipId)
    if (assetId) {
      const asset = assets.find((item) => item.id === assetId)
      if (asset) addAsset(asset)
    }
  }

  const addTextPreset = (kind: 'title' | 'offer') => {
    if (kind === 'title') {
      setTitleText('Sua nova peça favorita')
      setSubtitleText('Feita para brilhar todos os dias')
    } else {
      setTitleText('Um presente inesquecível')
      setSubtitleText('Escolha o seu agora')
    }
  }

  const togglePlayback = () => {
    if (!clips.length) {
      setNotice('Importe uma foto ou vídeo para começar.')
      return
    }
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    const startAt = playhead >= totalDuration ? 0 : playhead
    if (playhead >= totalDuration) setPlayhead(0)
    if (audioAsset && audioRef.current) {
      const audio = audioRef.current
      if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = startAt % audio.duration
      audio.muted = previewMuted
      void audio.play().catch(() => setNotice('O navegador bloqueou a reprodução da faixa de áudio.'))
    }
    setPlaying(true)
  }

  const startExport = async () => {
    if (!clips.length || exporting) return
    setExporting(true)
    setExportProgress(0)
    setNotice('')
    try {
      const result = await renderAndExport(clips, audioAsset?.url ?? null, { title: titleText, subtitle: subtitleText }, format, setExportProgress)
      const extension = result.mimeType.includes('mp4') ? 'mp4' : 'webm'
      const safeName = projectName.trim().replace(/[^a-zA-Z0-9À-ÿ _-]/g, '').replace(/\s+/g, '-') || 'vitrine-clip'
      const downloadUrl = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `${safeName}.${extension}`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000)
      const shape = format === 'portrait' ? '9:16' : format === 'square' ? '1:1' : '16:9'
      const formatNotice = extension === 'webm' ? ' Alguns marketplaces podem exigir MP4; confira as regras do canal.' : ''
      setNotice(`Vídeo exportado em ${extension.toUpperCase()} · ${shape} · 720p · 30 fps. O download começou.${formatNotice}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível exportar o vídeo.')
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }

  const resetProject = () => {
    audioRef.current?.pause()
    assets.forEach((asset) => URL.revokeObjectURL(asset.url))
    setAssets([])
    setClips([])
    setSelectedClipId(null)
    setAudioAssetId(null)
    setTitleText('')
    setSubtitleText('')
    setProjectName('Vídeo sem título')
    setPlayhead(0)
    setPlaying(false)
    setPanel('media')
    setNotice('Novo vídeo pronto. Importe suas fotos e clipes para começar.')
  }

  const clipWidths = clips.map((clip) => Math.max(112, Math.min(240, clipLength(clip) * 62)))
  const activePosition = active ? clipWidths.slice(0, clips.findIndex((clip) => clip.id === active.clip.id)).reduce((sum, width) => sum + width, 0) + Math.min(1, active.localTime / clipLength(active.clip)) * (clipWidths[clips.findIndex((clip) => clip.id === active.clip.id)] ?? 0) : 0
  const timelineWidth = Math.max(560, clipWidths.reduce((sum, width) => sum + width, 0) + 80)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Clapperboard size={19} strokeWidth={2.1} /></div>
          <span>vitrine<span className="brand-light">clip</span></span>
        </div>
        <div className="topbar-divider" />
        <div className="project-heading">
          <input aria-label="Nome do projeto" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          <span className="local-badge" title="O projeto atual não é salvo automaticamente"><span /> Mídia local · sessão atual</span>
        </div>
        <div className="topbar-actions">
          <button className="new-project-button" onClick={resetProject}><Plus size={15} /> Novo vídeo</button>
          <button className="export-button" onClick={startExport} disabled={!clips.length || exporting}>
            {exporting ? <><span className="spinner" /> Exportando {exportProgress}%</> : <><Upload size={15} /> Exportar vídeo</>}
          </button>
        </div>
      </header>

      <div className="workspace">
        <nav className="tool-rail" aria-label="Ferramentas do projeto">
          <div className="rail-stack">
            <button className={`rail-button ${panel === 'media' ? 'active' : ''}`} onClick={() => setPanel('media')} title="Mídia"><Layers3 size={19} /><span>Mídia</span></button>
            <button className={`rail-button ${panel === 'text' ? 'active' : ''}`} onClick={() => setPanel('text')} title="Texto"><Type size={19} /><span>Texto</span></button>
            <button className={`rail-button ${panel === 'motion' ? 'active' : ''}`} onClick={() => setPanel('motion')} title="Movimento"><WandSparkles size={19} /><span>Movimento</span></button>
            <button className={`rail-button ${panel === 'audio' ? 'active' : ''}`} onClick={() => setPanel('audio')} title="Áudio"><Music2 size={19} /><span>Áudio</span></button>
          </div>
          <div className="rail-bottom"><div className="rail-avatar">VC</div></div>
        </nav>

        <aside className="library-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ESTÚDIO DE CRIAÇÃO</p>
              <h1>{panel === 'media' ? 'Sua mídia' : panel === 'text' ? 'Textos' : panel === 'audio' ? 'Trilha de áudio' : 'Movimento'}</h1>
            </div>
          </div>

          {panel === 'media' && (
            <>
              <button className={`upload-zone ${draggingFile ? 'dragging' : ''}`} onClick={() => fileRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDraggingFile(true) }}
                onDragLeave={() => setDraggingFile(false)}
                onDrop={(event) => { event.preventDefault(); setDraggingFile(false); void importFiles(event.dataTransfer.files) }}>
                <span className="upload-icon"><ImagePlus size={19} /></span>
                <strong>Importar fotos e vídeos</strong>
                <span>ou solte seus arquivos aqui</span>
                <span className="upload-formats">JPG · PNG · MP4 · MOV · MP3 · WAV</span>
              </button>
              <div className="library-subheading"><span>ARQUIVOS DO PROJETO</span><span>{assets.length.toString().padStart(2, '0')}</span></div>
              {assets.length === 0 ? (
                <div className="empty-library"><div className="empty-icon"><Film size={19} /></div><strong>Seu projeto começa aqui</strong><p>Adicione fotos dos produtos, vídeos e uma trilha para montar seu anúncio.</p></div>
              ) : (
                <div className="asset-list">
                  {assets.map((asset) => (
                    <article className="asset-card" key={asset.id} draggable onDragStart={(event) => event.dataTransfer.setData('application/x-vitrine-asset', asset.id)}>
                      <div className={`asset-thumb asset-${asset.kind}`}>
                        {asset.kind === 'image' ? <img src={asset.url} alt="" /> : asset.kind === 'video' ? <><Film size={18} /><span>{formatTime(asset.duration)}</span></> : <><AudioLines size={18} /><span>ÁUDIO</span></>}
                      </div>
                      <div className="asset-info"><strong title={asset.name}>{asset.name}</strong><span>{asset.kind === 'image' ? 'Imagem · foto' : asset.kind === 'video' ? `Vídeo · ${formatTime(asset.duration)}` : `Áudio · ${formatTime(asset.duration)}`}</span></div>
                      <button className="asset-add" onClick={() => addAsset(asset)} title={asset.kind === 'audio' ? 'Usar como trilha' : 'Adicionar à sequência'}>
                        {asset.kind === 'audio' ? (audioAssetId === asset.id ? <Check size={16} /> : <Music2 size={16} />) : <Plus size={17} />}
                      </button>
                    </article>
                  ))}
                </div>
              )}
              <div className="library-tip"><Sparkles size={15} /><span>Arraste um arquivo até a linha do tempo para adicionar.</span></div>
            </>
          )}

          {panel === 'text' && (
            <div className="text-presets">
              <p className="section-caption">MODELOS DE TEXTO</p>
              <button className="preset-card" onClick={() => addTextPreset('title')}><span className="preset-preview title-preview">Seu produto<br />em destaque</span><span><strong>Destaque do produto</strong><small>Nome + descrição curta</small></span><Plus size={16} /></button>
              <button className="preset-card" onClick={() => addTextPreset('offer')}><span className="preset-preview offer-preview">OFERTA<br /><b>ESPECIAL</b></span><span><strong>Oferta especial</strong><small>Chamada para ação</small></span><Plus size={16} /></button>
              <div className="text-panel-note"><Type size={16} /><p>Edite as frases no painel <b>Texto e acabamento</b> ao lado da prévia.</p></div>
            </div>
          )}

          {panel === 'audio' && (
            <div className="audio-library">
              <p className="section-caption">SUAS FAIXAS</p>
              {assets.filter((asset) => asset.kind === 'audio').length === 0 ? (
                <div className="empty-library audio-empty"><div className="empty-icon"><Music2 size={19} /></div><strong>Nenhum áudio por enquanto</strong><p>Importe uma música ou narração do seu computador. Ela será mantida localmente.</p><button onClick={() => fileRef.current?.click()} className="secondary-button"><Plus size={15} /> Importar áudio</button></div>
              ) : assets.filter((asset) => asset.kind === 'audio').map((asset) => (
                <button className={`audio-asset ${audioAssetId === asset.id ? 'selected' : ''}`} key={asset.id} onClick={() => setAudioAssetId(asset.id)}>
                  <span className="audio-icon"><Music2 size={17} /></span><span className="audio-name"><b>{asset.name}</b><small>{formatTime(asset.duration)}</small></span>{audioAssetId === asset.id ? <Check size={16} /> : <Plus size={16} />}
                </button>
              ))}
              <button className="secondary-button audio-upload" onClick={() => fileRef.current?.click()}><Upload size={15} /> Importar música ou narração</button>
              <p className="audio-note">Use apenas trilhas e gravações que você tem direito de publicar nos seus anúncios.</p>
            </div>
          )}
          {panel === 'motion' && (
            <MotionPanel
              clips={clips}
              selectedClip={selectedClip}
              onSelectClip={selectClip}
              onSetMotion={(id, motion) => updateClip(id, { motion })}
              onSetDuration={updatePhotoDuration}
              onApplyToPhotos={applyMotionToPhotos}
              onOpenMedia={() => setPanel('media')}
            />
          )}
        </aside>

        <main className="stage-panel">
          <div className="stage-toolbar">
            <div className="stage-breadcrumb"><span>Meu estúdio</span><ChevronRight size={14} /><b>{projectName || 'Vídeo sem título'}</b></div>
            <div className="format-picker" aria-label="Formato do vídeo">
              {formatOptions.map((option) => <button key={option.key} className={format === option.key ? 'chosen' : ''} onClick={() => setFormat(option.key)} title={`${option.title} ${option.subtitle}`}><span className={`format-glyph ${option.key}`} />{option.subtitle}</button>)}
            </div>
            <button className="more-button" onClick={() => setNotice('Dica: use o formato retrato 9:16 para anúncios verticais e vídeos curtos.')}><ChevronDown size={17} /></button>
          </div>

          <div className="preview-area">
            <div className="preview-topline"><span><span className="live-dot" /> PRÉVIA</span><span>{format === 'portrait' ? '9:16' : format === 'square' ? '1:1' : '16:9'} <span className="dot-divider">·</span> 720p</span></div>
            <CanvasPreview clip={activeClip} localTime={localTime} playing={playing} format={format} title={titleText} subtitle={subtitleText} />
            <div className="preview-controls">
              <button className="control-play" onClick={togglePlayback} aria-label={playing ? 'Pausar prévia' : 'Reproduzir prévia'}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
              <span className="time-readout">{formatTime(playhead)} <span>/</span> {formatTime(totalDuration)}</span>
              <input className="seek-slider" aria-label="Posição da prévia" type="range" min="0" max={Math.max(totalDuration, .1)} step="0.01" value={Math.min(playhead, totalDuration)} onChange={(event) => { setPlaying(false); setPlayhead(Number(event.target.value)) }} disabled={!clips.length} />
              <button className={`icon-button preview-volume ${previewMuted ? 'muted' : ''}`} onClick={() => setPreviewMuted((value) => !value)} aria-label={previewMuted ? 'Ativar áudio da prévia' : 'Silenciar prévia'} title={audioAsset ? `Trilha: ${audioAsset.name}` : 'Sem trilha de áudio'}><Volume2 size={16} /></button>
            </div>
          </div>
          <div className="stage-footnote"><Sparkles size={13} /><span>Arquivos ficam no navegador e não vão para a nuvem. O projeto não é salvo automaticamente.</span></div>
        </main>

        <aside className="inspector-panel">
          <div className="inspector-heading"><div><p className="eyebrow">AJUSTES DO VÍDEO</p><h2>Texto e acabamento</h2></div><WandSparkles size={18} className="inspector-sparkle" /></div>
          <div className="inspector-scroll">
            <section className="inspector-section">
              <div className="section-heading"><span className="section-icon"><Type size={15} /></span><div><b>Texto sobre o vídeo</b><small>Aparece na parte inferior</small></div></div>
              <label className="field-label" htmlFor="title-field">Título</label>
              <input id="title-field" className="text-input" value={titleText} onChange={(event) => setTitleText(event.target.value)} placeholder="Ex.: Brilho para todos os dias" maxLength={80} />
              <label className="field-label second-label" htmlFor="subtitle-field">Complemento</label>
              <input id="subtitle-field" className="text-input" value={subtitleText} onChange={(event) => setSubtitleText(event.target.value)} placeholder="Ex.: Conheça a coleção" maxLength={80} />
              <span className="field-hint">Mantenha a frase curta para facilitar a leitura.</span>
            </section>

            <section className="inspector-section format-section">
              <div className="section-heading"><span className="section-icon"><Clapperboard size={15} /></span><div><b>Formato de saída</b><small>Escolha a proporção do anúncio</small></div></div>
              <div className="format-cards">
                {formatOptions.map((option) => <button key={option.key} className={`format-card ${format === option.key ? 'selected' : ''}`} onClick={() => setFormat(option.key)}><span className={`format-card-icon ${option.key}`} /><b>{option.title}</b><small>{option.subtitle}</small></button>)}
              </div>
              <div className="quality-note"><Check size={14} /><span>720p · 30 fps · MP4 se disponível; senão WebM</span></div>
            </section>

            <section className="inspector-section clip-section">
              <div className="section-heading"><span className="section-icon"><Scissors size={15} /></span><div><b>Ajuste do clipe</b><small>{selectedClip ? selectedClip.name : 'Selecione um clipe na linha do tempo'}</small></div></div>
              {selectedClip ? <>
                {selectedClip.kind === 'image' ? (
                  <>
                    <div className="clip-duration"><Clock3 size={14} /><span>Duração da foto animada</span><b>{formatTime(selectedClipDuration)}</b></div>
                    <button className="motion-open-link" onClick={() => setPanel('motion')}><WandSparkles size={14} /> Ajustar movimento e duração</button>
                  </>
                ) : (
                  <>
                    <label className="trim-label"><span>Início</span><b>{formatTime(selectedClip.inPoint)}</b></label>
                    <input className="trim-slider" type="range" min="0" max={Math.max(0.25, selectedClip.outPoint - .25)} step="0.1" value={selectedClip.inPoint} onChange={(event) => updateClip(selectedClip.id, { inPoint: Math.min(Number(event.target.value), selectedClip.outPoint - .25) })} />
                    <label className="trim-label end-trim"><span>Fim</span><b>{formatTime(selectedClip.outPoint)}</b></label>
                    <input className="trim-slider" type="range" min={Math.min(selectedClip.sourceDuration, selectedClip.inPoint + .25)} max={selectedClip.sourceDuration} step="0.1" value={selectedClip.outPoint} onChange={(event) => updateClip(selectedClip.id, { outPoint: Math.max(Number(event.target.value), selectedClip.inPoint + .25) })} />
                    <div className="clip-duration"><Clock3 size={14} /><span>Duração na sequência</span><b>{formatTime(selectedClipDuration)}</b></div>
                  </>
                )}
                <div className="clip-move">
                  <button onClick={() => moveClip(selectedClip.id, -1)} disabled={selectedIndex <= 0}><ChevronLeft size={14} /> Mover antes</button>
                  <button onClick={() => moveClip(selectedClip.id, 1)} disabled={selectedIndex >= clips.length - 1}>Mover depois <ChevronRight size={14} /></button>
                </div>
              </> : <div className="clip-empty">Clique em um clipe para ajustar seu início e fim.</div>}
            </section>

            <section className="inspector-section soundtrack-section">
              <div className="section-heading"><span className="section-icon"><Music2 size={15} /></span><div><b>Trilha de áudio</b><small>{audioAsset ? audioAsset.name : 'Sem música ou narração'}</small></div></div>
              {audioAsset ? <button className="remove-audio" onClick={() => setAudioAssetId(null)}><X size={13} /> Remover faixa</button> : <button className="add-audio-link" onClick={() => { setPanel('audio'); fileRef.current?.click() }}><Plus size={14} /> Adicionar música ou narração</button>}
            </section>
          </div>
        </aside>

        <section className="timeline-panel" aria-label="Linha do tempo">
          <div className="timeline-header">
            <div className="timeline-title"><Layers3 size={16} /><b>Linha do tempo</b><span className="clip-count">{clips.length} {clips.length === 1 ? 'clipe' : 'clipes'}</span></div>
            <div className="timeline-tools"><span><Clock3 size={14} /> {formatTime(totalDuration)}</span><button className="icon-button small" title="Adicionar mídia" onClick={() => fileRef.current?.click()}><Plus size={16} /></button></div>
          </div>
          <div className="timeline-scroll">
            {clips.length === 0 ? (
              <div className="timeline-empty" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onTimelineDrop(event)}><span className="timeline-empty-icon"><Plus size={17} /></span><span>Arraste fotos e vídeos para cá ou <button onClick={() => fileRef.current?.click()}>importe mídia</button></span></div>
            ) : (
              <div className="timeline-inner" style={{ width: timelineWidth }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onTimelineDrop(event)}>
                <div className="ruler"><div className="track-name spacer-name" /><div className="ruler-track">{Array.from({ length: Math.max(4, Math.ceil(totalDuration) + 1) }, (_, index) => <span key={index} style={{ left: index * 62 }}>{index}s</span>)}</div></div>
                <div className="timeline-lane video-lane"><div className="track-name"><Film size={14} /><span>VÍDEO</span></div><div className="track-content" style={{ width: timelineWidth - 66 }}>
                  {clips.map((clip, index) => <div key={clip.id} className={`clip-block ${selectedClipId === clip.id ? 'selected' : ''}`} style={{ width: clipWidths[index] }} onClick={() => selectClip(clip)} draggable onDragStart={(event) => event.dataTransfer.setData('application/x-vitrine-clip', clip.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onTimelineDrop(event, clip.id)}>
                    <div className="clip-thumb">{clip.kind === 'image' ? <img src={clip.url} alt="" /> : <Film size={14} />}</div><div className="clip-details"><b>{clip.name}</b><small>{formatTime(clipLength(clip))}</small></div><button className="remove-clip" onClick={(event) => { event.stopPropagation(); removeClip(clip.id) }} aria-label={`Remover ${clip.name}`}><Trash2 size={13} /></button>
                  </div>)}
                  <button className="add-clip-inline" onClick={() => fileRef.current?.click()} aria-label="Adicionar clipe"><Plus size={17} /></button>
                  <div className="playhead" style={{ left: activePosition }}><span /></div>
                </div></div>
                <div className="timeline-lane audio-lane"><div className="track-name"><Music2 size={14} /><span>ÁUDIO</span></div><div className={`audio-track-content ${audioAsset ? 'has-audio' : ''}`} style={{ width: timelineWidth - 66 }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onTimelineDrop(event)}>
                  {audioAsset ? <div className="audio-track"><AudioLines size={16} /><b>{audioAsset.name}</b><span>TRILHA</span><button onClick={() => setAudioAssetId(null)} aria-label="Remover faixa"><X size={13} /></button></div> : <button className="empty-audio-track" onClick={() => { setPanel('audio'); fileRef.current?.click() }}><Plus size={14} /> Adicione música ou narração</button>}
                </div></div>
              </div>
            )}
          </div>
          <div className="timeline-footer"><span>Arraste os clipes (ou use “Mover”) para mudar a ordem</span><span>Alterações locais <span className="dot-divider">·</span> exportação sob demanda</span></div>
        </section>
      </div>
      <audio ref={audioRef} className="visually-hidden" aria-hidden="true" />
      <input ref={fileRef} className="visually-hidden" type="file" multiple accept="image/*,video/*,audio/*" onChange={(event) => { if (event.target.files) void importFiles(event.target.files); event.target.value = '' }} />
      {notice && <div className="toast" role="status"><Sparkles size={16} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15} /></button></div>}
      {exporting && <div className="export-progress" role="status"><div className="export-progress-copy"><span>Renderizando seu vídeo</span><b>{exportProgress}%</b></div><div className="progress-track"><span style={{ width: `${exportProgress}%` }} /></div><small>Mantenha esta aba aberta até o download começar.</small></div>}
    </div>
  )
}
