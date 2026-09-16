/**
 * Vocabulário de estamparia têxtil.
 *
 * Existe por um motivo só: variedade. Antes a identidade visual estava fixa no
 * prompt (linho claro, modelagem botânica, aquarela), o que fazia toda coleção
 * sair parecida e quebrava temas que não são florais, como churrasco em fundo
 * preto ou pinguim de Natal.
 *
 * Agora cada eixo é uma lista, o diretor criativo escolhe um valor de cada, e a
 * peça é montada em cima da escolha. A cada coleção o diretor recebe só uma
 * AMOSTRA de cada lista, sorteada a partir do id da coleção: o menu muda de
 * coleção para coleção, então ele não ancora sempre nas mesmas opções, e para a
 * mesma coleção o menu é sempre o mesmo, então reabrir não embaralha tudo.
 */

export interface VocabItem {
  /** Nome em português, para a tela e para o diretor. */
  pt: string;
  /** Fragmento em inglês, escrito para entrar direto no prompt de imagem. */
  en: string;
}

/* ------------------------------------------------------------------ *
 * Eixo 1: técnica de renderização. O que mais muda a cara da coleção.
 * ------------------------------------------------------------------ */
export const TECHNIQUES: VocabItem[] = [
  { pt: "guache opaco", en: "opaque gouache painting, flat chalky matte colour blocks, slightly wobbly hand-painted edges, visible brush drag, subtle paper tooth, no transparency" },
  { pt: "aquarela molhado sobre molhado", en: "loose wet-on-wet watercolour, pigment blooms bleeding into damp paper, hard drying rims, granulation, transparent layered washes, soft undefined edges" },
  { pt: "aquarela botânica modelada", en: "botanical watercolour illustration with full modelling, layered transparent washes, confident defined edges, fine internal detail, visible paper grain" },
  { pt: "nanquim com aguada", en: "black India ink brush outlines with grey ink wash, tapering confident linework, crosshatched shadows, translucent monochrome washes, one accent colour" },
  { pt: "lápis de cor", en: "coloured pencil illustration, visible directional strokes, waxy layered hues, soft grainy edges fading out, paper texture showing through, burnished highlights" },
  { pt: "pastel seco", en: "soft chalk pastel, velvety smudged colour fields, powdery dusty edges, blended transitions, visible tooth of toned paper, no hard outlines" },
  { pt: "marcador alcoólico", en: "alcohol marker illustration, streaky overlapping ink strokes with visible blend bands, crisp saturated edges, bold candy colours, darker overlap lines" },
  { pt: "caneta e rabisco", en: "ballpoint fineliner doodle, continuous wobbly hand-drawn contour lines of even weight, playful scribble fills, single flat accent colour, sketchbook paper" },
  { pt: "giz em quadro-negro", en: "white chalk drawing on a black slate ground, loose hand-lettered labels, dusty chalk texture, smudged erasures, thin sketchy outlines, monochrome with rare accent" },
  { pt: "linogravura", en: "linocut relief print, bold carved shapes, chunky gouge marks, ragged ink edges, uneven ink coverage with white nicks, one or two flat spot colours" },
  { pt: "xilogravura", en: "woodcut print, coarse black shapes with wood grain visible in the ink, splintery chiselled edges, stark black on off-white, hand-pressed uneven inking" },
  { pt: "xilogravura de cordel", en: "Northeastern Brazilian cordel woodcut, rough black-on-white relief print, chunky gouge marks, heavy hatching, naive frontal figures with bold outlines" },
  { pt: "carimbo indiano", en: "Indian hand-block print, repeated wooden stamp motifs with slightly irregular placement, soft bleeding dye edges, small overlaps and gaps, madder and indigo on ecru" },
  { pt: "serigrafia chapada", en: "screen print look, flat opaque spot-colour layers, slight registration offset between colours, crisp but softly grainy edges, three-colour palette" },
  { pt: "risografia", en: "risograph print, two or three fluorescent spot inks overprinting into extra hues, visible misregistration, coarse grain, patchy ink coverage, uncoated paper" },
  { pt: "meio-tom retrô", en: "retro halftone print, visible dot screen, CMYK misregistration, faded newsprint colours, thick contour lines, aged paper speckle, 1960s comic printing" },
  { pt: "cianotipia", en: "cyanotype sun print, monochrome Prussian blue field with white silhouetted shapes, soft blurred contact edges, uneven brush-coated borders, tonal mottling" },
  { pt: "monotipia", en: "monotype print, single-pressed painterly marks, blotchy uneven ink density, ghosted soft edges, plate wipe streaks, limited moody palette" },
  { pt: "água-forte", en: "etching, fine engraved hatching and cross-hatching building tone, sepia or black ink on cream paper, delicate crisp linework, antique scientific-plate feel" },
  { pt: "papel recortado", en: "paper-cut silhouette art, single-colour shapes cut with scissors joined by thin bridges, sharp clean contours, symmetrical composition, subtle drop shadow" },
  { pt: "colagem de papel rasgado", en: "torn-paper collage, layered pieces with fibrous ragged edges, mixed painted-paper textures, visible overlaps and soft shadows, matte handmade paper palette" },
  { pt: "marmorizado", en: "marbled paper, swirling combed ink veins, feathered nested rings, fluid non-repeating flow lines, glossy pigment on cream paper, no hard shapes" },
  { pt: "bordado matizado", en: "hand embroidery rendered as print, dense satin-stitch fills with visible thread direction and sheen, raised stitch edges, French knots, linen weave ground" },
  { pt: "ponto cruz", en: "cross-stitch chart, motifs built only from small X stitches on a visible aida grid, stepped pixelated edges, flat thread colours, no smooth curves" },
  { pt: "crewel work", en: "Jacobean crewel wool embroidery, curling stylised leaves and exotic blooms on twisting stems, stem-stitch outlines, long-and-short shading, wool nap" },
  { pt: "appliqué", en: "appliqué textile, flat fabric shapes layered and stitched down with visible blanket-stitch outlines, frayed cut edges, contrasting solid cottons, slight quilted lift" },
  { pt: "patchwork", en: "patchwork quilt, geometric fabric blocks pieced along straight seams, contrasting calico prints, visible running-stitch quilting lines, worn cotton texture" },
  { pt: "sashiko", en: "sashiko stitching, white running-stitch dashes forming geometric repeating grids on indigo cloth, evenly spaced dashes, slubby weave, two colours only" },
  { pt: "renda renascença", en: "Brazilian renda renascenca lace, white motifs outlined by a flat woven tape, open airy gaps filled with fine needle-lace stitches, ivory thread only" },
  { pt: "bordado de Passira", en: "Passira hand embroidery, shaded long-and-short stitch flowers with satin-stitch petals, fine stem-stitch vines, raised thread sheen, restrained composition" },
  { pt: "batik", en: "batik wax-resist dye, hand-drawn tjanting outlines in pale wax lines, deep layered dye grounds, fine crackle veins across colour fields, bleeding organic contours" },
  { pt: "shibori", en: "shibori resist dye on indigo, soft white bound shapes with feathered bleeding halos, radiating fold lines, irregular mirrored repeats, deep blue gradients" },
  { pt: "ikat", en: "ikat weave, motifs with characteristic blurred feathered edges bleeding sideways, warp-dye haze, stepped symmetrical shapes, visible woven thread striation" },
  { pt: "tie dye", en: "tie-dye, concentric spiral and bullseye bursts of bleeding dye, soft wet edges, radiating fold creases, white resist gaps, saturated transitions on cotton" },
  { pt: "adire africano", en: "Yoruba adire indigo resist cloth, hand-painted cassava-paste motifs in pale blue on deep indigo, gridded square panels, soft resist edges, crackled texture" },
  { pt: "capulana", en: "capulana wax-print cloth, bold high-contrast motifs with crackled wax-resist veining, strong outlines, framed border panel, vivid saturated colour blocks" },
  { pt: "toile de Jouy", en: "toile de Jouy, single-colour engraved pastoral vignettes, fine hatched line shading, figures, trees and buildings, ivory ground, indigo or madder monochrome" },
  { pt: "chintz indiano", en: "Indian chintz, hand-painted glazed cotton, flowering tree with curling stems and exotic blooms, fine dark outlines, layered mordant reds and indigo, luminous glaze" },
  { pt: "kalamkari", en: "kalamkari hand-painted cotton, fine black pen outlines filled with natural madder red, indigo and mustard, flowering vines and figures, bordered panels, ivory ground" },
  { pt: "William Morris", en: "Arts and Crafts pattern, dense interlacing stems in mirrored turnover repeat, flattened stylised leaves and blossoms, dark outlines, muted olive and madder, layered depth" },
  { pt: "art nouveau", en: "Art Nouveau, sinuous whiplash lines, elongated stylised blooms, organic asymmetric curves, heavy uniform contour, muted mustard and plum, flat stained-glass fills" },
  { pt: "art déco", en: "Art Deco, symmetrical stepped fans, sunbursts, chevrons and zigzags, strict straight-and-arc geometry, flat blocks with thin gold lines, deep jewel tones" },
  { pt: "chinoiserie", en: "chinoiserie, airy hand-painted pagodas, blossoming branches and cranes scattered on a soft ground, fine ink outlines, delicate washes, generous negative space" },
  { pt: "ukiyo-e", en: "Japanese ukiyo-e woodblock, flat matte colour areas with black keyblock outlines, bokashi gradient skies, stylised waves and clouds, visible woodgrain and paper fibre" },
  { pt: "bauhaus", en: "Bauhaus geometric, primary red, blue and yellow plus black on off-white, pure circles, squares and triangles, hard flat edges, no shading, strict grid" },
  { pt: "memphis", en: "Memphis Milano, clashing bright flat shapes, squiggles, confetti dots and terrazzo speckles on pastel ground, thick black outlines, 1980s colour, no depth" },
  { pt: "pop art", en: "pop art, bold thick black contour lines, flat primary colours, Ben-Day dot shading, high contrast comic rendering, saturated graphic punch" },
  { pt: "terrazzo", en: "terrazzo surface, irregular angular chips of flat colour scattered evenly over a speckled neutral ground, hard clean chip edges, random rotation, matte stone" },
  { pt: "vetor chapado", en: "flat vector illustration, crisp clean shapes with no outlines, solid limited palette, simple geometric abstraction of the subject, no gradients or texture" },
  { pt: "gradiente moderno", en: "soft mesh gradients, smooth colour fields melting between hues, no hard edges, subtle grain overlay, glowing luminous palette, dreamy atmospheric depth" },
  { pt: "render de massinha", en: "3D clay render, rounded matte objects under soft studio lighting with gentle shadows, pastel surfaces, squishy plasticine forms, clean seamless background" },
  { pt: "pixel art", en: "pixel art, motifs drawn on a coarse visible pixel grid, hard blocky stepped edges, tiny dithered shading patterns, limited 8-bit palette, no anti-aliasing" },
  { pt: "silhueta sólida", en: "solid silhouette, subjects as flat single-colour shapes with no interior detail, crisp clean contours, strong negative space, two-tone high-contrast composition" },
  { pt: "mosaico", en: "mosaic, image built from small irregular tesserae separated by visible grout lines, slight tonal variation per tile, stepped edges, matte stone surface" },
  { pt: "vitral", en: "stained glass, flat jewel-toned translucent panes separated by thick black lead lines, simplified faceted shapes, luminous backlit glow, glass mottling" },
  { pt: "mandala", en: "mandala, strict radial symmetry around a centre point, concentric rings of repeated motifs growing outward, fine even linework, balanced ornamental detail" },
  { pt: "arabesco islâmico", en: "Islamic geometric arabesque, interlacing star-and-polygon tessellation on strict compass geometry, continuous infinite repeat, fine outlines, flat colour fills" },
  { pt: "talavera", en: "Talavera tile, cobalt blue hand-brushed motifs on tin-glazed white, quarter-motifs joining into larger repeats, slightly wobbly brush edges, pooled glaze" },
  { pt: "azulejo português", en: "Portuguese azulejo, cobalt blue on white glazed tile, baroque scrollwork and figurative panels, repeating quarter-tile motifs, painted brush shading, glaze crackle" },
  { pt: "folk escandinavo", en: "Scandinavian folk art, simplified symmetrical motifs, flat matte colour, chunky naive shapes with no gradients, pale ground, restrained red, ochre and deep blue" },
  { pt: "paisley indiano", en: "paisley boteh, teardrop motifs with curled tips densely packed with tiny florals, fine outlines, layered nested borders, rich madder, indigo and gold" },
  { pt: "kente", en: "kente strip weave, narrow woven bands sewn side by side, bold interlocking rectangles and checks, warp and weft blocks in gold, red, green and black, visible thread grain" },
  { pt: "mola panamenha", en: "Guna mola reverse applique, layered fabric cut away to reveal stacked bright colours as narrow outlines, fine sawtooth fillers, bold silhouetted figures" },
  { pt: "huichol", en: "Huichol yarn painting, image built from tightly packed parallel rows of coloured yarn, glowing high-contrast outlines, radiating fills, symbolic figures" },
  { pt: "chita brasileira", en: "Brazilian chita print, oversized exuberant flowers and leaves in flat vivid red, yellow and blue, bold dark outlines, crowded joyful composition, cheap cotton texture" },
  { pt: "arte marajoara", en: "Marajoara Amazonian graphics, interlocking spirals and meanders with stylised serpent figures, symmetrical bands, red and black on white clay ground, incised line texture" },
  { pt: "grafismo kadiwéu", en: "Kadiweu body-paint graphics, asymmetric interlacing curved and angular bands, thick black contours filled with red, spiralling arabesque compositions, matte earth palette" },
];

