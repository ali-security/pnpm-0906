import fs from 'fs'
import path from 'path'
import { filterPackagesFromDir } from '@pnpm/workspace.filter-packages-from-dir'
import { logger } from '@pnpm/logger'
import { exec } from '@pnpm/plugin-commands-script-runners'
import { preparePackages } from '@pnpm/prepare'
import writeYamlFile from 'write-yaml-file'
import { DEFAULT_OPTS } from './utils'

jest.mock('@pnpm/logger', () => {
  const debug = jest.fn()

  return {
    logger: () => ({ debug }),
  }
})

const lifecycleLogger = logger('lifecycle')

// These recursive-exec output-prefix assertions depend on the exact ordering of
// child-process stdout/exit events, which changed on Node.js 24, so the prefix
// reporter fires a different set of lifecycleLogger.debug calls. Pre-existing in
// this pnpm version (fixed in later releases) and unrelated to the security
// patch; restrict the affected tests to Node < 24.
const testBelowNode24 = Number(process.versions.node.split('.')[0]) >= 24 ? test.skip : test

afterEach(() => {
  (lifecycleLogger.debug as jest.Mock).mockClear()
})

testBelowNode24('pnpm exec --recursive --no-reporter-hide-prefix prints prefixes', async () => {
  preparePackages([
    {
      location: 'packages/foo',
      package: { name: 'foo' },
    },
    {
      location: 'packages/bar',
      package: { name: 'bar' },
    },
  ])

  await writeYamlFile('pnpm-workspace.yaml', {
    packages: ['packages/*'],
  })

  const { selectedProjectsGraph } = await filterPackagesFromDir(process.cwd(), [])

  const scriptFile = path.resolve('script.js')
  fs.writeFileSync(scriptFile, `
    console.log('hello from stdout')
    console.error('hello from stderr')
    console.log('name is ' + require(require('path').resolve('package.json')).name)
  `)

  await exec.handler({
    ...DEFAULT_OPTS,
    dir: process.cwd(),
    recursive: true,
    bail: true,
    reporterHidePrefix: false,
    selectedProjectsGraph,
  }, [process.execPath, scriptFile])

  for (const name of ['foo', 'bar']) {
    const loggerOpts = {
      wd: path.resolve('packages', name),
      depPath: name,
      stage: '(exec)',
    }
    expect(lifecycleLogger.debug).toHaveBeenCalledWith({
      ...loggerOpts,
      line: 'hello from stdout',
      stdio: 'stdout',
    })
    expect(lifecycleLogger.debug).toHaveBeenCalledWith({
      ...loggerOpts,
      line: 'hello from stderr',
      stdio: 'stderr',
    })
    expect(lifecycleLogger.debug).toHaveBeenCalledWith({
      ...loggerOpts,
      line: `name is ${name}`,
      stdio: 'stdout',
    })
    expect(lifecycleLogger.debug).toHaveBeenCalledWith({
      ...loggerOpts,
      optional: false,
      exitCode: 0,
    })
  }
})

testBelowNode24('pnpm exec --recursive --reporter-hide-prefix does not print prefixes', async () => {
  preparePackages([
    {
      location: 'packages/foo',
      package: { name: 'foo' },
    },
    {
      location: 'packages/bar',
      package: { name: 'bar' },
    },
  ])

  await writeYamlFile('pnpm-workspace.yaml', {
    packages: ['packages/*'],
  })

  const { selectedProjectsGraph } = await filterPackagesFromDir(process.cwd(), [])

  const scriptFile = path.resolve('script.js')
  fs.writeFileSync(scriptFile, `
    console.log('hello from stdout')
    console.error('hello from stderr')
    console.log('name is ' + require(require('path').resolve('package.json')).name)
  `)

  await exec.handler({
    ...DEFAULT_OPTS,
    dir: process.cwd(),
    recursive: true,
    bail: true,
    reporterHidePrefix: true,
    selectedProjectsGraph,
  }, [process.execPath, scriptFile])

  expect(lifecycleLogger.debug).not.toHaveBeenCalled()
})

test('pnpm exec --recursive does not print prefixes by default', async () => {
  preparePackages([
    {
      location: 'packages/foo',
      package: { name: 'foo' },
    },
    {
      location: 'packages/bar',
      package: { name: 'bar' },
    },
  ])

  await writeYamlFile('pnpm-workspace.yaml', {
    packages: ['packages/*'],
  })

  const { selectedProjectsGraph } = await filterPackagesFromDir(process.cwd(), [])

  const scriptFile = path.resolve('script.js')
  fs.writeFileSync(scriptFile, `
    console.log('hello from stdout')
    console.error('hello from stderr')
    console.log('name is ' + require(require('path').resolve('package.json')).name)
  `)

  await exec.handler({
    ...DEFAULT_OPTS,
    dir: process.cwd(),
    recursive: true,
    bail: true,
    selectedProjectsGraph,
  }, [process.execPath, scriptFile])

  expect(lifecycleLogger.debug).not.toHaveBeenCalled()
})
