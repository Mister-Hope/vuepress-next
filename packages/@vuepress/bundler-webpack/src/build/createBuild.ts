import * as webpack from 'webpack'
import type { ServerEntry } from '@vuepress/client'
import type { App, Bundler } from '@vuepress/core'
import { chalk, fs, logger, ora } from '@vuepress/utils'
import type { BundlerWebpackOptions } from '../types'
import {
  createClientConfig,
  clientManifestFilename,
} from './createClientConfig'
import { createServerConfig } from './createServerConfig'
import { renderPage } from './renderPage'
import { resolveClientManifestMeta } from './resolveClientManifestMeta'
import type { ClientManifest } from './ssr'

export const createBuild = (
  options: BundlerWebpackOptions
): Bundler['build'] => async (app: App) => {
  // initialize and prepare
  await app.init()
  await app.prepare()

  // empty dest directory
  await fs.emptyDir(app.dir.dest())

  // create webpack config
  const clientConfig = createClientConfig(app, options).toConfig()
  const serverConfig = createServerConfig(app, options).toConfig()

  // spinner for webpack compilation
  const spinnerWebpack = ora()
  spinnerWebpack.start('Compiling with webpack...')

  // webpack compile
  await new Promise((resolve, reject) => {
    webpack([clientConfig, serverConfig], (err, stats) => {
      if (err) {
        reject(err)
      } else if (stats.hasErrors()) {
        stats.toJson().errors.forEach((err) => {
          console.error(err)
        })
        reject(new Error('Failed to compile with errors'))
      } else {
        if (stats.hasWarnings()) {
          stats.toJson().warnings.forEach((warning) => {
            console.warn(warning)
          })
        }

        resolve()
      }
    })
  })

  // stop spinner
  spinnerWebpack.succeed('Webpack compiled')

  // spinner for pages rendering
  const spinnerRender = ora()
  spinnerRender.start('Rendering pages...')

  // load ssr template file
  const ssrTemplate = (await fs.readFile(app.options.templateSSR)).toString()

  // load the client manifest file
  const clientManifest = require(app.dir.dest(
    clientManifestFilename
  )) as ClientManifest

  // resolve client files meta
  const {
    allFilesMeta,
    initialFilesMeta,
    asyncFilesMeta,
    moduleFilesMetaMap,
  } = resolveClientManifestMeta(clientManifest)

  // load the compiled server bundle
  const { createServerApp } = require(app.dir.dest(
    '.server/app'
  )) as ServerEntry

  // create vue ssr app
  const { app: vueApp, router: vueRouter } = await createServerApp()

  // pre-render pages to html files
  for (const page of app.pages) {
    spinnerRender.start(`Rendering pages... ${chalk.magenta(page.path)}`)
    await renderPage({
      app,
      page,
      vueApp,
      vueRouter,
      ssrTemplate,
      allFilesMeta,
      initialFilesMeta,
      asyncFilesMeta,
      moduleFilesMetaMap,
    })
  }

  // keep the server bundle files in debug mode
  if (!app.env.isDebug) {
    // remove server dest directory after pages rendered
    await fs.remove(app.dir.dest('.server'))
  }

  // stop spinner
  spinnerRender.succeed('Pages rendered')

  // plugin hook: onGenerated
  await app.pluginApi.hooks.onGenerated.process(app)

  // print success log
  logger.success('VuePress build successfully!')
}
