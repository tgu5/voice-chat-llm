"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '../../src/components/ui/card';
import { Button } from '../../src/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { RetellWebClient } from "retell-client-js-sdk";


const VoiceChat = () => {
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [transcript, setTranscript] = useState<Array<{role: string, text: string}>>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const retellWebClient = new RetellWebClient();


  const startConversation = async () => {
    if (!systemPrompt) {
      alert('Please enter a system prompt');
      return;
    }
  
    try {
      await initializeConversation();
    } catch (error) {
      console.error('Error starting conversation:', error);
      console.error('Error details:', (error as Error).message);
      alert(`Failed to start conversation: ${(error as Error).message}`);
    }
  };

  const initializeConversation = async () => {
    const response = await fetch('/api/retell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ systemPrompt }),
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
  
      const data = await response.json();
  
      console.log('Full API Response:', data);
  
      // Construct WebSocket URL with access token
      const wsUrlWithAuth = `${data.wsUrl}?access_token=${data.accessToken}`;
      console.log('Connecting to WebSocket URL:', wsUrlWithAuth);
  
      // Connect to WebSocket
      const ws = new WebSocket(wsUrlWithAuth);
      wsRef.current = ws;
  
      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        startAudioRecording(ws);      
        retellWebClient.startCall({ accessToken: data.accessToken });
      };
  
      ws.onmessage = (event) => {
        try {
          console.log('Raw WebSocket message:', event.data);
          const message = JSON.parse(event.data);
          console.log('Parsed WebSocket message:', message);
  
          if (message.type === 'transcript') {
            setTranscript(prev => [...prev, {
              role: 'user',
              text: message.text
            }]);
          } else if (message.type === 'agent_response') {
            setTranscript(prev => [...prev, {
              role: 'assistant',
              text: message.text
            }]);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };
  
      ws.onerror = (error) => {
        console.error('WebSocket error:', error.message, error.code);
      };
  
      ws.onclose = (event) => {
        console.log('WebSocket closed:', event);
      };
  
      setIsConversationActive(true);
  

  };
  const startAudioRecording = async (ws: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
  
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(event.data);
            console.log('Audio data sent:', event.data.size, 'bytes');
          } catch (error) {
            console.error('Error sending audio:', error);
          }
        }
      };
  
      mediaRecorder.start(100); // Send audio data every 100ms
      console.log('Started recording audio');
    } catch (error) {
      console.error('Error starting audio recording:', error);
    }
  };
  const stopAudioRecording = () => {
    retellWebClient.stopCall();
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };


  const stopConversation = () => {
    retellWebClient.stopCall();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopAudioRecording();
    setIsConversationActive(false);
  };

  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, []);


  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Enter a system prompt for the AI
            </label>
            <textarea
              className="w-full p-2 border rounded-md"
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are the head chef at a famous Japanese restaurant..."
              disabled={isConversationActive}
            />
          </div>

          <div className="flex justify-center">
            {!isConversationActive ? (
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={startConversation}
              >
                <Mic className="mr-2 h-4 w-4" />
                Start Conversation
              </Button>
            ) : (
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={stopConversation}
              >
                <MicOff className="mr-2 h-4 w-4" />
                Stop Conversation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {(isConversationActive || transcript.length > 0) && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">
              {isConversationActive ? 'Conversation in Progress...' : 'Conversation has Ended'}
            </h2>
            <div className="space-y-2">
              {transcript.map((entry, index) => (
                <div
                  key={index}
                  className={`p-2 rounded ${
                    entry.role === 'assistant' 
                      ? 'bg-gray-100 ml-4'
                      : 'bg-blue-100 mr-4'
                  }`}
                >
                  {entry.text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VoiceChat;
