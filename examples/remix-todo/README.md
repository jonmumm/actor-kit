# Welcome to Remix + Cloudflare!

- 📖 [Remix docs](https://remix.run/docs)

## Development

Run the dev server (remix + cloudflare):

```sh
npm run dev
```

## Deployment

Deploy your app to Cloudflare Pages:

```sh
npm run deploy
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever css framework you prefer. See the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for more information.

## NB

This uses the "Classic" Remix compiler, since the Vite setup does not work with all the Workers resources just yet (Durable Objects, Hyperdrive, etc). Once the Vite Environment for workerd ships, we'll change this, but it should not require any changes in your actual code, simply in configuration (i.e., `remix.config.js` will get replaced by `vite.config.js`, etc).
