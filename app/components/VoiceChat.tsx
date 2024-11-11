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

// "use client";

// import React, { useState, useRef, useEffect } from 'react';
// import { Card, CardContent } from '../../src/components/ui/card';
// import { Button } from '../../src/components/ui/button';
// import { Mic, MicOff } from 'lucide-react';

// const VoiceChat = () => {
//   const [isConversationActive, setIsConversationActive] = useState(false);
//   const [transcript, setTranscript] = useState<Array<{role: string, text: string}>>([]);
//   const [systemPrompt, setSystemPrompt] = useState('');
//   const wsRef = useRef<WebSocket | null>(null);
//   const mediaRecorderRef = useRef<MediaRecorder | null>(null);

//   const startConversation = async () => {
//     if (!systemPrompt) {
//       alert('Please enter a system prompt');
//       return;
//     }

//     try {
//       // Initialize the conversation
//       const response = await fetch('/api/retell', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ systemPrompt }),
//       });

//       const data = await response.json();
//       if (data.error) throw new Error(data.error);

//       console.log('Setup response:', data);

//       // Connect to WebSocket
//       const ws = new WebSocket(data.wsUrl);
//       wsRef.current = ws;

//       ws.onopen = () => {
//         console.log('WebSocket connected');
//       };

//       ws.onmessage = (event) => {
//         const message = JSON.parse(event.data);
//         console.log('Received message:', message);

//         if (message.type === 'transcript') {
//           setTranscript(prev => [...prev, {
//             role: 'user',
//             text: message.text
//           }]);
//         } else if (message.type === 'agent_response') {
//           setTranscript(prev => [...prev, {
//             role: 'assistant',
//             text: message.text
//           }]);
//         }
//       };

//       ws.onerror = (error) => {
//         console.error('WebSocket error:', error);
//       };

//       // Set up audio recording
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       const mediaRecorder = new MediaRecorder(stream);
//       mediaRecorderRef.current = mediaRecorder;

//       mediaRecorder.ondataavailable = (event) => {
//         if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
//           ws.send(event.data);
//         }
//       };

//       mediaRecorder.start(1000); // Send audio data every second
//       setIsConversationActive(true);

//     } catch (error) {
//       console.error('Error starting conversation:', error);
//       alert('Failed to start conversation');
//     }
//   };

//   const stopConversation = () => {
//     if (mediaRecorderRef.current) {
//       mediaRecorderRef.current.stop();
//       mediaRecorderRef.current = null;
//     }
//     if (wsRef.current) {
//       wsRef.current.close();
//       wsRef.current = null;
//     }
//     setIsConversationActive(false);
//   };

//   useEffect(() => {
//     return () => {
//       if (mediaRecorderRef.current) {
//         mediaRecorderRef.current.stop();
//       }
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//     };
//   }, []);

//   return (
//     <div className="max-w-2xl mx-auto p-4">
//       <Card className="mb-4">
//         <CardContent className="pt-6">
//           <div className="mb-4">
//             <label className="block text-sm font-medium mb-2">
//               Enter a system prompt for the AI
//             </label>
//             <textarea
//               className="w-full p-2 border rounded-md"
//               rows={4}
//               value={systemPrompt}
//               onChange={(e) => setSystemPrompt(e.target.value)}
//               placeholder="You are the head chef at a famous Japanese restaurant..."
//               disabled={isConversationActive}
//             />
//           </div>

//           <div className="flex justify-center">
//             {!isConversationActive ? (
//               <Button 
//                 className="bg-green-600 hover:bg-green-700 text-white"
//                 onClick={startConversation}
//               >
//                 <Mic className="mr-2 h-4 w-4" />
//                 Start Conversation
//               </Button>
//             ) : (
//               <Button 
//                 className="bg-red-600 hover:bg-red-700 text-white"
//                 onClick={stopConversation}
//               >
//                 <MicOff className="mr-2 h-4 w-4" />
//                 Stop Conversation
//               </Button>
//             )}
//           </div>
//         </CardContent>
//       </Card>

