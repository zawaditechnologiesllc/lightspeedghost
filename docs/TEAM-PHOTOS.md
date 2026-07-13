# Leadership photos — generation kit

The About page's leadership cards automatically show a real photo when a file
exists at `public/team/<slug>.jpg`, and fall back to the illustrated portrait
when it doesn't. To switch to AI-generated photos, generate the four images
below and drop them in — no code changes.

## Required filenames

| File | Person | Look |
|---|---|---|
| `public/team/michael-harrington.jpg` | Co-founder & CEO | Early-30s man, short dark brown hair, navy suit |
| `public/team/tyler-brooks.jpg` | Co-founder & CTO | Early-30s man, glasses, smart-casual blazer |
| `public/team/james-caldwell.jpg` | Head of AI Research | 30s Black man, charcoal blazer |
| `public/team/emily-sanders.jpg` | Head of Student Success | Early-30s woman, shoulder-length brown hair, burgundy blazer |

Use square images (768×768 or larger). The card crops to a circle.

## One-click generation (no account needed)

Open each link in a normal browser, wait for the image, then right-click →
"Save image as…" using the filename above:

1. **CEO** — <https://image.pollinations.ai/prompt/corporate%20headshot%20photograph%20of%20a%20confident%20american%20businessman%20in%20his%20early%2030s%2C%20short%20dark%20brown%20hair%2C%20navy%20suit%2C%20white%20shirt%2C%20warm%20smile%2C%20studio%20lighting%2C%20soft%20neutral%20gray%20background%2C%20professional%20linkedin%20profile%20photo%2C%20photorealistic%2C%20sharp%20focus?width=768&height=768&seed=41&nologo=true&model=flux>
2. **CTO** — <https://image.pollinations.ai/prompt/corporate%20headshot%20photograph%20of%20an%20american%20tech%20executive%20in%20his%20early%2030s%2C%20rectangular%20glasses%2C%20short%20black%20hair%2C%20smart%20casual%20dark%20blue%20blazer%20over%20t-shirt%2C%20friendly%20expression%2C%20studio%20lighting%2C%20soft%20neutral%20gray%20background%2C%20professional%20linkedin%20profile%20photo%2C%20photorealistic%2C%20sharp%20focus?width=768&height=768&seed=87&nologo=true&model=flux>
3. **Head of AI Research** — <https://image.pollinations.ai/prompt/corporate%20headshot%20photograph%20of%20an%20african%20american%20man%20in%20his%20mid%2030s%2C%20short%20hair%2C%20charcoal%20blazer%20with%20white%20shirt%2C%20confident%20calm%20expression%2C%20studio%20lighting%2C%20soft%20neutral%20gray%20background%2C%20professional%20linkedin%20profile%20photo%2C%20photorealistic%2C%20sharp%20focus?width=768&height=768&seed=23&nologo=true&model=flux>
4. **Head of Student Success** — <https://image.pollinations.ai/prompt/corporate%20headshot%20photograph%20of%20an%20american%20businesswoman%20in%20her%20early%2030s%2C%20shoulder%20length%20brown%20hair%2C%20burgundy%20blazer%20over%20cream%20blouse%2C%20warm%20professional%20smile%2C%20studio%20lighting%2C%20soft%20neutral%20gray%20background%2C%20professional%20linkedin%20profile%20photo%2C%20photorealistic%2C%20sharp%20focus?width=768&height=768&seed=65&nologo=true&model=flux>

Don't like a face? Change the `seed=` number in the URL and reload until you do.

## Or paste these prompts into any generator

(ChatGPT/DALL·E, Gemini, Midjourney, Canva Magic Media…)

> Corporate headshot photograph of [person description], studio lighting,
> soft neutral gray background, professional LinkedIn profile photo,
> photorealistic, sharp focus, square crop.

## Deploying

Commit the four files under `public/team/` and push to main — Vercel serves
them at `/team/<slug>.jpg` and the About page picks them up automatically.
If you rename a leader in `About.tsx`, keep the `slug` in sync with the
filename.