/* ------------------------------------------------------------------ *
 * Eixo 2: tratamento do fundo. Era aqui que estava travado em linho claro.
 * ------------------------------------------------------------------ */
export const GROUNDS: VocabItem[] = [
  { pt: "linho cru", en: "natural ecru linen ground with a fine even woven texture printed into the art, warm off-white, subtle and low contrast" },
  { pt: "linho branco", en: "white linen ground with a fine even woven texture printed into the art, cool bright white" },
  { pt: "algodão liso", en: "perfectly flat plain cotton ground in a single even colour, no texture at all" },
  { pt: "cor cheia saturada", en: "a fully saturated solid colour ground from the palette, strong and confident, with the motifs reading light against it" },
  { pt: "fundo escuro", en: "a deep near-black or very dark ground, with the motifs glowing light and saturated against the darkness" },
  { pt: "quadro-negro", en: "a black slate chalkboard ground with faint chalk dust and smudges" },
  { pt: "papel envelhecido", en: "aged warm paper ground with gentle foxing, uneven staining and worn edges" },
  { pt: "papel de aquarela", en: "cold-press watercolour paper ground, visible tooth, soft uneven wash of the base colour" },
  { pt: "aguada mosqueada", en: "a mottled watercolour wash ground, lighter and darker patches of the same hue, cloudy and organic" },
  { pt: "jeans", en: "indigo denim ground with visible twill diagonal weave, faded patches and topstitch details" },
  { pt: "juta rústica", en: "coarse jute or burlap ground with a chunky open weave and natural straw colour" },
  { pt: "cerâmica vidrada", en: "glazed ceramic ground, glossy white with fine crackle veins and slight glaze pooling" },
  { pt: "kraft", en: "brown kraft paper ground with visible fibre flecks, motifs printed over it" },
  { pt: "gradiente suave", en: "a soft gradient ground melting between two palette colours, no visible banding" },
  { pt: "céu texturizado", en: "an atmospheric washed sky ground with soft cloudy variation and tiny speckles" },
  { pt: "xadrez de fundo", en: "a woven check or gingham ground in two palette colours, with the main motifs drawn on top of it" },
  { pt: "listrado de fundo", en: "a striped ground in two palette colours running top to bottom, with the main motifs drawn on top of it" },
];

