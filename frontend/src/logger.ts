import loglevel from 'loglevel'

const NODE_ENV = process.env.NODE_ENV || 'development'
const DEBUG_SETTING = process.env.DEBUG || 'false'

// Define types for our console interface
type LogMethod = (...args: any[]) => void;
interface CustomConsole {
  log: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
}

// Set initial log level
loglevel.setLevel('info')

// Adjust log level based on environment and debug settings
if (NODE_ENV === 'production') {
  loglevel.setLevel('warn')
}

if (DEBUG_SETTING === 'debug' || DEBUG_SETTING !== 'false') {
  loglevel.setLevel('debug')
  loglevel.warn(`LOGGER SET TO DEBUG - ENV: ${NODE_ENV}, DEBUG_SETTING: ${DEBUG_SETTING}`)
}
if (DEBUG_SETTING === 'info') {
  loglevel.setLevel('info')
  loglevel.warn(`LOGGER SET TO INFO - ENV: ${NODE_ENV}, DEBUG_SETTING: ${DEBUG_SETTING}`)
}
if (DEBUG_SETTING === 'trace') {
  loglevel.setLevel('trace')
  loglevel.warn(`LOGGER SET TO TRACE - ENV: ${NODE_ENV}, DEBUG_SETTING: ${DEBUG_SETTING}`)
}

// Create and export the logger
const logger: CustomConsole = {
  log: (...args: any[]): void => { loglevel.debug(...args) },
  info: (...args: any[]): void => { loglevel.info(...args) },
  warn: (...args: any[]): void => { loglevel.warn(...args) },
  error: (...args: any[]): void => { loglevel.error(...args) },
  debug: (...args: any[]): void => { loglevel.debug(...args) }
}

export default logger
