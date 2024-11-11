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
  const retellWebClient = useRef<RetellWebClient>(new RetellWebClient());
  const [callId, setCallId] = useState<string | null>(null);


  const addToTranscript = (role: string, text: string) => {
    console.log('Adding to transcript:', { role, text });
    setTranscript(prev => {
      const newTranscript = [...prev, { role, text }];
      console.log('New transcript:', newTranscript);
      return newTranscript;
    });
  };

  const handleStop = async () => {
    console.log('Stopping conversation...');
    console.log('Current transcript:', transcript);  
    console.log('callId', callId)
    // First stop everything
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  
    // Stop the Retell client
    if (retellWebClient.current) {
      try {
        await retellWebClient.current.stopCall();
      } catch (error) {
        console.error('Error stopping Retell client:', error);
      }
    }
  
    // Wait a few seconds and fetch the transcript using the stored callId
    if (callId) {
      try {
        console.log('Waiting for transcript processing...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
  
        const response = await fetch(`/api/retell?callId=${callId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch transcript');
        }
        const data = await response.json();
        console.log('Final transcript:', data);
        
        // Add the final transcript to your conversation
        if (data.transcript) {
          const rawTranscript = data.transcript || data.transcription;
        
          // Split the transcript into segments
          const segments = rawTranscript.split(/(?=Agent:|User:)/g);
          addToTranscript('system', '--- Final Conversation Transcript ---');
          // addToTranscript('system', data.transcript);
          segments.forEach(segment => {
            const trimmedSegment = segment.trim();
            if (trimmedSegment.startsWith('Agent:')) {
              addToTranscript('assistant', trimmedSegment.trim());
            } else if (trimmedSegment.startsWith('User:')) {
              addToTranscript('user', trimmedSegment.trim());
            }
          });
        }
      } catch (error) {
        console.error('Error fetching final transcript:', error);
        addToTranscript('system', 'Failed to fetch final transcript');
      }
    }
  
    setIsConversationActive(false);
    setCallId(null); // Reset callId for next conversation
  };

  const startConversation = async () => {
    if (!systemPrompt) {
      alert('Please enter a system prompt');
      return;
    }
  
    try {
      setIsConversationActive(true);
      // Clear previous transcript when starting new conversation
      setTranscript([]);
      await initializeConversation();
    } catch (error) {
      console.error('Error starting conversation:', error);
      console.error('Error details:', (error as Error).message);
      alert(`Failed to start conversation: ${(error as Error).message}`);
      handleStop();
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

    const data = await response.json();
    console.log('Full API Response:', data);
    setCallId(data.webCall.call_id);
    console.log('callId', data.webCall.call_id)


    // Use URL to properly handle the WebSocket URL construction
    const wsUrl = new URL(data.wsUrl);
    wsUrl.searchParams.append('access_token', data.accessToken);
    console.log('Connecting to WebSocket URL:', wsUrl.toString());

    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    ws.onopen = async () => {
      console.log('WebSocket connected successfully');
      try {
        await retellWebClient.current.startCall({ accessToken: data.accessToken });
        console.log('Retell client started');
        await startAudioRecording(ws);
        console.log('Audio recording started');
        // Add initial system message to transcript
        addToTranscript('system', 'Conversation started');
      } catch (error) {
        console.error('Error in setup:', error);
        handleStop();
      }
    };

    ws.onmessage = (event) => {
      try {
        console.log('Raw WebSocket message:', event.data);
        const message = JSON.parse(event.data);
        console.log('Parsed WebSocket message:', message);

        if (message.type === 'transcript') {
          addToTranscript('user', message.text);
        } else if (message.type === 'agent_response') {
          addToTranscript('assistant', message.text);
        } else {
          console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event);
    };
  };

  const startAudioRecording = async (ws: WebSocket) => {
    try {
      console.log('Requesting audio permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('Audio permissions granted');
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

      mediaRecorder.start(100);
      console.log('Started recording audio');
    } catch (error) {
      console.error('Error starting audio recording:', error);
      handleStop();
      throw error;
    }
  };

  // Debug useEffect to monitor transcript changes
  useEffect(() => {
    console.log('Transcript updated:', transcript);
  }, [transcript]);

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
            <Button 
              className={`${!isConversationActive ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
              onClick={isConversationActive ? handleStop : startConversation}
            >
              {isConversationActive ? (
                <>
                  <MicOff className="mr-2 h-4 w-4" />
                  Stop Conversation
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Conversation
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {transcript.length > 0 && (
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
                      : entry.role === 'system'
                      ? 'bg-yellow-100'
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
