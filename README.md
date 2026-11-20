# Vitrine Clip

Editor web para montar vídeos curtos de produtos (anúncios de marketplace). Interface em português, funciona em **desktop, tablet e celular**. As mídias são processadas **no próprio navegador**, sem enviar nada para servidor.

## Como usar

1. Importe fotos, vídeos e/ou uma faixa de áudio.
2. Reordene os clipes arrastando-os na linha do tempo, ou selecione um clipe e use **Mover antes / Mover depois** (ideal no celular). Ajuste início e fim no painel de ajustes.
3. Edite título e complemento. Escolha o formato: retrato (9:16), quadrado (1:1) ou paisagem (16:9).
4. Reproduza a prévia e clique em **Exportar vídeo** (720p, 30 fps).

> A exportação grava em tempo real: mantenha a aba aberta e em primeiro plano até o download começar. O navegador escolhe MP4 se oferecer esse codificador; caso contrário, o arquivo é WebM. Alguns marketplaces exigem MP4, confira as regras do canal. O projeto não é salvo ao fechar a aba.

## Navegadores

Chrome / Edge (desktop e Android) e Safari 16+ (macOS e iOS) são os mais indicados. Exige `MediaRecorder` e `canvas.captureStream`.

## Desenvolvimento

Requer Node 20+ e [pnpm](https://pnpm.io) (`corepack enable`).

```bash
pnpm install
pnpm dev       # http://localhost:5173 (também acessível na rede local, para testar no celular)
pnpm build     # gera /dist
pnpm preview   # serve o build
```

## Publicação (GitHub Pages)

Todo push na branch `main` publica automaticamente via `.github/workflows/deploy.yml`.
No repositório: **Settings → Pages → Source: GitHub Actions**.
