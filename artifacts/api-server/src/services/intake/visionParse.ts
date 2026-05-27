/**
 * Anthropic vision call — extract structured tire data from a sidewall photo.
 *
 * Hard contract:
 *   - Model returns JSON only (no prose). We parse and validate with zod.
 *   - Vision output is treated as a HINT — deterministic parseSize/parseDot
 *     re-validate. If vision says "P225/65R17" but our regex disagrees, regex wins.
 *   - Confidence is a SELF-REPORTED 0-100 from the model; we use it to gate
 *     intake_review vs in_stock.
 *   - Photo bytes are passed as base64 data URLs (Phase 1 MVP — no S3).
 */
import { z } from 'zod';
import { getAnthropic, MODELS, type SupportedLang } from '@rubberiq/anthropic';

const VisionSchema = z.object({
  brand: z.string().nullable(),
  model: z.string().nullable(),
  size: z.string().nullable(),
  dotCode: z.string().nullable(),
  loadIndex: z.string().nullable(),
  speedRating: z.string().nullable(),
  treadDepth32nds: z.number().nullable(),
  flags: z.array(z.string()),
  confidence: z.number().min(0).max(100),
  notes: z.string().nullable(),
});

export type Vision = z.infer<typeof VisionSchema>;

const SYSTEM_PROMPT = `You are a tire intake assistant. Extract structured data from a photo of a tire sidewall.

Return a JSON object with these exact keys:
  brand            string|null  manufacturer (e.g. "Michelin")
  model            string|null  model name (e.g. "Defender LTX")
  size             string|null  raw size string as printed (e.g. "P225/65R17")
  dotCode          string|null  full DOT code as printed (e.g. "DOT B92T HM8R 2823")
  loadIndex        string|null  load index (e.g. "98")
  speedRating      string|null  speed rating letter (e.g. "T", "H")
  treadDepth32nds  number|null  visible tread depth in 32nds if measurable, else null
  flags            string[]     array from this exact set if visible:
                                  ["sidewall_damage","sidewall_bulge","cord_exposed",
                                   "belt_separation","bead_damage","plug_present",
                                   "uneven_wear","weather_cracking"]
  confidence       number 0-100 your overall confidence in this extraction
  notes            string|null  one short sentence if anything is unusual

Rules:
  - Output ONLY the JSON object. No prose, no markdown fences, no preamble.
  - Use null when you cannot read a field, NOT empty string.
  - Be conservative on confidence: blurry or partial sidewall → below 60.
  - Be honest on flags — these affect liability.`;

export type VisionParseInput = {
  photoDataUrl: string;   // "data:image/jpeg;base64,..."
  language?: SupportedLang;
};

export async function visionParse(input: VisionParseInput): Promise<Vision> {
  const m = input.photoDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) throw new Error('photoDataUrl must be a base64-encoded image/jpeg|png|webp data URL');
  const mediaType = m[1] as 'image/jpeg' | 'image/png' | 'image/webp';
  const data = m[2]!;

  const client = getAnthropic();
  const resp = await client.messages.create({
    model: MODELS.vision,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data },
          },
          {
            type: 'text',
            text:
              input.language === 'es'
                ? 'Extrae los datos del neumático. Responde solo con el objeto JSON.'
                : 'Extract the tire data. Respond with the JSON object only.',
          },
        ],
      },
    ],
  });

  const textBlock = resp.content.find((b: { type: string }) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('vision call returned no text content');
  }
  const raw = (textBlock as { type: 'text'; text: string }).text.trim();

  // Be tolerant of accidental code fences.
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(`vision call did not return JSON: ${raw.slice(0, 120)}`);
  }
  return VisionSchema.parse(parsed);
}
