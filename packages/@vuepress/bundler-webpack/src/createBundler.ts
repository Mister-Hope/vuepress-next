import type { CreateBundlerFunction } from '@vuepress/core'
import { createBuild } from './build'
import { createDev } from './dev'
import type { BundlerWebpackOptions } from './types'

export const createBundler: CreateBundlerFunction<BundlerWebpackOptions> = (
  options
) => ({
  dev: createDev(options),
  build: createBuild(options),
})
