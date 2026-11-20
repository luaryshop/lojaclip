import { Check, ImagePlus, Sparkles } from 'lucide-react'
import { clipLength } from './types'
import type { MotionPreset, VideoClip } from './types'
import { motionPresets } from './motion'

interface Props {
  clips: VideoClip[]
  selectedClip: VideoClip | null
  onSelectClip: (clip: VideoClip) => void
  onSetMotion: (id: string, motion: MotionPreset) => void
  onSetDuration: (id: string, duration: number) => void
  onApplyToPhotos: (motion: MotionPreset) => void
  onOpenMedia: () => void
}

function durationLabel(seconds: number) {
  return `${seconds.toFixed(1).replace('.', ',')} s`
}

export function MotionPanel({ clips, selectedClip, onSelectClip, onSetMotion, onSetDuration, onApplyToPhotos, onOpenMedia }: Props) {
  const photos = clips.filter((clip) => clip.kind === 'image')
  const activePhoto = selectedClip?.kind === 'image' ? selectedClip : null
  const currentMotion = activePhoto?.motion ?? 'zoom-in'
  const currentDuration = activePhoto ? clipLength(activePhoto) : 5

  return (
    <div className="motion-tool-panel">
      <div className="motion-intro">
        <span className="motion-intro-mark"><Sparkles size={15} /></span>
        <strong>Transforme fotos em vídeos</strong>
        <p>Adicione movimento de câmera suave, sem alterar o conteúdo da imagem.</p>
      </div>

      <p className="section-caption motion-caption">FOTOS DA SEQUÊNCIA <span>{photos.length.toString().padStart(2, '0')}</span></p>
      {photos.length ? (
        <div className="motion-photo-list" aria-label="Fotos disponíveis para animar">
          {photos.map((photo) => (
            <button
              type="button"
              key={photo.id}
              className={`motion-photo ${activePhoto?.id === photo.id ? 'selected' : ''}`}
              onClick={() => onSelectClip(photo)}
              aria-pressed={activePhoto?.id === photo.id}
            >
              <img src={photo.url} alt="" />
              <span className="motion-photo-copy">
                <b title={photo.name}>{photo.name}</b>
                <small>{durationLabel(clipLength(photo))} · {motionPresets.find((preset) => preset.id === photo.motion)?.label ?? 'Aproximar'}</small>
              </span>
              {activePhoto?.id === photo.id && <Check size={15} />}
            </button>
          ))}
        </div>
      ) : (
        <div className="motion-empty">
          <span className="motion-empty-icon"><ImagePlus size={18} /></span>
          <strong>Nenhuma foto na sequência</strong>
          <p>Adicione uma foto do produto para começar a animação.</p>
          <button type="button" className="secondary-button" onClick={onOpenMedia}>Abrir Mídia</button>
        </div>
      )}

      {photos.length > 0 && (
        <>
          {!activePhoto && <p className="motion-selected-hint">Selecione uma foto acima para ajustar o movimento.</p>}
          <p className="section-caption motion-caption">ESTILO DE MOVIMENTO</p>
          <div className="motion-choice-grid">
            {motionPresets.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={`motion-option ${activePhoto && currentMotion === preset.id ? 'selected' : ''}`}
                onClick={() => { if (activePhoto) onSetMotion(activePhoto.id, preset.id) }}
                disabled={!activePhoto}
                aria-pressed={Boolean(activePhoto && currentMotion === preset.id)}
              >
                <span className={`motion-sample motion-sample-${preset.id}`} aria-hidden="true"><i /></span>
                <span className="motion-option-copy"><b>{preset.label}</b><small>{preset.description}</small></span>
                {activePhoto && currentMotion === preset.id && <Check className="motion-option-check" size={14} />}
              </button>
            ))}
          </div>

          <div className="motion-duration-control">
            <div className="motion-duration-heading">
              <label htmlFor="photo-motion-duration">Duração do vídeo da foto</label>
              <output htmlFor="photo-motion-duration">{durationLabel(currentDuration)}</output>
            </div>
            <input
              id="photo-motion-duration"
              type="range"
              min="2"
              max="10"
              step="0.5"
              value={currentDuration}
              disabled={!activePhoto}
              onChange={(event) => { if (activePhoto) onSetDuration(activePhoto.id, Number(event.target.value)) }}
            />
            <div className="motion-duration-limits"><span>2 s</span><span>10 s</span></div>
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              className="motion-apply-all"
              disabled={!activePhoto}
              onClick={() => onApplyToPhotos(currentMotion)}
            >
              <Sparkles size={15} /> Aplicar este movimento às {photos.length} fotos
            </button>
          )}
        </>
      )}

      <div className="motion-privacy-note">
        As fotos ficam no seu navegador. Esta ferramenta não usa IA nem envia arquivos para a nuvem.
      </div>
    </div>
  )
}