/* ------------------------------------------------------------------ *
 * Eixo 3: layout. Como os motivos se distribuem.
 * ------------------------------------------------------------------ */
export const LAYOUTS: VocabItem[] = [
  { pt: "jogado", en: "tossed layout, motifs scattered at varied rotations with no visible grid" },
  { pt: "grade regular", en: "strict regular grid, every motif upright at the same spacing, orderly and calm" },
  { pt: "meio desencontrado", en: "half-drop repeat, every other column shifted down by half a step so the eye finds no straight row" },
  { pt: "em fileiras", en: "motifs lined up in clear horizontal rows, alternating between two motifs along each row" },
  { pt: "diagonal", en: "motifs marching along clear diagonal lines across the tile" },
  { pt: "damasco ogee", en: "ogee damask framework, motifs held inside repeating pointed-oval compartments" },
  { pt: "buquês agrupados", en: "clustered bouquets with generous empty ground between the clusters" },
  { pt: "denso sem fundo", en: "densely packed all over, motifs touching and overlapping so almost no ground shows" },
  { pt: "arejado", en: "very airy, small motifs with large calm areas of empty ground between them" },
  { pt: "listras de motivos", en: "motifs arranged into vertical bands alternating with plain or striped bands" },
  { pt: "espelhado", en: "mirrored symmetry, each motif reflected across a vertical axis" },
  { pt: "radial", en: "radial arrangement, motifs radiating outward from repeating centre points" },
  { pt: "trepadeira", en: "trailing vine layout, continuous stems winding across the whole surface and linking the motifs" },
  { pt: "conversacional espalhado", en: "conversational scatter, small unrelated everyday objects sprinkled at many scales and angles" },
];

