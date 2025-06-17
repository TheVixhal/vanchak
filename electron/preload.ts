import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  captureScreen: () => ipcRenderer.invoke("capture-screen"),
  startRecording: () => ipcRenderer.invoke("start-recording"),
  stopRecording: () => ipcRenderer.invoke("stop-recording"),
  processWithAI: (data: any) => ipcRenderer.invoke("process-with-ai", data),
  minimizeWindow: () => ipcRenderer.invoke("minimize-window"),

  // Event listeners
  onScreenshotCaptured: (callback: (base64: string) => void) => {
    ipcRenderer.on("screenshot-captured", (event, base64) => callback(base64))
  },
  onAudioTranscribed: (callback: (text: string) => void) => {
    ipcRenderer.on("audio-transcribed", (event, text) => callback(text))
  },
})
