import { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer } from "electron"
import * as path from "path"
import * as fs from "fs"
import Groq from "groq-sdk"

const groq = new Groq({
  apiKey: "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",
})

let mainWindow: BrowserWindow | null = null
let isRecording = false

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    x: width - 420,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  })

  const isDev = process.env.NODE_ENV === "development"

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000")
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    mainWindow.loadFile(path.join(__dirname, "../out/index.html"))
  }

  // Make window draggable
  mainWindow.setIgnoreMouseEvents(false)

  // Hide window initially
  mainWindow.hide()
}

app.whenReady().then(() => {
  createWindow()

  // Global shortcuts
  globalShortcut.register("CommandOrControl+Shift+A", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  globalShortcut.register("CommandOrControl+Shift+S", () => {
    captureScreen()
  })

  globalShortcut.register("CommandOrControl+Shift+R", () => {
    toggleRecording()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on("will-quit", () => {
  globalShortcut.unregisterAll()
})

// IPC Handlers
ipcMain.handle("capture-screen", async () => {
  return await captureScreen()
})

ipcMain.handle("start-recording", async () => {
  return await startAudioRecording()
})

ipcMain.handle("stop-recording", async () => {
  return await stopAudioRecording()
})

ipcMain.handle("process-with-ai", async (event, { text, imageData, context }) => {
  return await processWithAI(text, imageData, context)
})

ipcMain.handle("minimize-window", () => {
  if (mainWindow) {
    mainWindow.hide()
  }
})

async function captureScreen(): Promise<string | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    })

    if (sources.length > 0) {
      const screenshot = sources[0].thumbnail.toPNG()
      const base64 = screenshot.toString("base64")

      // Send to renderer
      if (mainWindow) {
        mainWindow.webContents.send("screenshot-captured", base64)
      }

      return base64
    }
    return null
  } catch (error) {
    console.error("Error capturing screen:", error)
    return null
  }
}

let audioRecorder: any = null

async function startAudioRecording(): Promise<boolean> {
  try {
    const recorder = require("node-record-lpcm16")

    const audioChunks: Buffer[] = []

    audioRecorder = recorder.record({
      sampleRateHertz: 16000,
      threshold: 0,
      verbose: false,
      recordProgram: "rec",
      silence: "1.0",
    })

    audioRecorder.stream().on("data", (chunk: Buffer) => {
      audioChunks.push(chunk)
    })

    audioRecorder.stream().on("end", async () => {
      const audioBuffer = Buffer.concat(audioChunks)
      await processAudioWithGroq(audioBuffer)
    })

    isRecording = true
    return true
  } catch (error) {
    console.error("Error starting recording:", error)
    return false
  }
}

async function stopAudioRecording(): Promise<void> {
  if (audioRecorder) {
    audioRecorder.stop()
    audioRecorder = null
    isRecording = false
  }
}

function toggleRecording(): void {
  if (isRecording) {
    stopAudioRecording()
  } else {
    startAudioRecording()
  }
}

async function processAudioWithGroq(audioBuffer: Buffer): Promise<void> {
  try {
    // Save audio temporarily
    const tempPath = path.join(__dirname, "temp_audio.wav")
    fs.writeFileSync(tempPath, audioBuffer)

    // Convert to text using Groq Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "distil-whisper-large-v3-en",
    })

    // Clean up temp file
    fs.unlinkSync(tempPath)

    // Send transcription to renderer
    if (mainWindow && transcription.text) {
      mainWindow.webContents.send("audio-transcribed", transcription.text)
    }
  } catch (error) {
    console.error("Error processing audio:", error)
  }
}

async function processWithAI(text: string, imageData?: string, context?: string): Promise<string> {
  try {
    let prompt = `You are a helpful AI assistant. The user said: "${text}"`

    if (context) {
      prompt += `\n\nContext: ${context}`
    }

    if (imageData) {
      prompt += `\n\nThe user has shared a screenshot. Please analyze it and provide relevant assistance.`
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant that provides concise, relevant responses. Keep responses brief and actionable.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.1-70b-versatile", // Using available model instead of llama-4-scout
      temperature: 0.7,
      max_tokens: 500,
    })

    return completion.choices[0]?.message?.content || "Sorry, I could not process your request."
  } catch (error) {
    console.error("Error processing with AI:", error)
    return "Error processing your request. Please try again."
  }
}