/* ------------------------------------------------------------------ *
 * Eixo 4: estratégia de paleta. Não é a cor, é o tipo de combinação.
 * ------------------------------------------------------------------ */
export const PALETTES: VocabItem[] = [
  { pt: "clara e lavada", en: "pale washed palette, soft tints and plenty of light, nothing saturated" },
  { pt: "terrosa natural", en: "natural earth palette, ochre, clay, moss and warm browns" },
  { pt: "pedras preciosas", en: "jewel tones, deep emerald, sapphire, ruby and amethyst at full saturation" },
  { pt: "monocromática", en: "monochrome palette, a single hue across its full range from palest tint to deepest shade" },
  { pt: "duas cores contrastantes", en: "two colours only, in strong contrast with each other, nothing in between" },
  { pt: "escura e dramática", en: "dark dramatic palette, a deep ground with only a few luminous accents" },
  { pt: "pastel", en: "soft pastel palette, chalky pinks, blues and mints, low contrast and gentle" },
  { pt: "vibrante saturada", en: "vivid saturated palette, bold pure colours at full strength, cheerful and loud" },
  { pt: "neutra crua", en: "raw neutral palette, ecru, bone, grey and soft taupe with one quiet accent" },
  { pt: "vintage dessaturada", en: "faded vintage palette, dusty muted colours as if sun-bleached over time" },
  { pt: "tom sobre tom", en: "tone on tone, motifs only a shade lighter or darker than the ground, very subtle" },
  { pt: "quente e fria em choque", en: "a deliberate clash of one warm and one cool family, each making the other louder" },
];

