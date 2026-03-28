import type { CodegenConfig } from '@graphql-codegen/cli'
const config: CodegenConfig = {
  schema: '',
  documents: ['src/**/*.graphql'],
  generates: {
    './src/gql/': {
      preset: 'client',
    },
  },
}

export default config