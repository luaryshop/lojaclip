# Vitrine Clip

Editor web para montar vídeos curtos de produtos e anúncios de marketplace. A interface funciona em desktop, tablet e celular; fotos, vídeos e áudios são processados no próprio navegador, sem envio para um servidor.

## Como usar

1. Importe fotos, vídeos e/ou uma faixa de áudio.
2. Para transformar uma foto em clipe animado, selecione **Movimento** na barra de ferramentas, escolha a foto e aplique zoom ou panorâmica. Fotos novas começam com aproximação suave; a duração pode ser ajustada de 2 a 10 segundos, e o efeito pode ser aplicado a todas as fotos.
3. Reordene os clipes arrastando-os na linha do tempo ou use **Mover antes / Mover depois**. Ajuste início e fim no painel de ajustes.
4. Edite título e complemento. Escolha o formato: retrato (9:16), quadrado (1:1) ou paisagem (16:9).
5. Reproduza a prévia e clique em **Exportar vídeo** (720p, 30 fps).

Os movimentos das fotos são efeitos locais de câmera — aproximação, afastamento e panorâmicas — e não uma recriação do assunto por IA. As fotos permanecem no navegador.

> A exportação grava em tempo real: mantenha a aba aberta e em primeiro plano até o download começar. O navegador escolhe MP4 se oferecer esse codificador; caso contrário, o arquivo é WebM. Alguns marketplaces exigem MP4, confira as regras do canal. O projeto não é salvo ao fechar a aba.

## Navegadores

Chrome / Edge (desktop e Android) e Safari 16+ (macOS e iOS) são os mais indicados. Exige `MediaRecorder` e `canvas.captureStream`.

## Desenvolvimento

Requer Node 20+ e [pnpm](https://pnpm.io) (`corepack enable`).

```bash
pnpm install
pnpm dev       # http://localhost:3000
pnpm build     # gera /dist
pnpm preview   # serve o build
```

## Publicação (GitHub Pages)

Todo push na branch `main` publica automaticamente via `.github/workflows/deploy.yml`. No repositório: **Settings → Pages → Source: GitHub Actions**.