//       {(isConversationActive || transcript.length > 0) && (
//         <Card>
//           <CardContent className="pt-6">
//             <h2 className="text-lg font-semibold mb-4">
//               {isConversationActive ? 'Conversation in Progress...' : 'Conversation has Ended'}
//             </h2>
//             <div className="space-y-2">
//               {transcript.map((entry, index) => (
//                 <div
//                   key={index}
//                   className={`p-2 rounded ${
//                     entry.role === 'assistant' 
//                       ? 'bg-gray-100 ml-4'
//                       : 'bg-blue-100 mr-4'
//                   }`}
//                 >
//                   {entry.text}
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       )}
//     </div>
//   );
// };

// export default VoiceChat;
// "use client";

// import React, { useState, useRef, useEffect } from 'react';
// import { Card, CardContent } from '../../src/components/ui/card';
// import { Button } from '../../src/components/ui/button';
// import { Mic, MicOff } from 'lucide-react';

// const VoiceChat = () => {
//   const [isConversationActive, setIsConversationActive] = useState(false);
//   const [transcript, setTranscript] = useState<Array<{role: string, text: string}>>([]);
//   const [systemPrompt, setSystemPrompt] = useState('');
//   const [conversationId, setConversationId] = useState<string | null>(null);
//   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
//   const wsRef = useRef<WebSocket | null>(null);

//   const startConversation = async () => {
//     if (!systemPrompt) {
//       alert('Please enter a system prompt');
//       return;
//     }

//     try {
//       const response = await fetch('/api/retell', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ systemPrompt }),
//       });

//       const data = await response.json();
//       if (data.error) throw new Error(data.error);

//       console.log('Conversation created:', data);
//       setConversationId(data.conversationId);
//       setIsConversationActive(true);

//       // Start WebSocket connection
//       const ws = new WebSocket(`wss://api.retellai.com/voice/websocket?conversation_id=${data.conversationId}`);
//       wsRef.current = ws;

//       ws.onmessage = (event) => {
//         const message = JSON.parse(event.data);
//         console.log('Received message:', message);
        
//         if (message.type === 'transcript') {
//           setTranscript(prev => [...prev, {
//             role: 'user',
//             text: message.transcript
//           }]);
//         } else if (message.type === 'response') {
//           setTranscript(prev => [...prev, {
//             role: 'assistant',
//             text: message.response
//           }]);
//         }
//       };

//       // Start audio recording
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       const mediaRecorder = new MediaRecorder(stream);
//       mediaRecorderRef.current = mediaRecorder;

//       mediaRecorder.ondataavailable = async (event) => {
//         if (event.data.size > 0 && data.conversationId) {
//           const audioBlob = event.data;
//           if (ws.readyState === WebSocket.OPEN) {
//             ws.send(audioBlob);
//           }
//         }
//       };

//       mediaRecorder.start(1000); // Send audio data every second
//     } catch (error) {
//       console.error('Error starting conversation:', error);
//       alert('Failed to start conversation');
//     }
//   };

//   const stopConversation = () => {
//     if (mediaRecorderRef.current) {
//       mediaRecorderRef.current.stop();
//       mediaRecorderRef.current = null;
//     }
//     if (wsRef.current) {
//       wsRef.current.close();
//       wsRef.current = null;
//     }
//     setIsConversationActive(false);
//     setConversationId(null);
//   };

//   useEffect(() => {
//     return () => {
//       if (mediaRecorderRef.current) {
//         mediaRecorderRef.current.stop();
//       }
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//     };
//   }, []);

//   return (
//     <div className="max-w-2xl mx-auto p-4">
//       <Card className="mb-4">
//         <CardContent className="pt-6">
//           <div className="mb-4">
//             <label className="block text-sm font-medium mb-2">
//               Enter a system prompt for the AI
//             </label>
//             <textarea
//               className="w-full p-2 border rounded-md"
//               rows={4}
//               value={systemPrompt}
//               onChange={(e) => setSystemPrompt(e.target.value)}
//               placeholder="You are the head chef at a famous Japanese restaurant..."
//             />
//           </div>

//           <div className="flex justify-center">
//             {!isConversationActive ? (
//               <Button 
//                 className="bg-green-600 hover:bg-green-700 text-white"
//                 onClick={startConversation}
//               >
//                 <Mic className="mr-2 h-4 w-4" />
//                 Start Conversation
//               </Button>
//             ) : (
//               <Button 
//                 className="bg-red-600 hover:bg-red-700 text-white"
//                 onClick={stopConversation}
//               >
//                 <MicOff className="mr-2 h-4 w-4" />
//                 Stop Conversation
//               </Button>
//             )}
//           </div>
//         </CardContent>
//       </Card>

