# Criador de Apresentações Instituto Mix

Crie uma apresentação moderna, elegante, minimalista e emocionalmente impactante para palestras do Instituto Mix, conduzidas pelo executivo Alex Cavalheiro (CEO).

## Identidade Visual
- **Fundo:** Preto (#000000) ou preto profundo (#0A0A0A)
- **Cor de destaque:** Vermelho vibrante (#E8001D — cor institucional Instituto Mix)
- **Tipografia:** Branca (#FFFFFF) para títulos e texto principal; cinza claro (#CCCCCC) para subtextos
- **Estilo:** Apple Keynote / TED Talk — muito espaço em branco, frases curtas e impactantes, dados grandes, imagens evocativas

## Estrutura dos Slides

O usuário irá fornecer o tema e contexto. Com base nisso, gere os seguintes blocos:

1. **Abertura impactante** — frase única, grande, vermelha ou branca no centro. Sem logo ainda.
2. **Apresentação do executivo** — nome Alex Cavalheiro, cargo CEO, logo Instituto Mix. Minimalista.
3. **Storytelling / contexto** — 1 frase de impacto + 2-3 bullets curtos (máx 6 palavras cada)
4. **Dado / estatística** — número grande em destaque vermelho, frase de contextualização abaixo
5. **Visão de futuro** — slide com metáfora visual descrita em texto, frase inspiracional
6. **Slide de citação** — aspas grandes, frase impactante de Alex ou referência, autor ao rodapé
7. **Liderança e transformação** — diagrama simples (texto) ou 3 pilares centrais
8. **Call to action** — pergunta retórica ou convite, vermelha, grande
9. **Encerramento emocional** — agradecimento + logo + contato, fundo preto, elegante

## Output
Gere o HTML completo da apresentação como um único arquivo `apresentacao.html` com:
- CSS inline, sem dependências externas
- Slides como seções `<section>` dentro de um container com navegação por teclado (seta →) ou clique
- Impressão/PDF: `@media print` com cada section em page-break
- Fontes: use `font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif`

## Instruções para uso
Informe:
- **Tema da palestra** (ex: "Transformação Digital no Franchising")
- **Público** (ex: franqueados, líderes, colaboradores)
- **Duração prevista** (ex: 30 min → ~15 slides)
- **Dados ou estatísticas** que deseja incluir (opcional)
- **Citações ou frases** preferidas (opcional)