/* ------------------------------------------------------------------ *
 * Eixo 5: linguagem gráfica secundária, a que costura a coleção.
 * ------------------------------------------------------------------ */
export const SECONDARY_LANGUAGES: VocabItem[] = [
  { pt: "xadrez", en: "woven check plaid" },
  { pt: "vichy", en: "small gingham check" },
  { pt: "xadrez escocês", en: "tartan plaid with overlapping bands" },
  { pt: "listra fina", en: "fine ticking stripe" },
  { pt: "listra larga pintada", en: "wide hand-painted stripe with a living edge" },
  { pt: "poá", en: "regular polka dot lattice" },
  { pt: "azulejo português", en: "Portuguese blue-and-white tile scrollwork" },
  { pt: "arabesco", en: "scrolling arabesque ornament" },
  { pt: "filigrana", en: "fine reserved filigree tracery" },
  { pt: "renda", en: "lace edging with open needle-work gaps" },
  { pt: "jeans e patchwork", en: "denim patches with topstitching and frayed edges" },
  { pt: "terrazzo", en: "speckled terrazzo chips" },
  { pt: "espinha de peixe", en: "herringbone weave" },
  { pt: "grade de ponto cruz", en: "cross-stitch grid border" },
  { pt: "cordão e laço", en: "ribbon and bow trim" },
  { pt: "moldura ornamentada", en: "ornamental scrollwork border frame" },
  { pt: "faixa com dizeres", en: "a narrow band of short hand-lettered words" },
  { pt: "selo e carimbo", en: "postal stamp and rubber stamp marks" },
  { pt: "grega geométrica", en: "geometric key-fret border" },
  { pt: "escama", en: "overlapping scallop scale pattern" },
  { pt: "sarja diagonal", en: "diagonal twill ribbing" },
  { pt: "ondas", en: "repeating wave lines" },
];