//       {(isConversationActive || transcript.length > 0) && (
//         <Card>
//           <CardContent className="pt-6">
//             <h2 className="text-lg font-semibold mb-4">
//               {isConversationActive ? 'Conversation in Progress...' : 'Conversation has Ended'}
//             </h2>
//             <div className="space-y-2">
//               {transcript.map((entry, index) => (
//                 <div
//                   key={index}
//                   className={`p-2 rounded ${
//                     entry.role === 'assistant' 
//                       ? 'bg-gray-100 ml-4'
//                       : 'bg-blue-100 mr-4'
//                   }`}
//                 >
//                   {entry.text}
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       )}
//     </div>
//   );
// };

// export default VoiceChat;
// // "use client";

// // import React, { useState, useRef, useEffect } from 'react';
// // import { Card, CardContent } from '../../src/components/ui/card';
// // import { Button } from '../../src/components/ui/button';
// // import { Mic, MicOff } from 'lucide-react';

// // const VoiceChat = () => {
// //   const [isConversationActive, setIsConversationActive] = useState(false);
// //   const [transcript, setTranscript] = useState<Array<{role: string, text: string}>>([]);
// //   const [systemPrompt, setSystemPrompt] = useState('');
// //   const [sessionId, setSessionId] = useState<string | null>(null);
// //   const mediaRecorderRef = useRef<MediaRecorder | null>(null);

// // // In VoiceChat.tsx, update the startConversation function
// // const startConversation = async () => {
// //   if (!systemPrompt) {
// //     alert('Please enter a system prompt');
// //     return;
// //   }

// //   try {
// //     const response = await fetch('/api/retell', {
// //       method: 'POST',
// //       headers: {
// //         'Content-Type': 'application/json',
// //       },
// //       body: JSON.stringify({ systemPrompt }),
// //     });

// //     const data = await response.json();
// //     if (data.error) throw new Error(data.error);

// //     setSessionId(data.conversationId);  // Updated to use conversationId
// //     setIsConversationActive(true);

// //     // Start audio recording
// //     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
// //     const mediaRecorder = new MediaRecorder(stream);
// //     mediaRecorderRef.current = mediaRecorder;

// //     mediaRecorder.ondataavailable = async (event) => {
// //       if (event.data.size > 0 && data.conversationId) {
// //         const audioBlob = event.data;
// //         // Send audio data to your backend
// //         const formData = new FormData();
// //         formData.append('audio', audioBlob);
// //         formData.append('conversationId', data.conversationId);

// //         await fetch('/api/retell/audio', {
// //           method: 'POST',
// //           body: formData,
// //         });
// //       }
// //     };

// //     mediaRecorder.start(1000);
// //   } catch (error) {
// //     console.error('Error starting conversation:', error);
// //     alert('Failed to start conversation');
// //   }
// // };

// //   const stopConversation = () => {
// //     if (mediaRecorderRef.current) {
// //       mediaRecorderRef.current.stop();
// //       mediaRecorderRef.current = null;
// //     }
// //     setIsConversationActive(false);
// //     setSessionId(null);
// //   };

// //   useEffect(() => {
// //     // Cleanup function
// //     return () => {
// //       if (mediaRecorderRef.current) {
// //         mediaRecorderRef.current.stop();
// //       }
// //     };
// //   }, []);

// //   return (
// //     <div className="max-w-2xl mx-auto p-4">
// //       <Card className="mb-4">
// //         <CardContent className="pt-6">
// //           <div className="mb-4">
// //             <label className="block text-sm font-medium mb-2">
// //               Enter a system prompt for the AI
// //             </label>
// //             <textarea
// //               className="w-full p-2 border rounded-md"
// //               rows={4}
// //               value={systemPrompt}
// //               onChange={(e) => setSystemPrompt(e.target.value)}
// //               placeholder="You are the head chef at a famous Japanese restaurant..."
// //             />
// //           </div>

