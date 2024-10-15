/**
 * The preload script runs before. It has access to web APIs
 * as well as Electron's renderer process modules
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('exposed', {

  // expose a function in main (node) to renderer
  getStuffFromMain: () => ipcRenderer.invoke('get-stuff-from-main'),

  // send data back to main
  sendStuffToMain: (data) => ipcRenderer.invoke('send-stuff-to-main', data),

  userMessage: (data) => ipcRenderer.invoke('user-message', data)
})