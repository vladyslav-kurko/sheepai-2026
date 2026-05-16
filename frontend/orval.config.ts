import { defineConfig } from 'orval';

export default defineConfig({
  sheepai: {
    input: {
      target: './src/api/openapi.json',
    },
    output: {
      target: './src/api/generated',
      client: 'fetch',
      mode: 'tags-split',
      override: {
        mutator: {
          path: './src/api/mutator.ts',
          name: 'customFetch',
        },
      },
    },
  },
});