// //           <div className="flex justify-center">
// //             {!isConversationActive ? (
// //               <Button 
// //                 className="bg-green-600 hover:bg-green-700 text-white"
// //                 onClick={startConversation}
// //               >
// //                 <Mic className="mr-2 h-4 w-4" />
// //                 Start Conversation
// //               </Button>
// //             ) : (
// //               <Button 
// //                 className="bg-red-600 hover:bg-red-700 text-white"
// //                 onClick={stopConversation}
// //               >
// //                 <MicOff className="mr-2 h-4 w-4" />
// //                 Stop Conversation
// //               </Button>
// //             )}
// //           </div>
// //         </CardContent>
// //       </Card>

// //       {(isConversationActive || transcript.length > 0) && (
// //         <Card>
// //           <CardContent className="pt-6">
// //             <h2 className="text-lg font-semibold mb-4">
// //               {isConversationActive ? 'Conversation in Progress...' : 'Conversation has Ended'}
// //             </h2>
// //             <div className="space-y-2">
// //               {transcript.map((entry, index) => (
// //                 <div
// //                   key={index}
// //                   className={`p-2 rounded ${
// //                     entry.role === 'assistant' 
// //                       ? 'bg-gray-100 ml-4'
// //                       : 'bg-blue-100 mr-4'
// //                   }`}
// //                 >
// //                   {entry.text}
// //                 </div>
// //               ))}
// //             </div>
// //           </CardContent>
// //         </Card>
// //       )}
// //     </div>
// //   );
// // };

// // export default VoiceChat;
// // // "use client";

// // // import React, { useState } from 'react';
// // // import { Card, CardContent } from '../../src/components/ui/card';
// // // import { Button as ButtonComponent } from '../../src/components/ui/button';  // Changed this line
// // // import { Mic, MicOff } from 'lucide-react';

// // // const VoiceChat = () => {
// // //   const [isConversationActive, setIsConversationActive] = useState(false);
// // //   const [transcript, setTranscript] = useState([]);
// // //   const [systemPrompt, setSystemPrompt] = useState('');

// // //   const startConversation = async () => {
// // //     if (!systemPrompt) {
// // //       alert('Please enter a system prompt');
// // //       return;
// // //     }
// // //     setIsConversationActive(true);
// // //   };

// // //   const stopConversation = () => {
// // //     setIsConversationActive(false);
// // //   };

// // //   return (
// // //     <div className="max-w-2xl mx-auto p-4">
// // //       <Card className="mb-4">
// // //         <CardContent className="pt-6">
// // //           <div className="mb-4">
// // //             <label className="block text-sm font-medium mb-2">
// // //               Enter a system prompt for the AI
// // //             </label>
// // //             <textarea
// // //               className="w-full p-2 border rounded-md"
// // //               rows={4}
// // //               value={systemPrompt}
// // //               onChange={(e) => setSystemPrompt(e.target.value)}
// // //               placeholder="You are the head chef at a famous Japanese restaurant..."
// // //             />
// // //           </div>

// // //           <div className="flex justify-center">
// // //             {!isConversationActive ? (
// // //               <ButtonComponent 
// // //                 className="bg-green-600 hover:bg-green-700"
// // //                 onClick={startConversation}
// // //               >
// // //                 <Mic className="mr-2 h-4 w-4" />
// // //                 Start Conversation
// // //               </ButtonComponent>
// // //             ) : (
// // //               <ButtonComponent 
// // //                 className="bg-red-600 hover:bg-red-700"
// // //                 onClick={stopConversation}
// // //               >
// // //                 <MicOff className="mr-2 h-4 w-4" />
// // //                 Stop Conversation
// // //               </ButtonComponent>
// // //             )}
// // //           </div>
// // //         </CardContent>
// // //       </Card>

// // //       {(isConversationActive || transcript.length > 0) && (
// // //         <Card>
// // //           <CardContent className="pt-6">
// // //             <h2 className="text-lg font-semibold mb-4">
// // //               {isConversationActive ? 'Conversation in Progress...' : 'Conversation has Ended'}
// // //             </h2>
// // //           </CardContent>
// // //         </Card>
// // //       )}
// // //     </div>
// // //   );
// // // };

// // // export default VoiceChat;