/* ------------------------------------------------------------------ *
 * Amostragem determinística por coleção.
 * ------------------------------------------------------------------ */

/** Hash estável de string, para sortear sempre igual para a mesma coleção. */
function hashOf(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Tira uma amostra sem repetição da lista, sempre a mesma para a mesma semente.
 * Embaralha com um gerador linear simples plantado no hash da semente.
 */
export function sampleVocab<T>(list: T[], count: number, seed: string): T[] {
  const out = [...list];
  let state = hashOf(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out.slice(0, Math.max(0, Math.min(count, out.length)));
}

/** Menu que vai para o diretor criativo nesta coleção. */
export interface VocabMenu {
  tecnicas: VocabItem[];
  fundos: VocabItem[];
  layouts: VocabItem[];
  paletas: VocabItem[];
  linguagensSecundarias: VocabItem[];
}

/**
 * Monta o menu desta coleção. A lista inteira não vai no prompt de propósito:
 * ela é longa e, pior, o modelo tende a escolher sempre os primeiros itens.
 * Uma amostra menor e diferente a cada coleção espalha muito mais o resultado.
 */
export function vocabMenuFor(seed: string): VocabMenu {
  return {
    tecnicas: sampleVocab(TECHNIQUES, 14, `t:${seed}`),
    fundos: sampleVocab(GROUNDS, 7, `f:${seed}`),
    layouts: sampleVocab(LAYOUTS, 7, `l:${seed}`),
    paletas: sampleVocab(PALETTES, 6, `p:${seed}`),
    linguagensSecundarias: sampleVocab(SECONDARY_LANGUAGES, 9, `s:${seed}`),
  };
}

/** Só os nomes em português, que é o que o diretor precisa ver para escolher. */
export function menuAsText(menu: VocabMenu): Record<string, string[]> {
  return {
    tecnicas: menu.tecnicas.map((i) => i.pt),
    fundos: menu.fundos.map((i) => i.pt),
    layouts: menu.layouts.map((i) => i.pt),
    paletas: menu.paletas.map((i) => i.pt),
    linguagensSecundarias: menu.linguagensSecundarias.map((i) => i.pt),
  };
}

/** Acha o fragmento em inglês de um nome escolhido pelo diretor. */
export function englishFor(list: VocabItem[], pt: string): string {
  const key = (pt ?? "").trim().toLowerCase();
  if (key === "") return "";
  const exact = list.find((i) => i.pt.toLowerCase() === key);
  if (exact) return exact.en;
  const loose = list.find((i) => key.includes(i.pt.toLowerCase()) || i.pt.toLowerCase().includes(key));
  return loose?.en ?? "";
}
