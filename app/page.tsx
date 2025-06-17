"use client"

import { useState, useEffect, useRef } from "react"
import { Mic, MicOff, Camera, Send, Minimize2, Settings } from "lucide-react"

declare global {
  interface Window {
    electronAPI: {
      captureScreen: () => Promise<string | null>
      startRecording: () => Promise<boolean>
      stopRecording: () => Promise<void>
      processWithAI: (data: any) => Promise<string>
      minimizeWindow: () => void
      onScreenshotCaptured: (callback: (base64: string) => void) => void
      onAudioTranscribed: (callback: (text: string) => void) => void
    }
  }
}

export default function AIAssistant() {
  const [isRecording, setIsRecording] = useState(false)
  const [inputText, setInputText] = useState("")
  const [response, setResponse] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [opacity, setOpacity] = useState(0.9)
  const responseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      // Listen for screenshot captures
      window.electronAPI.onScreenshotCaptured((base64) => {
        setScreenshot(base64)
      })

      // Listen for audio transcriptions
      window.electronAPI.onAudioTranscribed((text) => {
        setInputText(text)
        handleSubmit(text)
      })
    }
  }, [])

  const toggleRecording = async () => {
    if (isRecording) {
      await window.electronAPI.stopRecording()
      setIsRecording(false)
    } else {
      const started = await window.electronAPI.startRecording()
      if (started) {
        setIsRecording(true)
      }
    }
  }

  const captureScreen = async () => {
    await window.electronAPI.captureScreen()
  }

  const handleSubmit = async (text?: string) => {
    const textToProcess = text || inputText
    if (!textToProcess.trim()) return

    setIsProcessing(true)
    try {
      const aiResponse = await window.electronAPI.processWithAI({
        text: textToProcess,
        imageData: screenshot,
        context: "Desktop AI Assistant",
      })
      setResponse(aiResponse)
      setInputText("")
    } catch (error) {
      setResponse("Error processing request. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const minimizeApp = () => {
    window.electronAPI.minimizeWindow()
  }

  if (isMinimized) {
    return (
      <div
        className="fixed top-4 right-4 w-12 h-12 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer hover:bg-black/30 transition-all"
        onClick={() => setIsMinimized(false)}
        style={{ opacity }}
      >
        <Settings className="w-6 h-6 text-white" />
      </div>
    )
  }

  return (
    <div
      className="w-full h-full bg-black/10 backdrop-blur-md rounded-lg border border-white/20 text-white overflow-hidden"
      style={{ opacity }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-black/20 border-b border-white/10">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium">AI Assistant</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setOpacity(opacity === 0.9 ? 0.3 : 0.9)}
            className="p-1 hover:bg-white/10 rounded text-xs"
          >
            {opacity === 0.9 ? "30%" : "90%"}
          </button>
          <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-white/10 rounded">
            <Minimize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-2 p-3 bg-black/10">
        <button
          onClick={toggleRecording}
          className={`p-2 rounded-full transition-all ${
            isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <button onClick={captureScreen} className="p-2 bg-purple-500 hover:bg-purple-600 rounded-full transition-all">
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {/* Input */}
      <div className="p-3 border-b border-white/10">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Type or speak your question..."
            className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-sm placeholder-white/50 focus:outline-none focus:border-white/40"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={isProcessing || !inputText.trim()}
            className="p-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 rounded transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Response */}
      <div className="flex-1 p-3 overflow-y-auto">
        {isProcessing ? (
          <div className="flex items-center space-x-2 text-sm text-white/70">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <span>Processing...</span>
          </div>
        ) : response ? (
          <div ref={responseRef} className="text-sm text-white/90 leading-relaxed">
            {response}
          </div>
        ) : (
          <div className="text-xs text-white/50 text-center">
            <p>Shortcuts:</p>
            <p>Ctrl+Shift+A - Toggle window</p>
            <p>Ctrl+Shift+S - Screenshot</p>
            <p>Ctrl+Shift+R - Record audio</p>
          </div>
        )}
      </div>

      {/* Screenshot indicator */}
      {screenshot && (
        <div className="absolute bottom-2 right-2 w-8 h-8 bg-green-500 rounded border-2 border-white flex items-center justify-center">
          <Camera className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  )
}
