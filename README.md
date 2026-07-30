# > bio

A highly customized React SPA built with Vite, deployed to Cloudflare Pages

## Infrastructure & Stack

- **Framework:** React + TypeScript + Vite
- **Backend:** Cloudflare Pages Functions (`functions/api/*.ts`)
- **Storage:** Cloudflare R2 Bucket

## Features

- Dynamic scrubbing thumbnails
- On-the-fly subtitle conversion
- Integrated trailers

## Development

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

Build the project:
```bash
npm run build
```

Test locally with Wrangler:
```bash
npx wrangler pages dev dist
```
*(Note: If you modify Vite components while testing against port 8788, you must run `npm run build` for Wrangler to serve the updated `dist` bundle.)*

## Deployment

Deploy to Cloudflare Pages:
```bash
npx wrangler pages deploy dist --project-name bio
```
