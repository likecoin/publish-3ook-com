# publish.3ook.com

A Nuxt 3 web application for publishing and managing NFT books on the blockchain, serving users at [publish.3ook.com](https://publish.3ook.com).

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

For AI agent guidance, see [AGENTS.md](./AGENTS.md) (also symlinked as `CLAUDE.md`).

## Setup

Make sure to install the dependencies:

```bash
yarn install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
yarn dev
```

Run in production config:
```bash
yarn dev:production
```

## Production

**Important**: Build and generate commands require extra memory:
```bash
export NODE_OPTIONS=--max_old_space_size=8192
```

Build the application for production:

```bash
NODE_OPTIONS=--max_old_space_size=8192 yarn build:production
```

Locally preview production build:

```bash
yarn preview
```

### Static Site

Build the application for static site hosting:

```bash
NODE_OPTIONS=--max_old_space_size=8192 yarn generate:production
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
