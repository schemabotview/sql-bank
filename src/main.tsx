import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Three stylesheets, in cascade order — engine, shell, then this repo's brand (last, so it wins).
import '@graphlearning/graphl-flow/styles.css'
import '@graphlearning/shell/styles.css'
import './theme.css'
import { ConceptApp } from '@graphlearning/shell'
import { COURSES } from './content'
import { getScene } from './scenes'

// The whole app: router, section view, catalog and narration are @graphlearning/shell; this repo
// supplies its two registries and its name. audioBase comes from here because the shell is built
// separately and cannot read this app's import.meta.env.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConceptApp subject="SQL" courses={COURSES} getScene={getScene} audioBase={import.meta.env.BASE_URL} />
  </StrictMode>,
)
