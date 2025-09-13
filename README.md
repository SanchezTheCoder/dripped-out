# 💎 Dripped Out

An AI-powered “dripped out” makeover that adds diamond grills, rings, watches, and chains to your photos — paired with nightlife effects like harsh on‑camera flash, slight motion blur, VHS grain, dust/scratches, cool blue tint, and shallow depth‑of‑field — all rendered with real‑time processing. This is a rebrand and major evolution from an early fork; it’s now our own project and direction.

## 🔥 What’s new in our build

- **Midnight Neon Luxe theme**: dark default, neon cyan accents, luxe metallic edges
- **Glass UI**: blurred glass cards with neon hover rings
- **Film-frame gallery**: grain/scratch overlay, soft bokeh glows, crisp shadows
- **Glow CTAs**: new `glow` button variant with animated shine
- **Neon toasts**: tuned Sonner styling to match the theme
- **Consistency**: tokens centralized in `app/globals.css`, dark mode enforced in `app/layout.tsx`

## ✨ Features

- **📸 Dual Input Methods**: Upload images or capture live photos with your webcam
- **🤖 AI-Powered Enhancement**: Uses Google’s Gemini 2.5 Flash for realistic diamond chain additions
- **⚡ Real-Time Processing**: Live generation status via Convex reactive queries
- **🎨 Tailored UI**: shadcn/ui + Tailwind with a custom neon/film aesthetic
- **📱 Responsive**: Optimized for desktop and mobile
- **🔄 Background Jobs**: Convex scheduler runs AI tasks reliably
- **💾 Storage**: Secure asset storage using Convex Storage

## 🚀 Tech Stack

### Frontend
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (Radix UI)
- Sonner (toasts)
- React Webcam

### Backend (Convex)
- Convex Database (real-time, typed)
- Convex Storage (file uploads)
- Convex Scheduler (background jobs)
- Convex Actions (server functions)

### AI
- Google Gemini 2.5 Flash

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- Convex account
- Gemini API key

### Installation
```bash
git clone <your-repo-url>
cd dripped-out
npm install

# Initialize Convex locally (generates types and runs services)
npx convex dev --once

# Env vars
cat > .env.local << 'EOF'
CONVEX_DEPLOYMENT=your-convex-deployment-url
GEMINI_API_KEY=your-gemini-api-key
EOF

# Run
npm run dev
```
Visit http://localhost:3000.

## 🎯 How it works
1. Upload or capture a photo
2. Image is stored in Convex and an AI job is scheduled
3. UI updates in real-time as status changes
4. Final, “dripped out” image appears in the gallery and can be downloaded

### Prompt we use (Gemini 2.5 Flash)
```
Edit my photo into a flashy night paparazzi shot, for every visible person: diamond grill, iced-out watch by my face, 1 ring; harsh on-camera flash, slight motion blur, VHS grain, cool blue tint, shallow depth of field, high contrast. Use subtle, high-intensity micro-glints only on the jewelry (grill/watch/rings)—tiny, sparse, edge-focused highlights with no bloom or lens flares; zero sparkles on skin, hair, clothes, or background; The background is black and dark and blurry. 35mm film style with noticeable grain, dust, and scratches.
```

## 📁 Project Structure
```
dripped-out/
├── app/
│   ├── layout.tsx      # Dark mode + body-noise overlay
│   ├── page.tsx        # Main experience
│   └── globals.css     # Theme tokens + grain/vignette + animations
├── components/
│   ├── ui/             # shadcn/ui components (glow button, glass card, sonner)
│   ├── Webcam.tsx      # Camera capture
│   └── ImagePreview.tsx# Film-frame gallery
├── convex/             # Convex backend (schema, storage, generate, actions)
└── lib/
```

## 🚀 Deployment
```bash
# Deploy Convex
npx convex deploy

# Build web
npm run build
```
Connect the repo to Vercel for zero-config hosting.

## 📝 Scripts
```bash
npm run dev      # Next.js dev server
npx convex dev   # Start Convex dev services
npm run build    # Build for production
```

## 📄 License
MIT — see `LICENSE`.

## 🙏 Acknowledgments
Thanks to Convex, Google Gemini, shadcn/ui, and Vercel. Originally inspired by an earlier concept, but this codebase and design are now our own direction.

---

Made with ❤️  and powered by Convex
